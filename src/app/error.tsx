"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportError } from "@/lib/report-error";
import { Icon } from "@/components/Icon";

// A friendly screen for anything unexpected. The technical error is never shown.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error, "screen"), [error]);
  return (
    <div className="screen fill">
      <div className="scroll">
        <div className="empty" style={{ paddingTop: "var(--space-12)" }}>
          <span className="round round-warning"><Icon name="triangle-alert" /></span>
          <h1 className="t-title">That didn’t load</h1>
          <p className="t-body c-2">Something went wrong on our side. Anything you logged is safe. Try again in a moment.</p>
        </div>
      </div>
      <div className="bottom-bar">
        <button type="button" className="btn btn-primary btn-cta" onClick={reset}>Try again</button>
        <Link className="btn btn-tertiary btn-block" href="/">Back to Today</Link>
      </div>
    </div>
  );
}
