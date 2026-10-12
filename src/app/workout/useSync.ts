"use client";

import { useCallback, useEffect, useState } from "react";
import type { Op } from "@/lib/ops";
import { afterFlush, loadQueue, saveQueue, takeBatch } from "@/lib/sync-queue";
import { applyOpsAction } from "./actions";

// Only one flush may run at a time, whichever screen asked for it: two flushes could send the same batch and then
// both trim the queue.
let flushing = false;

/**
 * Offline-first saving. `enqueue` writes to the phone first, then sends in order.
 * It retries when the network comes back, when the app returns to the foreground, and every few seconds.
 */
export function useSync() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  const flush = useCallback(async () => {
    if (flushing) return;
    flushing = true;
    try {
      for (;;) {
        const queue = loadQueue();
        setPending(queue.length);
        if (queue.length === 0) {
          setOnline(true);
          break;
        }
        const batch = takeBatch(queue);
        let res;
        try {
          res = await applyOpsAction(batch);
        } catch {
          setOnline(false); // no connection: everything stays in the queue
          // Online but the call failed: most likely this copy is older than the server. Ask for a version check.
          if (typeof navigator !== "undefined" && navigator.onLine) window.dispatchEvent(new Event("wt:check-version"));
          break;
        }
        setOnline(true);
        saveQueue(afterFlush(loadQueue(), batch.length, res)); // re-read: more may have been added meanwhile
        setPending(loadQueue().length);
        if (res.signedOut) {
          setSignedOut(true);
          break;
        }
        setSignedOut(false);
        if (res.retry) break;
      }
    } finally {
      flushing = false;
    }
  }, []);

  const enqueue = useCallback(
    (ops: Op[]) => {
      if (ops.length === 0) return;
      const queue = [...loadQueue(), ...ops];
      saveQueue(queue);
      setPending(queue.length);
      void flush();
    },
    [flush],
  );

  useEffect(() => {
    void flush();
    const onOnline = () => void flush();
    const onOffline = () => setOnline(false);
    const onVisible = () => document.visibilityState === "visible" && void flush();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    const iv = window.setInterval(() => loadQueue().length > 0 && void flush(), 8000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(iv);
    };
  }, [flush]);

  return { pending, online, signedOut, enqueue, flush };
}
