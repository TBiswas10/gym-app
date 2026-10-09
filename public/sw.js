/* Workout Tracker service worker.
   1. Offline: shows a friendly page when a screen can't be loaded. Pages with your data are never cached.
   2. Speed: static files (fonts, scripts, styles, icons) are cached after the first visit.
   3. Push: shows the "rest is over" notification. Works only once the app is on the iPhone Home Screen. */

const VERSION = "v2";
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Screens: always from the network (they hold your data). If that fails, the offline page.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(async () => (await caches.match("/offline")) || new Response("You are offline.", { status: 503 })));
    return;
  }

  // Static files never change under the same name: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/exercises/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
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
