import type { PointerEvent } from "react";

interface Drag { y: number; from: number; t: number }
const drags = new WeakMap<HTMLElement, Drag>();

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const offsetOf = (el: HTMLElement) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;

/**
 * Pull a bottom sheet down by its grab handle: it follows the finger from wherever it is right now (so a drag can
 * interrupt a snap-back), and goes if you pull far enough or flick. Spread the result on the `.sheet-wrap` element.
 * The close button stays; this is only the extra way out.
 */
export function sheetDrag(onClose: () => void) {
  const end = (e: PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const d = drags.get(el);
    drags.delete(el);
    if (!d) return;
    const dy = Math.max(0, d.from + e.clientY - d.y);
    const flick = e.clientY - d.y > 40 && e.timeStamp - d.t < 250;
    const still = reduced();
    if (dy > Math.max(120, el.offsetHeight * 0.3) || flick) {
      el.style.transition = still ? "none" : "transform 180ms var(--ease-out)";
      el.style.transform = "translateY(100%)";
      window.setTimeout(onClose, still ? 0 : 160);
    } else {
      el.style.transition = still ? "none" : "transform var(--dur-base) var(--ease-out)";
      el.style.transform = "translateY(0)";
    }
  };
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (!(e.target as HTMLElement).closest(".sheet-grab")) return;
      const el = e.currentTarget;
      const from = Math.max(0, offsetOf(el));
      el.style.animation = "none";
      el.style.transition = "none";
      el.style.transform = `translateY(${from}px)`;
      drags.set(el, { y: e.clientY, from, t: e.timeStamp });
      el.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const d = drags.get(e.currentTarget);
      if (d) e.currentTarget.style.transform = `translateY(${Math.max(0, d.from + e.clientY - d.y)}px)`;
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
}
