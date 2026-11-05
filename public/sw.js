/* Workout Tracker service worker.
   1. Offline: every screen you have opened is kept and opens with no signal (your last view of it). A slow or dead connection
      gives up after a few seconds instead of loading forever. Caches are cleared when you sign out. /workout is only reused
      while a session is fresh, so a finished session never comes back.
   2. Speed: static files (fonts, scripts, styles, icons) are cached after the first visit.
   3. Push: shows the "rest is over" notification. Works only once the app is on the iPhone Home Screen. */

const VERSION = "v3";
const WAIT_MS = 3500; // how long a slow connection gets before the saved copy is used
const PAGE = /^\/($|progress|library|plan|workout|complete|review|install|notifications)/;
const WORKOUT_FRESH_MS = 3 * 60 * 60 * 1000;
const CACHE = "wt-" + VERSION;
const SHELL = ["/offline", "/icons/192", "/icons/180", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      // Make the offline page fully self-contained: its scripts, styles and fonts too.
      try {
        const html = await (await fetch("/offline")).text();
        const assets = [...new Set([...html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]))];
        await Promise.all(assets.map((u) => cache.add(u).catch(() => {})));
        for (const u of assets.filter((a) => a.includes(".css"))) {
          const css = await (await cache.match(u))?.text();
          const fonts = [...(css || "").matchAll(/url\(([^)]+\.woff2[^)]*)\)/g)].map((m) => new URL(m[1].replace(/["']/g, ""), self.location.origin + u).pathname);
          await Promise.all(fonts.map((f) => cache.add(f).catch(() => {})));
        }
      } catch (e) {
        /* the shell above is enough for a basic fallback */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("wt-") && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

const key = (url) => new Request(url.origin + url.pathname + url.search);

async function page(req, url) {
  const cache = await caches.open(CACHE);
  const k = key(url);
  const cacheable = PAGE.test(url.pathname);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(no, WAIT_MS))]);
    if (res.ok && !res.redirected && cacheable) {
      const copy = res.clone();
      const blob = await copy.blob();
      const stamped = new Response(blob, { headers: new Headers({ ...Object.fromEntries(copy.headers), "x-wt-saved": String(Date.now()) }) });
      await cache.put(k, stamped);
      // The scripts and styles this screen needs, so it works (not just shows) with no signal.
      if (blob) {
        const html = await blob.text();
        const files = [...new Set([...html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]))];
        for (const f of files) if (!(await cache.match(f))) cache.add(f).catch(() => {});
      }
      // Finished a workout: its saved page must never come back.
      if (url.pathname.startsWith("/complete")) await cache.delete(key(new URL("/workout", url.origin)));
    }
    if (url.pathname === "/login" && res.ok) {
      // Signed out (or not signed in): drop every saved screen.
      for (const r of await cache.keys()) if (PAGE.test(new URL(r.url).pathname)) await cache.delete(r);
    }
    return res;
  } catch (e) {
    const hit = await cache.match(k);
    if (hit) {
      const saved = Number(hit.headers.get("x-wt-saved") || 0);
      if (url.pathname !== "/workout" || Date.now() - saved < WORKOUT_FRESH_MS) return hit;
    }
    // Nothing saved for this exact screen: the closest tab, then the offline page.
    if (req.mode === "navigate") {
      const home = await cache.match(key(new URL("/", url.origin)));
      if (home && url.pathname !== "/workout") return home;
      return (await cache.match("/offline")) || new Response("You are offline.", { status: 503 });
    }
    return new Response("", { status: 504 });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Screens (and the quiet background copy the app makes after launch): the network gets a few seconds, then the saved copy.
  const warm = req.headers.get("x-wt-warm") === "1";
  const rsc = req.headers.get("RSC") === "1";
  if (req.mode === "navigate" || warm || rsc) {
    if (rsc && !warm) {
      // In-app tab switches: if the network stalls, fail fast so the app does a normal page load, which the saved copy can answer.
      event.respondWith(Promise.race([fetch(req), new Promise((_, no) => setTimeout(no, WAIT_MS * 2))]));
      return;
    }
    event.respondWith(page(req, url));
    return;
  }

  // Static files never change under the same name: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/exercises/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          }),
      ),
    );
  }
  // Everything else (API calls, data) goes straight to the network.
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || "Rest’s up";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: "rest",
      renotify: true,
      icon: "/icons/192",
      badge: "/icons/192",
      data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/workout" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/workout";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          await c.focus();
          if ("navigate" in c && new URL(c.url).pathname !== url) await c.navigate(url).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
