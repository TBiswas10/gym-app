"use client";

import { useRef, type CSSProperties, type PointerEvent } from "react";

/** Swipe a banner up to dismiss it: it follows your finger, and goes if you flick or drag far enough. */
export function useSwipeUp(onDismiss: () => void, distance = 28) {
  const start = useRef<{ y: number; t: number; el: HTMLElement } | null>(null);
  const style: CSSProperties = { touchAction: "none" };

  const move = (e: PointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s) return;
    const dy = Math.min(0, e.clientY - s.y); // up only
    s.el.style.transition = "none";
    s.el.style.transform = `translateY(${dy}px)`;
    s.el.style.opacity = String(Math.max(0.2, 1 + dy / 120));
  };
  const end = (e: PointerEvent<HTMLElement>) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dy = e.clientY - s.y;
    const fast = dy < -8 && e.timeStamp - s.t < 250;
    if (dy <= -distance || fast) {
      s.el.style.transition = "transform 160ms var(--ease-out), opacity 160ms var(--ease-out)";
      s.el.style.transform = "translateY(-120%)";
      s.el.style.opacity = "0";
      window.setTimeout(onDismiss, 150);
    } else {
      s.el.style.transition = "transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)";
      s.el.style.transform = "";
      s.el.style.opacity = "";
    }
  };

  return {
    style,
    handlers: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        // Let real buttons (Undo) still be tapped.
        if ((e.target as HTMLElement).closest("button, a")) return;
        start.current = { y: e.clientY, t: e.timeStamp, el: e.currentTarget };
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}
