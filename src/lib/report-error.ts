// Sends an error the phone hit to /api/log-error so it can be read back instead of guessed at. Never throws, never
// loops: at most 8 reports per launch, each message only once, and network noise is ignored.

import { isNoise } from "./error-report";

const seen = new Set<string>();
let sent = 0;

export function reportError(err: unknown, where = ""): void {
  try {
    if (sent >= 8) return;
    const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : "Unknown error");
    const message = `${where ? `${where}: ` : ""}${e.message}`.slice(0, 300);
    if (!message || isNoise(message) || seen.has(message)) return;
    seen.add(message);
    sent++;
    const body = JSON.stringify({
      message,
      stack: (e.stack ?? "").slice(0, 1500),
      path: window.location.pathname.slice(0, 120),
      build: process.env.NEXT_PUBLIC_BUILD_ID ?? "",
      agent: navigator.userAgent.slice(0, 160),
    });
    if (navigator.sendBeacon?.("/api/log-error", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/log-error", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => undefined);
  } catch {
    /* reporting must never cause an error of its own */
  }
}
