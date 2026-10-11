import { fmtNum } from "../../format";
import { isMachine, machineById, type MachineId } from "../../cardio";
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

/** Machine numbers with their names and units, e.g. { Resistance: "5 level", Cadence: "70 rpm" }. Time is left out (it is `minutes`). */
export function cardioSettings(kind: string, params: unknown): Record<string, string> {
  if (!isMachine(kind) || !params || typeof params !== "object") return {};
  const out: Record<string, string> = {};
  for (const p of machineById(kind as MachineId).params) {
    if (p.k === "min") continue;
    const v = (params as Record<string, unknown>)[p.k];
    if (typeof v === "number") out[p.label] = `${fmtNum(v)} ${p.unit.split(",")[0]}`.trim();
  }
  return out;
}

/** "10 min bike · Resistance 5 level, Cadence 70 rpm (moderate)" */
export function cardioLine(c: { kind: string; minutes: number; feel?: string | null; params?: unknown }): string {
  const s = Object.entries(cardioSettings(c.kind, c.params)).map(([k, v]) => `${k} ${v}`).join(", ");
  return `${c.minutes} min ${c.kind}${s ? ` · ${s}` : ""}${c.feel ? ` (${c.feel})` : ""}`;
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
