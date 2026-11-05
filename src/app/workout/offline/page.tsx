"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { loadQueue, saveQueue } from "@/lib/sync-queue";
import { clearStarted, hasPendingStart, loadPreview, loadStarted, saveStarted, setPendingCookie, startOp, startedNow } from "@/lib/offline-start";
import type { WorkoutPage } from "@/lib/server/workout-data";
import { applyOpsAction } from "../actions";
import { WorkoutView } from "../WorkoutView";

// Starts (or reopens) a workout from the copy saved on this phone. Used when there is no signal, and whenever a start is still waiting to be
// sent. When the server has the session, this hands over to the normal workout screen.
function Offline() {
  const router = useRouter();
  const date = useSearchParams().get("date") ?? "";
  const [page, setPage] = useState<WorkoutPage | null | "none">(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let queue = loadQueue();
      if (!hasPendingStart(queue) && !date) {
        // Nothing waiting to be sent: the normal screen can take over.
        setPendingCookie(false);
        clearStarted();
        if (cancelled) return;
        if (navigator.onLine) router.replace("/workout");
        else setPage("none"); // no signal and nothing saved to reopen
        return;
      }
      // Online and the start has not been sent: send it first, then continue on the normal screen.
      if (hasPendingStart(queue) && navigator.onLine) {
        try {
          const batch = queue.filter((o) => o.t === "start");
          const res = await applyOpsAction(batch);
          if (!res.retry && !res.signedOut) {
            saveQueue(loadQueue().filter((o) => o.t !== "start"));
            setPendingCookie(false);
            clearStarted();
            if (!cancelled) router.replace("/workout");
            return;
          }
        } catch {
          /* still no usable connection: carry on from the saved copy */
        }
        queue = loadQueue();
      }
      if (cancelled) return;
      // A session already started on this phone: reopen it.
      const started = loadStarted();
      if (started && hasPendingStart(queue)) {
        setPage(started);
        return;
      }
      // A new one from the copy kept by the Today screen.
      const saved = date ? loadPreview(date) : null;
      if (!saved) {
        setPage("none");
        return;
      }
      const fresh = startedNow(saved, new Date());
      const op = startOp(fresh);
      if (!op) {
        setPage("none");
        return;
      }
      saveQueue([op, ...queue]);
      setPendingCookie(true);
      saveStarted(fresh);
      setPage(fresh);
    })();
    return () => {
      cancelled = true;
    };
  }, [date, router]);

  if (page === null) return <div className="screen fill" aria-busy="true" />;
  if (page === "none") {
    return (
      <div className="screen fill">
        <div className="scroll">
          <div className="empty" style={{ paddingTop: "var(--space-12)" }}>
            <span className="round round-warning"><Icon name="wifi-off" /></span>
            <h1 className="t-title">Can’t start without signal yet</h1>
            <p className="t-body c-2">Open the Today screen once with a connection and this phone keeps the workout, so next time you can start it offline.</p>
          </div>
        </div>
        <div className="bottom-bar"><Link className="btn btn-primary btn-cta" href="/">Back to Today</Link></div>
      </div>
    );
  }
  return <WorkoutView page={page} />;
}

export default function OfflineWorkoutPage() {
  return (
    <Suspense fallback={<div className="screen fill" aria-busy="true" />}>
      <Offline />
    </Suspense>
  );
}
