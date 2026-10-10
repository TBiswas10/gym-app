/** 0..1 for a ring: how much of the plan is done. Over-achieving stops at a full ring; no plan means empty. */
export function ringFraction(done: number, planned: number): number {
  if (!Number.isFinite(done) || !Number.isFinite(planned) || planned <= 0) return 0;
  return Math.max(0, Math.min(1, done / planned));
}

/** Circumference of a ring with radius r (for stroke-dasharray). */
export const circumference = (r: number): number => 2 * Math.PI * r;
