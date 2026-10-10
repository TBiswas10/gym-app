/** How many whole steps a vertical drag of `dy` px (up is negative) is worth, at `pxPerStep` px per step. */
export function scrubSteps(dy: number, pxPerStep = 18): number {
  const n = Math.trunc(-dy / pxPerStep);
  return Object.is(n, -0) ? 0 : n;
}
