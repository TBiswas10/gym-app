"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { mmss } from "@/lib/timers";

// Shown on Today while a session is open: one tap back into it, with the clock still running.
export function ResumeBar({ dayName, startedAt }: { dayName: string; startedAt: string }) {
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    const start = Date.parse(startedAt);
    const tick = () => setSecs(Math.max(0, Math.round((Date.now() - start) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  return (
    <Link className="resume-bar" href="/workout" prefetch={false} aria-label={`Resume ${dayName} workout`}>
      <span className="done-mini" style={{ background: "var(--accent)" }}><Icon name="play" /></span>
      <span className="col grow">
        <strong className="t-body">Resume workout</strong>
        <span className="t-small c-2">{dayName}{secs !== null ? ` · ${mmss(secs)}` : ""}</span>
      </span>
      <Icon name="chevron-right" />
    </Link>
  );
}
