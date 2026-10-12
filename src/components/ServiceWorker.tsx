"use client";

import { useEffect } from "react";

/** Registers the service worker (offline page, push). Only in the real app, so development never gets stale files. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reg: ServiceWorkerRegistration | undefined;
    const register = () =>
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((r) => {
          reg = r;
        })
        .catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    // A phone app can sit in memory for days: look for a newer worker each time it comes back.
    const onVisible = () => document.visibilityState === "visible" && void reg?.update().catch(() => undefined);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}
