// The state of an active workout and every change you can make to it. Pure functions: each takes the
// current state and returns the next one. `diffOps(a, b)` then works out what the server must do to
// move from a to b, so undo is just diffOps(next, previous). No clock, no network.

import { adjustParam, cleanParams, initialParams, MACHINES, type Feel, type MachineId, type Params } from "./cardio";
import type { Entry } from "./parser";
import { finalSets } from "./parser";
import type { ExerciseKind } from "./plan";
import { prefill, type LastTime, type Spec, type Stall } from "./progression";
import type { Op, Source } from "./ops";

export type Status = "todo" | "done" | "skipped";

export interface SetVal {
  id: string;
  kg: number | null;
  reps: number | null;
  secs: number | null;
}

export interface ExStep {
  kind: "ex";
  slug: string;
  name: string;
  backup: string;
  exKind: ExerciseKind;
  range: [number, number];
  stall?: Stall | null;
  planned: number;
  step: number;
  increment: number;
  last: LastTime | null;
  sets: SetVal[];
  status: Status;
  swapped: boolean;
  notes: string;
  light: boolean;
  // stepper values
  kg: number;
  reps: number;
  secs: number;
}
export interface SimpleStep {
  kind: "warm" | "cardio" | "cool";
  status: Status;
}
export type Step = ExStep | SimpleStep;

/** An exercise logged by chat that is not in today's plan ("Also logged"). */
export interface ExtraEx {
  slug: string;
  name: string;
  exKind: ExerciseKind;
  sets: SetVal[];
}

export interface CardioState {
  id: string;
  machine: MachineId;
  params: Record<MachineId, Params>;
  feel: Feel | null;
  logged: boolean;
}

export interface WState {
  workoutId: string;
  steps: Step[];
  cur: number;
  editIdx: number; // which logged set is being edited, or -1
  cardio: CardioState;
  extras: ExtraEx[];
  loggedOn: string; // Sydney date used for cardio entries
}

const isEx = (s: Step): s is ExStep => s.kind === "ex";
export const exSpec = (e: ExStep): Spec => ({ kind: e.exKind, repLo: e.range[0], repHi: e.range[1], step: e.step, increment: e.increment });

// ---------------------------------------------------------------- building the first state

export interface InitExercise {
  slug: string;
  name: string;
  kind: ExerciseKind;
  repLo: number;
  repHi: number;
  sets: number; // planned (already halved on a deload week)
  step: number;
  increment: number;
  last: LastTime | null;
  stall?: Stall | null;
  startWeightKg: number | null;
  notes: string;
  backup: string;
  logged: SetVal[];
  variant: string | null; // backup name if it was swapped
}
export interface WorkoutInit {
  workoutId: string;
  loggedOn: string;
  light: boolean;
  setup: boolean;
  highSoreness: boolean;
  hold: boolean; // chose Hold at a check-in
  exercises: InitExercise[];
  skipped: string[];
  cardio: {
    machine: MachineId;
    plannedMinutes: number;
    lastParams: Partial<Record<MachineId, Params>>;
    logged: { id: string; kind: MachineId; params: Params; feel: Feel | null } | null;
    newId: string;
  };
  extras: ExtraEx[];
}

export function buildState(init: WorkoutInit): WState {
  // The lifts come first, then cardio to finish, then the optional cool-down (owner decision: cardio at the end).
  const c = init.cardio;
  const steps: Step[] = [];

  for (const e of init.exercises) {
    const spec: Spec = { kind: e.kind, repLo: e.repLo, repHi: e.repHi, step: e.step, increment: e.increment };
    const swapped = !!e.variant;
    const pre = prefill(spec, swapped ? null : e.last, { startWeightKg: e.startWeightKg, light: init.light, ctx: { setup: init.setup, highSoreness: init.highSoreness, hold: init.hold } });
    const lastSet = e.logged[e.logged.length - 1];
    steps.push({
      kind: "ex", slug: e.slug, name: e.name, backup: e.backup, exKind: e.kind, range: [e.repLo, e.repHi], planned: e.sets,
      step: e.step, increment: e.increment, last: e.last, stall: swapped ? null : e.stall ?? null, sets: e.logged,
      status: e.logged.length >= e.sets ? "done" : init.skipped.includes(e.slug) ? "skipped" : "todo",
      swapped, notes: e.notes, light: pre.light && !swapped,
      kg: lastSet ? (lastSet.kg ?? 0) : pre.kg,
      reps: lastSet ? (lastSet.reps ?? pre.reps) : pre.reps,
      secs: lastSet ? (lastSet.secs ?? pre.secs) : pre.secs,
    });
  }

  const params = {} as Record<MachineId, Params>;
  for (const m of MACHINES) {
    params[m.id] = initialParams(m.id, { last: c.logged?.kind === m.id ? c.logged.params : c.lastParams[m.id] ?? null, plannedMinutes: m.id === c.machine ? c.plannedMinutes : null });
  }
  steps.push({ kind: "cardio", status: c.logged ? "done" : "todo" });
  steps.push({ kind: "cool", status: "todo" });

  const state: WState = {
    workoutId: init.workoutId,
    steps,
    cur: 0,
    editIdx: -1,
    cardio: { id: c.logged?.id ?? c.newId, machine: c.logged?.kind ?? c.machine, params, feel: c.logged?.feel ?? null, logged: !!c.logged },
    extras: init.extras,
    loggedOn: init.loggedOn,
  };
  const first = steps.findIndex((s) => s.status === "todo");
  state.cur = first === -1 ? steps.length - 1 : first;
  return state;
}

// ---------------------------------------------------------------- helpers

export const currentStep = (s: WState): Step => s.steps[s.cur];
export const exercises = (s: WState): ExStep[] => s.steps.filter(isEx);
const cardioIndex = (s: WState): number => s.steps.findIndex((x) => x.kind === "cardio");

/** Next step that still has something to do, after `from`. Falls back to the last step. */
export function nextIndex(steps: Step[], from: number): number {
  for (let i = from + 1; i < steps.length; i++) if (steps[i].status === "todo") return i;
  return steps.length - 1;
}

const replaceStep = (s: WState, i: number, patch: Partial<ExStep> | Partial<SimpleStep>): WState => ({
  ...s,
  steps: s.steps.map((x, k) => (k === i ? ({ ...x, ...patch } as Step) : x)),
});

const stepperToSet = (e: ExStep, id: string): SetVal =>
  e.exKind === "timed" ? { id, kg: null, reps: null, secs: e.secs } : { id, kg: e.exKind === "bodyweight" && !e.kg ? 0 : e.kg, reps: e.reps, secs: null };

const setToStepper = (e: ExStep, v: SetVal): Partial<ExStep> =>
  e.exKind === "timed" ? { secs: v.secs ?? e.secs } : { kg: v.kg ?? 0, reps: v.reps ?? e.reps };

// ---------------------------------------------------------------- steppers

export function adjust(s: WState, field: "kg" | "reps" | "secs", dir: 1 | -1): WState {
  const e = currentStep(s);
  if (!isEx(e)) return s;
  if (field === "kg") return replaceStep(s, s.cur, { kg: Math.max(0, Math.round((e.kg + dir * e.step) * 100) / 100) });
  if (field === "reps") return replaceStep(s, s.cur, { reps: Math.max(0, e.reps + dir) });
  return replaceStep(s, s.cur, { secs: Math.max(5, e.secs + dir * 5) });
}

/** Type a number straight into the weight / reps / seconds box. */
export function setValue(s: WState, field: "kg" | "reps" | "secs", value: number): WState {
  const e = currentStep(s);
  if (!isEx(e) || !Number.isFinite(value)) return s;
  if (field === "kg") return replaceStep(s, s.cur, { kg: Math.min(400, Math.max(0, Math.round(value * 100) / 100)) });
  if (field === "reps") return replaceStep(s, s.cur, { reps: Math.min(100, Math.max(0, Math.round(value))) });
  return replaceStep(s, s.cur, { secs: Math.min(600, Math.max(5, Math.round(value))) });
}

/** Add a weight jump on top of what's showing (the "+2.5" chip). */
export function addKg(s: WState, delta: number): WState {
  const e = currentStep(s);
  return isEx(e) ? setValue(s, "kg", e.kg + delta) : s;
}

/** Put last session's numbers (first set) back in the boxes. */
export function restoreLast(s: WState): WState {
  const e = currentStep(s);
  if (!isEx(e) || !e.last) return s;
  if (e.exKind === "timed") return replaceStep(s, s.cur, { secs: e.last.secs[0] ?? e.secs });
  return replaceStep(s, s.cur, { kg: e.last.kg ?? e.kg, reps: e.last.reps[0] ?? e.reps });
}

// ---------------------------------------------------------------- sets

/** Log the next set from the steppers. */
export function logSet(s: WState, id: string): WState {
  const e = currentStep(s);
  if (!isEx(e) || e.sets.length >= e.planned) return s;
  const sets = [...e.sets, stepperToSet(e, id)];
  // Going back to a skipped exercise and logging it: it is no longer skipped, and a finished one shows a tick.
  const status = sets.length >= e.planned ? "done" : e.status === "skipped" ? "todo" : e.status;
  return replaceStep(s, s.cur, { sets, status });
}

export function startEdit(s: WState, index: number): WState {
  const e = currentStep(s);
  if (!isEx(e) || !e.sets[index]) return s;
  return { ...replaceStep(s, s.cur, setToStepper(e, e.sets[index])), editIdx: index };
}

export function cancelEdit(s: WState): WState {
  const e = currentStep(s);
  if (!isEx(e)) return { ...s, editIdx: -1 };
  const last = e.sets[e.sets.length - 1];
  return { ...(last ? replaceStep(s, s.cur, setToStepper(e, last)) : s), editIdx: -1 };
}

/** Update the set being edited with the steppers (keeps its id). */
export function updateSet(s: WState): WState {
  const e = currentStep(s);
  if (!isEx(e) || !e.sets[s.editIdx]) return s;
  const sets = e.sets.map((v, i) => (i === s.editIdx ? stepperToSet(e, v.id) : v));
  const last = sets[sets.length - 1];
  return { ...replaceStep(s, s.cur, { sets, ...setToStepper(e, last) }), editIdx: -1 };
}

export function deleteSet(s: WState): WState {
  const e = currentStep(s);
  if (!isEx(e) || !e.sets[s.editIdx]) return s;
  const sets = e.sets.filter((_, i) => i !== s.editIdx);
  const last = sets[sets.length - 1];
  const next = replaceStep(s, s.cur, {
    sets,
    status: e.status === "done" && sets.length < e.planned ? "todo" : e.status,
    ...(last ? setToStepper(e, last) : {}),
  });
  return { ...next, editIdx: -1 };
}

// ---------------------------------------------------------------- steps

export function advance(s: WState): WState {
  const done = replaceStep(s, s.cur, { status: s.steps[s.cur].status === "todo" ? "done" : s.steps[s.cur].status });
  return { ...done, cur: nextIndex(done.steps, s.cur), editIdx: -1 };
}

export function goTo(s: WState, i: number): WState {
  return i >= 0 && i < s.steps.length ? { ...s, cur: i, editIdx: -1 } : s;
}

export function skip(s: WState): WState {
  const next = replaceStep(s, s.cur, { status: "skipped" });
  return { ...next, cur: nextIndex(next.steps, s.cur), editIdx: -1 };
}

/**
 * Do a lift sooner or later: swap it with the neighbouring lift. Cardio and the cool-down stay at the end.
 * The current step stays the current step wherever it lands.
 */
export function moveExercise(s: WState, i: number, dir: -1 | 1): WState {
  const j = i + dir;
  const a = s.steps[i];
  const b = s.steps[j];
  if (!a || !b || a.kind !== "ex" || b.kind !== "ex") return s;
  const steps = [...s.steps];
  steps[i] = b;
  steps[j] = a;
  const cur = s.cur === i ? j : s.cur === j ? i : s.cur;
  return { ...s, steps, cur, editIdx: s.editIdx };
}

/**
 * "Wrap up" at 50:00: every lift still to do is skipped. You land on cardio if it is still to do (it can be shortened
 * or skipped there), otherwise on the cool-down.
 */
export function wrapUp(s: WState): WState {
  const steps = s.steps.map((x) => (x.kind === "ex" && x.status === "todo" ? ({ ...x, status: "skipped" } as Step) : x));
  const cardio = steps.findIndex((x) => x.kind === "cardio" && x.status === "todo");
  return { ...s, steps, cur: cardio >= 0 ? cardio : steps.length - 1, editIdx: -1 };
}

/** Machine busy? Swap to the backup exercise (starts with no history, no sets); swapping back undoes it. */
export function swap(s: WState): WState {
  const e = currentStep(s);
  if (!isEx(e)) return s;
  return replaceStep(s, s.cur, { swapped: !e.swapped, sets: [], status: "todo", editIdx: -1 } as Partial<ExStep>);
}

export const setNotes = (s: WState, notes: string): WState => {
  const e = currentStep(s);
  return isEx(e) ? replaceStep(s, s.cur, { notes }) : s;
};

// ---------------------------------------------------------------- chat quick log

/** Apply a confirmed quick-log entry: replaces that exercise's sets. New ids come from the caller. */
export function applyEntry(s: WState, entry: Entry, planned: number, ids: string[]): WState {
  const sets: SetVal[] = finalSets(entry, planned).map((v, i) => ({ id: ids[i], kg: v.kg, reps: v.reps, secs: v.secs }));
  const idx = s.steps.findIndex((x) => isEx(x) && x.slug === entry.slug);
  if (idx >= 0) {
    const e = s.steps[idx] as ExStep;
    const last = sets[sets.length - 1];
    const next = replaceStep(s, idx, {
      sets,
      swapped: false,
      status: sets.length >= e.planned && idx !== s.cur ? "done" : e.status === "skipped" ? "todo" : e.status,
      ...setToStepper(e, last),
    });
    return { ...next, editIdx: -1 };
  }
  const extras = s.extras.some((x) => x.slug === entry.slug)
    ? s.extras.map((x) => (x.slug === entry.slug ? { ...x, sets } : x))
    : [...s.extras, { slug: entry.slug, name: entry.name, exKind: entry.kind, sets }];
  return { ...s, extras };
}

/** "Edit" on a quick-log card: open that exercise with the typed numbers in the steppers (nothing is saved). */
export function loadEntryIntoSteppers(s: WState, entry: Entry): WState {
  const idx = s.steps.findIndex((x) => isEx(x) && x.slug === entry.slug);
  if (idx < 0) return s;
  const e = s.steps[idx] as ExStep;
  const patch: Partial<ExStep> = e.exKind === "timed" ? { secs: entry.secs[0] ?? e.secs } : { kg: entry.kg ?? e.kg, reps: entry.reps[0] ?? e.reps };
  return { ...replaceStep(s, idx, patch), cur: idx, editIdx: -1 };
}

// ---------------------------------------------------------------- cardio

export const chooseMachine = (s: WState, machine: MachineId): WState => ({ ...s, cardio: { ...s.cardio, machine } });
export const adjustCardio = (s: WState, key: string, dir: 1 | -1): WState => ({
  ...s,
  cardio: { ...s.cardio, params: { ...s.cardio.params, [s.cardio.machine]: adjustParam(s.cardio.machine, s.cardio.params[s.cardio.machine], key, dir) } },
});
export const setCardioMinutes = (s: WState, minutes: number): WState => ({
  ...s,
  cardio: { ...s.cardio, params: { ...s.cardio.params, [s.cardio.machine]: { ...s.cardio.params[s.cardio.machine], min: minutes } } },
});
export const sameAsLast = (s: WState, last: Params): WState => ({
  ...s,
  cardio: { ...s.cardio, params: { ...s.cardio.params, [s.cardio.machine]: initialParams(s.cardio.machine, { last }) } },
});
export const setFeel = (s: WState, feel: Feel): WState => ({ ...s, cardio: { ...s.cardio, feel } });

/** "Cardio done": records the block and moves on. */
export function finishCardio(s: WState): WState {
  const logged = { ...s, cardio: { ...s.cardio, logged: true } };
  return advance(logged);
}

// ---------------------------------------------------------------- what the server must do

const positionOf = (s: WState, slug: string): number => {
  const i = exercises(s).findIndex((e) => e.slug === slug);
  if (i >= 0) return i + 1;
  return 100 + Math.max(0, s.extras.findIndex((x) => x.slug === slug));
};

interface Row {
  slug: string;
  variant: string | null;
  sets: SetVal[];
}
const rows = (s: WState): Row[] => [
  ...exercises(s).map((e) => ({ slug: e.slug, variant: e.swapped ? e.backup : null, sets: e.sets })),
  ...s.extras.map((x) => ({ slug: x.slug, variant: null, sets: x.sets })),
];
const sameVal = (a: SetVal, b: SetVal): boolean => a.id === b.id && a.kg === b.kg && a.reps === b.reps && a.secs === b.secs;

/** Operations that move the server from state `a` to state `b`. Undo is diffOps(b, a). */
export function diffOps(a: WState, b: WState, source: Source = "app"): Op[] {
  const ops: Op[] = [];
  const before = new Map(rows(a).map((r) => [r.slug, r]));
  for (const r of rows(b)) {
    const old = before.get(r.slug);
    const n = Math.max(r.sets.length, old?.sets.length ?? 0);
    for (let i = 0; i < n; i++) {
      const now = r.sets[i];
      const was = old?.sets[i];
      if (now) {
        if (!was || !sameVal(now, was) || old?.variant !== r.variant) {
          if (was && was.id !== now.id) ops.push({ t: "delset", workoutId: b.workoutId, slug: r.slug, n: i + 1 });
          ops.push({ t: "set", id: now.id, workoutId: b.workoutId, slug: r.slug, position: positionOf(b, r.slug), n: i + 1, variant: r.variant, kg: now.kg, reps: now.reps, secs: now.secs, source });
        }
      } else if (was) {
        ops.push({ t: "delset", workoutId: b.workoutId, slug: r.slug, n: i + 1 });
      }
    }
  }
  // Exercises that disappeared entirely from b (extras removed on undo).
  const now = new Set(rows(b).map((r) => r.slug));
  for (const [slug, old] of before) {
    if (now.has(slug)) continue;
    old.sets.forEach((_, i) => ops.push({ t: "delset", workoutId: b.workoutId, slug, n: i + 1 }));
  }

  const skips = (s: WState) => exercises(s).filter((e) => e.status === "skipped").map((e) => e.slug);
  const sa = skips(a), sb = skips(b);
  if (sa.join() !== sb.join()) ops.push({ t: "skips", workoutId: b.workoutId, slugs: sb });

  const ca = a.cardio, cb = b.cardio;
  if (cb.logged) {
    const params = cleanParams(cb.machine, cb.params[cb.machine]);
    const changed = !ca.logged || ca.machine !== cb.machine || ca.feel !== cb.feel || JSON.stringify(cleanParams(ca.machine, ca.params[ca.machine])) !== JSON.stringify(params);
    if (changed) ops.push({ t: "cardio", id: cb.id, workoutId: b.workoutId, kind: cb.machine, minutes: params.min ?? 1, params, feel: cb.feel, loggedOn: b.loggedOn });
  } else if (ca.logged) {
    ops.push({ t: "delcardio", id: cb.id });
  }
  return ops;
}

/** Sets logged in this session (for the header and the complete screen). */
export const totalSets = (s: WState): number => exercises(s).reduce((n, e) => n + e.sets.length, 0) + s.extras.reduce((n, x) => n + x.sets.length, 0);

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const sameKey = (x: Step): string => (x.kind === "ex" ? `ex:${x.slug}` : x.kind);

function wellFormedStep(st: unknown): st is Step {
  if (!st || typeof st !== "object") return false;
  const x = st as Record<string, unknown>;
  if (typeof x.status !== "string" || typeof x.kind !== "string") return false;
  if (x.kind === "ex") {
    return (
      typeof x.slug === "string" && typeof x.name === "string" && typeof x.backup === "string" && typeof x.exKind === "string" &&
      Array.isArray(x.range) && x.range.length === 2 && x.range.every(isNum) &&
      isNum(x.planned) && x.planned >= 1 && Array.isArray(x.sets) && isNum(x.kg) && isNum(x.reps) && isNum(x.secs) && typeof x.swapped === "boolean"
    );
  }
  return x.kind === "warm" || x.kind === "cardio" || x.kind === "cool";
}

/**
 * Take the state saved on the phone only when it still fits the session the server just described.
 * A copy from an older version of the app, a plan that changed since, or a half-written save must never break the
 * screen: any doubt and the server's copy is used instead. Sets the server already has that the phone lacks are kept
 * (another device, or Claude, logged them).
 */
export function restoreState(saved: unknown, fresh: WState): WState | null {
  if (!saved || typeof saved !== "object") return null;
  const s = saved as WState;
  if (s.workoutId !== fresh.workoutId || !Array.isArray(s.steps) || s.steps.length !== fresh.steps.length) return null;
  if (!s.steps.every(wellFormedStep)) return null;
  if (!Number.isInteger(s.cur) || s.cur < 0 || s.cur >= s.steps.length) return null;
  if (!s.cardio || typeof s.cardio !== "object" || !s.cardio.params || typeof s.cardio.machine !== "string") return null;
  if (typeof s.loggedOn !== "string" || !Array.isArray(s.extras)) return null;
  // Same exercises (the order may differ: you can reorder lifts here).
  const a = s.steps.map(sameKey).sort().join("|");
  const b = fresh.steps.map(sameKey).sort().join("|");
  if (a !== b) return null;

  const freshBySlug = new Map(fresh.steps.filter((x): x is ExStep => x.kind === "ex").map((x) => [x.slug, x]));
  const steps = s.steps.map((st) => {
    if (st.kind !== "ex") return st;
    const f = freshBySlug.get(st.slug);
    return f && f.sets.length > st.sets.length ? { ...st, sets: f.sets, status: f.status } : st;
  });
  const cur = steps[s.cur];
  const editOk = Number.isInteger(s.editIdx) && s.editIdx >= 0 && cur?.kind === "ex" && s.editIdx < cur.sets.length;
  return { ...s, steps, editIdx: editOk ? s.editIdx : -1 };
}
