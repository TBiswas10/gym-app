// Session length and display helpers. Sessions are capped at 45-50 min. Cardio comes first and IS the warm-up.
// Estimate rule: 5 min per exercise (3 for plank) plus the cardio block.
// The optional cool-down does not count.

export const CAP_MIN = 50;
export const LIGHT_FACTOR = 0.8; // "Go light": weights about 20% lighter, same reps
const LIGHT_LIFT_TIME = 0.85; // lifts take a little less time on a light day

export type ExerciseKind = "weight" | "timed" | "bodyweight";

export function liftMinutes(kinds: ExerciseKind[], light = false): number {
  const base = kinds.reduce((sum, k) => sum + (k === "timed" ? 3 : 5), 0);
  return Math.round(base * (light ? LIGHT_LIFT_TIME : 1));
}

export function estimateMinutes(kinds: ExerciseKind[], cardioMinutes: number, light = false): number {
  return liftMinutes(kinds, light) + cardioMinutes;
}

export const overCap = (minutes: number): boolean => minutes > CAP_MIN;

/** "2 × 8–12" or, for timed holds, "2 × 20–40 s". */
export function formatTarget(sets: number, lo: number, hi: number, kind: ExerciseKind): string {
  return `${sets} × ${lo}–${hi}${kind === "timed" ? " s" : ""}`;
}

/** "6 exercises · 2 sets each" */
export const countLine = (n: number): string => `${n} exercise${n === 1 ? "" : "s"} · 2 sets each`;
