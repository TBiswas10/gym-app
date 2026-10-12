// The four main tabs, in the order you swipe through them.
export const TABS = [
  { href: "/", label: "Today", icon: "calendar" },
  { href: "/progress", label: "Progress", icon: "chart" },
  { href: "/library", label: "Library", icon: "book" },
  { href: "/plan", label: "Plan", icon: "list-checks" },
] as const;

export function tabIndex(path: string): number {
  if (path === "/") return 0;
  return TABS.findIndex((t) => t.href !== "/" && path.startsWith(t.href));
}

/** True for the four tab screens themselves, not their sub-pages (a guide, the change log, a session). */
export function isTabRoot(path: string): boolean {
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return TABS.some((t) => t.href === p);
}

/**
 * The tab a swipe leads to: dir +1 = next (swipe left), -1 = previous (swipe right). null at the ends, off the tabs,
 * and on sub-pages: there a sideways swipe should go back (EdgeBack), not jump to another tab.
 */
export function neighbourTab(path: string, dir: 1 | -1): string | null {
  if (!isTabRoot(path)) return null;
  const i = tabIndex(path);
  if (i < 0) return null;
  return TABS[i + dir]?.href ?? null;
}

/** How far (px of finger travel) you pull down before letting go refreshes. */
export const PULL_THRESHOLD = 90;

export type SwipeResult = "next" | "prev" | "refresh" | "none";

/** Decide what a finished drag means. dx/dy in px (positive = right/down), vx = horizontal px/ms. */
export function classifySwipe(dx: number, dy: number, vx: number, atTop: boolean): SwipeResult {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax > ay * 1.5 && (ax > 80 || (ax > 30 && Math.abs(vx) > 0.5))) return dx < 0 ? "next" : "prev";
  if (atTop && dy > PULL_THRESHOLD && ay > ax * 1.5) return "refresh";
  return "none";
}

/** Rubber band: the further past the edge, the less it follows. */
export function rubberband(over: number, dimension = 390, c = 0.55): number {
  return (over * dimension * c) / (dimension + c * Math.abs(over));
}
