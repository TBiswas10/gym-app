"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { classifySwipe, neighbourTab, rubberband } from "@/lib/tabs";

// Swipe left/right to move between tabs; pull down at the top to refresh.
// The page follows the finger 1:1 (rubber-banding at the ends), then eases back or goes.
// Drags that start in a field or in anything that scrolls sideways (chip rows, charts) are left alone.
function leaveAlone(el: Element | null): boolean {
  for (let n: Element | null = el; n && n.tagName !== "BODY"; n = n.parentElement) {
    if (n.matches("input, textarea, select, [data-no-swipe]")) return true;
    if (n.scrollWidth > n.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true;
  }
  return false;
}

function scrollParent(el: Element | null): Element | null {
  for (let n: Element | null = el; n; n = n.parentElement) if (n.classList.contains("scroll")) return n;
  return null;
}

export function SwipeTabs({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const host = useRef<HTMLDivElement>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let sx = 0, sy = 0, lx = 0, lt = 0, vx = 0;
    let mode: "idle" | "pending" | "h" | "v" | "skip" = "idle";
    let top = false;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const move = (x: number, y: number, animate: boolean) => {
      el.style.transition = animate && !reduce ? "transform var(--dur-base) var(--ease-out)" : "none";
      el.style.transform = x || y ? `translate3d(${x}px,${y}px,0)` : "";
    };

    const start = (e: TouchEvent) => {
      const here = pathRef.current;
      if (e.touches.length !== 1 || (neighbourTab(here, 1) === null && neighbourTab(here, -1) === null)) {
        mode = "skip";
        return;
      }
      const t = e.touches[0];
      sx = lx = t.clientX;
      sy = t.clientY;
      lt = e.timeStamp;
      vx = 0;
      mode = leaveAlone(e.target as Element) ? "skip" : "pending";
      const sp = scrollParent(e.target as Element);
      top = !sp || sp.scrollTop <= 0;
      el.style.transition = "none";
    };

    const onMove = (e: TouchEvent) => {
      if (mode === "idle" || mode === "skip") return;
      const t = e.touches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (mode === "pending") {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; // hysteresis before choosing a direction
        mode = Math.abs(dx) > Math.abs(dy) * 1.5 ? "h" : top && dy > 0 ? "v" : "skip";
      }
      const dt = e.timeStamp - lt;
      if (dt > 0) vx = (t.clientX - lx) / dt;
      lx = t.clientX;
      lt = e.timeStamp;
      if (mode === "h") {
        const atEdge = (dx < 0 && neighbourTab(pathRef.current, 1) === null) || (dx > 0 && neighbourTab(pathRef.current, -1) === null);
        move(atEdge ? rubberband(dx) : dx, 0, false);
      } else if (mode === "v") {
        move(0, rubberband(dy, 844, 0.35), false);
      }
    };

    const end = (e: TouchEvent) => {
      const was = mode;
      mode = "idle";
      if (was !== "h" && was !== "v") return;
      const t = e.changedTouches[0];
      const result = classifySwipe(t.clientX - sx, t.clientY - sy, e.timeStamp - lt < 80 ? vx : 0, top);
      const target = result === "next" ? neighbourTab(pathRef.current, 1) : result === "prev" ? neighbourTab(pathRef.current, -1) : null;
      move(0, 0, true);
      if (target) router.push(target);
      else if (result === "refresh") router.refresh();
    };

    const cancel = () => {
      mode = "idle";
      move(0, 0, true);
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", cancel);
    };
  }, [router]);

  return (
    <div ref={host} className="swipe-host">
      {children}
    </div>
  );
}
