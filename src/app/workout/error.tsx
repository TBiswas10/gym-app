"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/Icon";

// The workout screen failed to draw. Your sets are safe (they are saved on the phone and on the server). The saved
// copy of this screen's state is the usual suspect, so it is cleared here and the screen is rebuilt from the server.
export default function WorkoutError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i);
        if (k?.startsWith("wt.ws.")) window.localStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
  }, []);
  return (
    <div className="screen fill">
      <div className="scroll">
        <div className="empty" style={{ paddingTop: "var(--space-12)" }}>
          <span className="round round-warning"><Icon name="triangle-alert" /></span>
          <h1 className="t-title">The workout didn’t load</h1>
          <p className="t-body c-2">Your sets are safe. Tap to reload it.</p>
        </div>
      </div>
      <div className="bottom-bar">
        <button type="button" className="btn btn-primary btn-cta" onClick={() => { reset(); window.location.reload(); }}>Reload workout</button>
        <Link className="btn btn-tertiary btn-block" href="/">Back to Today</Link>
      </div>
    </div>
  );
}
