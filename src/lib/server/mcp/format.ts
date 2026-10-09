import { fmtNum } from "../../format";
import type { ExerciseKind } from "../../plan";
import type { LastTime, Suggestion } from "../../progression";

export interface SetLike {
  weight_kg: number | null;
  reps: number | null;
  seconds: number | null;
}

/** "30 kg × 12", "bodyweight × 12", "35 s" */
export function setLine(kind: ExerciseKind, s: SetLike): string {
  if (kind === "timed") return `${s.seconds ?? 0} s`;
  return `${s.weight_kg ? `${fmtNum(s.weight_kg)} kg` : "bodyweight"} × ${s.reps ?? 0}`;
}

export function lastTimeLine(kind: ExerciseKind, last: LastTime | null): string | null {
  if (!last) return null;
  if (kind === "timed") return last.secs.map((v) => `${v} s`).join(", ");
  return last.reps.map((r) => `${last.kg ? `${fmtNum(last.kg)} kg` : "bodyweight"} × ${r}`).join(", ");
}

/** What to do next time, in one line. */
export function nextLine(kind: ExerciseKind, s: Suggestion): string {
  if (s.reason === "no-history") return "No suggestion yet";
  if (kind === "timed") return s.action === "up" ? `Try ${s.secs} s` : `Hold at ${s.secs ?? "the same"} s`;
  if (kind === "bodyweight" && s.action === "up") return `Try adding ${fmtNum(s.kg ?? 0)} kg`;
  return s.action === "up" ? `Go up to ${fmtNum(s.kg ?? 0)} kg` : `Hold at ${s.kg ? `${fmtNum(s.kg)} kg` : "bodyweight"}`;
}

/** Compact JSON for the read tools: models read it well and it stays short. */
export const json = (value: unknown): string => JSON.stringify(value, null, 1);

export const textResult = (text: string) => ({ content: [{ type: "text" as const, text }] });
export const errorResult = (text: string) => ({ isError: true as const, content: [{ type: "text" as const, text }] });
