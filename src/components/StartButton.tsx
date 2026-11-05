"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { savePreview } from "@/lib/offline-start";

/** The Start button. Online it keeps a copy of the workout on the phone; with no signal it starts that copy instead of waiting for the server. */
export function StartButton({ href, date, className, children }: { href: string; date: string; className: string; children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    if (!navigator.onLine) return;
    const id = window.setTimeout(() => {
      fetch(`/api/workout-preview?date=${date}`, { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.ok && savePreview(date, j.page))
        .catch(() => undefined);
    }, 2500);
    return () => window.clearTimeout(id);
  }, [date]);
  return (
    <Link
      className={className}
      href={href}
      prefetch={false}
      onClick={(e) => {
        if (!navigator.onLine) {
          e.preventDefault();
          router.push(`/workout/offline?date=${date}`);
        }
      }}
    >
      {children}
    </Link>
  );
}
