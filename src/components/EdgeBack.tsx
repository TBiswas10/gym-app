"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// iPhone-style back gesture for screens that have a Back button: drag from the left edge and the screen follows
// your finger; let go past halfway (or flick) and it goes back, otherwise it settles.
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

export function EdgeBack() {
  const router = useRouter();
  useEffect(() => {
    const screen = document.querySelector<HTMLElement>(".screen.fill");
    if (!screen) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let sx = 0, sy = 0, lx = 0, lt = 0, vx = 0;
    let mode: "idle" | "pending" | "drag" | "skip" = "idle";

    const set = (x: number, ms = 0) => {
      screen.style.transition = ms && !reduce ? `transform ${ms}ms ${EASE}` : "none";
      screen.style.transform = x ? `translate3d(${x}px,0,0)` : "";
    };
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      mode = e.touches.length === 1 && t.clientX < 24 && window.history.length > 1 ? "pending" : "skip";
      sx = lx = t.clientX;
      sy = t.clientY;
      lt = e.timeStamp;
      vx = 0;
    };
    const move = (e: TouchEvent) => {
      if (mode === "idle" || mode === "skip") return;
      const t = e.touches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (mode === "pending") {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        mode = dx > 0 && dx > Math.abs(dy) * 1.5 ? "drag" : "skip";
      }
      const dt = e.timeStamp - lt;
      if (dt > 0) vx = 0.7 * ((t.clientX - lx) / dt) + 0.3 * vx;
      lx = t.clientX;
      lt = e.timeStamp;
      if (mode === "drag") set(Math.max(0, dx));
    };
    const end = (e: TouchEvent) => {
      const was = mode;
      mode = "idle";
      if (was !== "drag") return;
      const dx = Math.max(0, e.changedTouches[0].clientX - sx);
      const w = screen.offsetWidth;
      if (dx > w * 0.5 || (dx > 30 && vx > 0.5)) {
        set(w, 200);
        window.setTimeout(() => router.back(), reduce ? 0 : 160);
      } else set(0, 300);
    };
    const cancel = () => {
      mode = "idle";
      set(0, 250);
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", cancel);
      screen.style.transform = "";
      screen.style.transition = "";
    };
  }, [router]);
  return null;
}
