"use client";

import { useEffect, useState } from "react";

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "";

/**
 * A Home Screen app can stay open in memory for days. After a new version is published, that old copy talks to a
 * newer server and starts to misbehave (actions that no longer exist, screens that disagree). This notices, and
 * reloads when it is safe: straight away on the tab screens, and with a button during a workout.
 */
export function UpdateWatcher() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!BUILD) return;
    let last = 0;
    const check = async (force = false) => {
      if (!force && Date.now() - last < 20_000) return;
      last = Date.now();
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const j = (await res.json()) as { build?: string };
        if (j.build && j.build !== BUILD) {
          const busy = /^\/(workout|complete)/.test(window.location.pathname);
          if (busy) setStale(true);
          else window.location.reload();
        }
      } catch {
        /* offline or signed out: try again later */
      }
    };
    const onVisible = () => document.visibilityState === "visible" && void check();
    const onForce = () => void check(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onForce);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("wt:check-version", onForce);
    const iv = window.setInterval(() => void check(), 5 * 60_000);
    void check();
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onForce);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("wt:check-version", onForce);
      window.clearInterval(iv);
    };
  }, []);

  if (!stale) return null;
  return (
    <div className="update-bar" role="status">
      <span>A new version is ready.</span>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Update</button>
    </div>
  );
}
