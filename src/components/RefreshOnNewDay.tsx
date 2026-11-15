"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";
import { sydneyDate } from "@/lib/dates";

/**
 * A Home Screen app can sit in memory overnight, or open from a saved copy of yesterday's page. Today and Progress
 * are built for the day the server rendered them, so when the Sydney date has moved on, ask the server for fresh ones.
 */
export function RefreshOnNewDay({ renderedOn }: { renderedOn: string }) {
  const router = useRouter();
  useEffect(() => {
    let last = 0;
    const check = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      if (sydneyDate(new Date()) === renderedOn || Date.now() - last < 10_000) return;
      last = Date.now();
      startTransition(() => router.refresh());
    };
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    window.addEventListener("online", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("online", check);
    };
  }, [renderedOn, router]);
  return null;
}
