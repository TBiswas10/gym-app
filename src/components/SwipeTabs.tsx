"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { classifySwipe, neighbourTab, rubberband } from "@/lib/tabs";

// Swipe left/right to move between tabs, like paging in an iPhone app: the page follows the finger 1:1, a flick
// throws it off the edge at the speed you let go, and the next tab slides in from the other side.
// Pull down at the top to refresh. Drags that start in a field or in anything that scrolls sideways are left alone.
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)"; // --ease-out
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
  // Which side the next page enters from (+1 = right), set when a swipe commits.
  const entering = useRef<0 | 1 | -1>(0);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // The new tab has arrived: start it just off the edge and slide it in.
  useLayoutEffect(() => {
    const el = host.current;
    const side = entering.current;
    if (!el || side === 0) return;
    entering.current = 0;
    el.style.transition = "none";
    el.style.transform = `translate3d(${side * el.offsetWidth}px,0,0)`;
    void el.offsetWidth; // commit the start position before animating
    el.style.transition = `transform 300ms ${EASE}`;
    el.style.transform = "";
  }, [path]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let sx = 0, sy = 0, lx = 0, lt = 0, vx = 0;
    let mode: "idle" | "pending" | "h" | "v" | "skip" = "idle";
    let top = false;

    const move = (x: number, y: number, ms = 0) => {
      el.style.transition = ms && !reduce.current ? `transform ${ms}ms ${EASE}` : "none";
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
      el.style.transition = "none"; // a drag can grab a page that is still settling
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
      if (dt > 0) vx = 0.7 * ((t.clientX - lx) / dt) + 0.3 * vx; // smoothed px/ms
      lx = t.clientX;
      lt = e.timeStamp;
      if (mode === "h") {
        const atEdge = (dx < 0 && neighbourTab(pathRef.current, 1) === null) || (dx > 0 && neighbourTab(pathRef.current, -1) === null);
        move(atEdge ? rubberband(dx) : dx, 0);
      } else if (mode === "v") {
        move(0, rubberband(dy, 844, 0.35));
      }
    };

    const end = (e: TouchEvent) => {
      const was = mode;
      mode = "idle";
      if (was !== "h" && was !== "v") return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      const velocity = e.timeStamp - lt < 100 ? vx : 0;
      const result = classifySwipe(dx, dy, velocity, top);
      const target = result === "next" ? neighbourTab(pathRef.current, 1) : result === "prev" ? neighbourTab(pathRef.current, -1) : null;
      if (!target) {
        move(0, 0, 320); // not far enough: settle back
        if (result === "refresh") router.refresh();
        return;
      }
      const dir = result === "next" ? -1 : 1; // next tab: this page leaves to the left
      const w = el.offsetWidth;
      if (reduce.current) {
        move(0, 0);
        router.push(target);
        return;
      }
      // Carry the finger's speed: the faster the flick, the quicker it leaves.
      const ms = Math.round(Math.min(260, Math.max(110, (w - Math.abs(dx)) / Math.max(Math.abs(velocity), 0.9))));
      move(dir * w, 0, ms);
      entering.current = (-dir) as 1 | -1;
      router.push(target);
      // If the new tab is slow to arrive, don't leave a blank screen.
      const from = pathRef.current;
      window.setTimeout(() => {
        if (pathRef.current === from && entering.current !== 0) {
          entering.current = 0;
          move(0, 0, 250);
        }
      }, 900);
    };

    const cancel = () => {
      mode = "idle";
      move(0, 0, 250);
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
