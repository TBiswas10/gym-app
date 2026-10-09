// Progression rules. Pure functions, no clock and no database.
//
// Rule: suggest a heavier weight ONLY when the top of the rep range is hit on BOTH sets; otherwise hold.
// Jump: +2.5 kg upper body, +5 kg legs (per-exercise default, editable), rounded to real steps
// (dumbbells 1-2 kg, machine stacks 2.5 or 5 kg). Weeks 1-2 are for finding weights, so they always hold.
// Soreness 4-5 for three sessions in a row also holds.

import type { ExerciseKind } from "./plan";

export interface LastTime {
  kg: number | null;
  reps: number[]; // per set
  secs: number[]; // per set (timed holds)
}

export interface Spec {
  kind: ExerciseKind;
  repLo: number;
  repHi: number;
  step: number; // rounding grid (kg)
  increment: number; // jump (kg, or seconds for timed holds)
}

export interface Context {
  setup?: boolean; // weeks 1-2
  highSoreness?: boolean;
  hold?: boolean; // you chose "Hold" at a week 4/8/12 check-in
}

export type Reason = "top-hit" | "below-top" | "setup" | "soreness" | "review" | "no-history";

export interface Suggestion {
  action: "up" | "hold";
  kg: number | null;
  secs: number | null;
  reason: Reason;
}

/** Round to the nearest multiple of step without floating point noise. */
export function roundToStep(value: number, step: number): number {
  return Math.round((Math.round(value / step) * step) * 100) / 100;
}

/** Both sets (the plan has two) reached the top of the range. */
export function bothAtTop(values: number[], top: number, sets = 2): boolean {
  return values.length >= sets && values.slice(0, sets).every((v) => v >= top);
}

export function suggestNext(spec: Spec, last: LastTime | null, ctx: Context = {}): Suggestion {
  if (!last) return { action: "hold", kg: null, secs: null, reason: "no-history" };
  const hold = (reason: Reason): Suggestion => ({
    action: "hold",
    kg: spec.kind === "timed" ? null : (last.kg ?? 0),
    secs: spec.kind === "timed" ? (last.secs[0] ?? null) : null,
    reason,
  });
  if (ctx.setup) return hold("setup");
  if (ctx.highSoreness) return hold("soreness");
  if (ctx.hold) return hold("review");

  if (spec.kind === "timed") {
    if (!bothAtTop(last.secs, spec.repHi)) return hold("below-top");
    return { action: "up", kg: null, secs: Math.max(spec.repHi, ...last.secs) + spec.increment, reason: "top-hit" };
  }
  if (!bothAtTop(last.reps, spec.repHi)) return hold("below-top");
  // Bodyweight lifts start adding load; weighted lifts step up from where they were.
  const base = last.kg ?? 0;
  return { action: "up", kg: roundToStep(base + spec.increment, spec.step), secs: null, reason: "top-hit" };
}

/** Reps to pre-fill after a weight increase (the design uses 10 for 8-12). */
export const repsAfterIncrease = (spec: Spec): number => Math.max(spec.repLo, Math.min(10, spec.repHi));

export interface Prefill {
  kg: number;
  reps: number;
  secs: number;
  light: boolean;
}

/** Numbers the steppers start on for an exercise. */
export function prefill(
  spec: Spec,
  last: LastTime | null,
  opts: { startWeightKg?: number | null; light?: boolean; ctx?: Context } = {},
): Prefill {
  const light = !!opts.light && spec.kind !== "timed" && spec.kind !== "bodyweight";
  if (spec.kind === "timed") {
    const s = suggestNext(spec, last, opts.ctx);
    return { kg: 0, reps: 0, secs: s.secs ?? 30, light: false };
  }
  if (!last) {
    const kg = opts.startWeightKg ?? (spec.kind === "bodyweight" ? 0 : 10);
    return { kg: light ? lighten(kg, spec.step) : kg, reps: spec.kind === "bodyweight" ? 10 : 10, secs: 0, light };
  }
  const s = suggestNext(spec, last, opts.ctx);
  if (spec.kind === "bodyweight") {
    // Bodyweight lifts stay bodyweight unless the top of the range was hit twice.
    return { kg: s.action === "up" ? (s.kg ?? 0) : (last.kg ?? 0), reps: s.action === "up" ? repsAfterIncrease(spec) : (last.reps[0] ?? 10), secs: 0, light: false };
  }
  const kg = s.kg ?? last.kg ?? 0;
  const reps = s.action === "up" ? repsAfterIncrease(spec) : (last.reps[0] ?? 10);
  return { kg: light ? lighten(kg, spec.step) : kg, reps, secs: 0, light };
}

/** "Go light": weights about 20% lighter, same reps, never below one step. */
export function lighten(kg: number, step: number): number {
  return Math.max(step, roundToStep(kg * 0.8, step));
}

export interface SetValue {
  kg: number | null;
  reps: number | null;
  secs: number | null;
}

/** A personal best against the last session: heavier, or the same weight for more reps; longer hold; more bodyweight reps. */
export function isPB(kind: ExerciseKind, last: LastTime | null, sets: SetValue[]): boolean {
  if (!last || sets.length === 0) return false;
  if (kind === "timed") return sets.some((s) => (s.secs ?? 0) > Math.max(0, ...last.secs));
  const bestReps = Math.max(0, ...last.reps);
  if (kind === "bodyweight") return sets.some((s) => (s.reps ?? 0) > bestReps && !(s.kg && s.kg > 0));
  const lastKg = last.kg ?? 0;
  return sets.some((s) => (s.kg ?? 0) > lastKg || ((s.kg ?? 0) === lastKg && (s.reps ?? 0) > bestReps));
}

export interface Verdict {
  up: boolean;
  title: string;
  sub: string;
}

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** The line shown under a finished exercise ("Next time try 37.5 kg" / "Hold this weight"). */
export function verdict(spec: Spec, sets: SetValue[], ctx: Context = {}): Verdict {
  const timed = spec.kind === "timed";
  const values = sets.map((s) => (timed ? (s.secs ?? 0) : (s.reps ?? 0)));
  const top = bothAtTop(values, spec.repHi, 2);
  const anyLow = values.some((v) => v < spec.repLo);
  const unit = timed ? " s" : "";

  if (ctx.setup) {
    return { up: false, title: "Hold this weight", sub: "Stay here for the first two weeks and focus on smooth reps." };
  }
  if (top && ctx.hold) {
    return { up: false, title: "Hold this weight", sub: `You hit ${spec.repHi}${unit} on both sets. You chose to hold at your check-in, so same weight for now.` };
  }
  if (top && ctx.highSoreness) {
    return { up: false, title: "Hold this weight", sub: `You hit ${spec.repHi}${unit} on both sets, but soreness has been high. Hold for now.` };
  }
  if (top) {
    const last = sets[0];
    if (timed) {
      return { up: true, title: `Next time try ${Math.max(spec.repHi, ...values) + spec.increment} s`, sub: `You held ${spec.repHi} s on both sets. Great work.` };
    }
    if (spec.kind === "bodyweight") {
      return { up: true, title: `Next time try adding ${fmt(spec.increment)} kg`, sub: `You hit ${spec.repHi} on both sets. Great work.` };
    }
    return { up: true, title: `Next time try ${fmt(roundToStep((last.kg ?? 0) + spec.increment, spec.step))} kg`, sub: `You hit ${spec.repHi} on both sets. Great work.` };
  }
  if (timed) return { up: false, title: "Hold this time", sub: `Build to ${spec.repHi} s on both sets, then add ${fmt(spec.increment)} s.` };
  return {
    up: false,
    title: "Hold this weight",
    sub: anyLow ? `Reps dipped below ${spec.repLo}. Same weight next time.` : `Build to ${spec.repHi} on both sets, then go up.`,
  };
}

/** Soreness 4-5 for three sessions in a row (most recent last). */
export function highSoreness(recent: number[], sessions = 3): boolean {
  return recent.length >= sessions && recent.slice(-sessions).every((s) => s >= 4);
}

export interface Stall {
  sessions: number;
  kg: number;
  title: string;
  tip: string;
}

/**
 * Same weight for 3 sessions in a row without ever hitting the top of the range on both sets = stalled.
 * `recent` is newest first. This only adds advice; the "up only when both sets hit the top" rule is unchanged.
 */
export function stallCheck(spec: { kind: ExerciseKind; repLo: number; repHi: number; step: number }, recent: LastTime[]): Stall | null {
  if (spec.kind !== "weight" || recent.length < 3) return null;
  const three = recent.slice(0, 3);
  const kg = three[0].kg;
  if (!kg || three.some((s) => s.kg !== kg || s.reps.length < 2)) return null;
  if (three.some((s) => s.reps.every((r) => r >= spec.repHi))) return null; // it earned a jump at some point
  const best = Math.max(...three.map((s) => Math.min(...s.reps)));
  const small = spec.step > 1 ? 1 : spec.step;
  const tip =
    best >= spec.repHi - 1
      ? `One more rep on each set earns the jump. If it stays stuck, a small step of ${fmtKg(small)} kg is fine.`
      : `Aim for ${spec.repHi} reps on both sets before adding weight. If you can’t, try ${fmtKg(Math.max(0, kg - spec.step))} kg for a week and build back up.`;
  return { sessions: 3, kg, title: `Same ${fmtKg(kg)} kg for 3 sessions`, tip };
}

const fmtKg = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
