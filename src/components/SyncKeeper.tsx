"use client";

import { useSync } from "@/app/workout/useSync";
import { loadQueue } from "@/lib/sync-queue";
import { waitingMessage } from "@/lib/sync-status";

/** Keeps uploading anything saved on this phone while you are on the tab screens, and says so when something waits. */
export function SyncKeeper() {
  const { pending, online, signedOut } = useSync();
  if (pending === 0) return null;
  const waiting = waitingMessage(loadQueue());
  const text = signedOut
    ? `${pending} saved on this phone. Sign in again to upload.`
    : online
      ? `Uploading ${pending} saved ${pending === 1 ? "change" : "changes"}…`
      : waiting
        ? `${waiting}${waiting.endsWith("send") ? ". They go when you’re back online." : "."}`
        : `${pending} saved on this phone. They upload when you’re back online.`;
  return (
    <div className="sync-pill" role="status">
      {text}
    </div>
  );
}
