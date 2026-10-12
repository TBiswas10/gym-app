// Goals: one target per exercise (top weight in kg, longest hold in seconds, or best bodyweight reps).

import type { ExerciseKind } from "./plan";

export type GoalUnit = "kg" | "s" | "reps";

export const goalUnit = (kind: ExerciseKind): GoalUnit => (kind === "timed" ? "s" : kind === "bodyweight" ? "reps" : "kg");

/** The single number a record is measured by for a goal. */
export function recordNumber(kind: ExerciseKind, v: { kg: number | null; reps: number | null; secs: number | null }): number {
  if (kind === "timed") return v.secs ?? 0;
  if (kind === "bodyweight" && !(v.kg && v.kg > 0)) return v.reps ?? 0;
  return v.kg ?? 0;
}

export interface GoalProgress {
  /** 0 to 1 */
  fraction: number;
  toGo: number;
  reached: boolean;
}

export function goalProgress(start: number, current: number, target: number): GoalProgress {
  const reached = current >= target;
  if (reached) return { fraction: 1, toGo: 0, reached: true };
  const span = target - start;
  const fraction = span <= 0 ? 0 : Math.min(1, Math.max(0, (current - start) / span));
  return { fraction, toGo: Math.round((target - current) * 10) / 10, reached: false };
}
