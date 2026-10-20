import { describe, expect, it } from "vitest";
import {
  addKg, moveExercise, adjust, adjustCardio, advance, applyEntry, buildState, cancelEdit, chooseMachine, currentStep, deleteSet, diffOps, exercises,
  finishCardio, goTo, logSet, nextIndex, sameAsLast, setFeel, setNotes, skip, startEdit, setValue, swap, totalSets, updateSet, restoreLast, wrapUp, restoreState,
  type ExStep, type InitExercise, type SetVal, type WState, type WorkoutInit,
} from "./workout-state";
import type { Entry } from "./parser";

const W = "w-1";
const ex = (slug: string, name: string, over: Partial<InitExercise> = {}): InitExercise => ({
  slug, name, kind: "weight", repLo: 8, repHi: 12, sets: 2, step: 2.5, increment: 2.5,
  last: { kg: 30, reps: [12, 12], secs: [] }, startWeightKg: null, notes: "", backup: `${name} backup`, logged: [], variant: null, ...over,
});
const init = (over: Partial<WorkoutInit> = {}): WorkoutInit => ({
  workoutId: W, loggedOn: "2026-10-08", light: false, setup: false, highSoreness: false, hold: false,
  exercises: [ex("chest", "Chest press"), ex("lat", "Lat pulldown", { last: { kg: 35, reps: [10, 11], secs: [] } }), ex("plank", "Plank", { kind: "timed", repLo: 20, repHi: 40, step: 5, increment: 5, last: { kg: null, reps: [], secs: [30, 30] } })],
  skipped: [],
  cardio: { machine: "bike", plannedMinutes: 10, lastParams: { bike: { res: 6, rpm: 75, min: 9 } }, logged: null, newId: "c-1" },
  extras: [],
  ...over,
});
const fresh = (over?: Partial<WorkoutInit>): WState => buildState(init(over));
const ex0 = (s: WState, slug: string) => exercises(s).find((e) => e.slug === slug) as ExStep;

/** The session opens on the first lift (cardio comes at the end). */
const start = (s = fresh()) => s;

describe("building the first state", () => {
  it("starts on the first lift, with cardio and the cool-down last", () => {
    const s = fresh();
    expect(s.steps.map((x) => x.kind)).toEqual(["ex", "ex", "ex", "cardio", "cool"]);
    expect(currentStep(s).kind).toBe("ex");
    expect(s.steps.every((x) => x.status === "todo")).toBe(true);
  });
  it("steps up the weight when the top of the range was hit on both sets last time", () => {
    const s = fresh();
    expect(ex0(s, "chest")).toMatchObject({ kg: 32.5, reps: 10 });
    expect(ex0(s, "lat")).toMatchObject({ kg: 35, reps: 10 }); // [10, 11]: hold
    expect(ex0(s, "plank").secs).toBe(30);
  });
  it("holds everything in setup weeks, uses the weight you found, and lightens on a light day", () => {
    expect(ex0(fresh({ setup: true }), "chest").kg).toBe(30);
    expect(ex0(buildState(init({ exercises: [ex("chest", "Chest press", { last: null, startWeightKg: 25 })] })), "chest").kg).toBe(25);
    expect(ex0(fresh({ light: true }), "chest")).toMatchObject({ kg: 25, light: true }); // 32.5 * 0.8 = 26 -> 25
  });
  it("resumes where you left off", () => {
    const s = buildState(init({ exercises: [ex("chest", "Chest press", { logged: [{ id: "a", kg: 32.5, reps: 10, secs: null }, { id: "b", kg: 32.5, reps: 9, secs: null }] }), ex("lat", "Lat pulldown")], skipped: [] }));
    expect(s.steps[0].status).toBe("done"); // chest was finished
    expect(s.steps[2].status).toBe("todo"); // cardio (at the end) was not logged yet
    expect(currentStep(s)).toMatchObject({ kind: "ex", slug: "lat" });
  });
  it("marks skipped exercises", () => {
    expect(buildState(init({ skipped: ["lat"] })).steps[1].status).toBe("skipped");
  });
});

describe("logging sets", () => {
  it("logs the steppers as set 1 then set 2, and ignores a third", () => {
    let s = start();
    s = adjust(s, "kg", 1);
    s = adjust(s, "reps", -1);
    s = logSet(s, "s1");
    expect(ex0(s, "chest").sets).toEqual([{ id: "s1", kg: 35, reps: 9, secs: null }]);
    s = logSet(s, "s2");
    s = logSet(s, "s3");
    expect(ex0(s, "chest").sets).toHaveLength(2);
  });
  it("sends the right operation, and undo is the exact reverse", () => {
    const a = start();
    const b = logSet(a, "s1");
    expect(diffOps(a, b)).toEqual([{ t: "set", id: "s1", workoutId: W, slug: "chest", position: 1, n: 1, variant: null, kg: 32.5, reps: 10, secs: null, source: "app" }]);
    expect(diffOps(b, a)).toEqual([{ t: "delset", workoutId: W, slug: "chest", n: 1 }]);
  });
  it("logs timed holds as seconds", () => {
    let s = goTo(start(), 2);
    s = adjust(s, "secs", 1);
    s = logSet(s, "p1");
    expect(ex0(s, "plank").sets[0]).toEqual({ id: "p1", kg: null, reps: null, secs: 35 });
  });
  it("never lets the steppers go below zero (or below 5 s)", () => {
    let s = start();
    for (let i = 0; i < 30; i++) s = adjust(s, "kg", -1);
    expect(ex0(s, "chest").kg).toBe(0);
    s = goTo(s, 2);
    for (let i = 0; i < 20; i++) s = adjust(s, "secs", -1);
    expect(ex0(s, "plank").secs).toBe(5);
  });
});

describe("edit and delete", () => {
  const twoSets = () => logSet(logSet(start(), "s1"), "s2");
  it("edits a set in place and keeps its id", () => {
    const a = startEdit(twoSets(), 0);
    expect(a.editIdx).toBe(0);
    let b = adjust(adjust(a, "kg", 1), "reps", 1);
    b = updateSet(b);
    expect(ex0(b, "chest").sets[0]).toMatchObject({ id: "s1", kg: 35, reps: 11 });
    expect(b.editIdx).toBe(-1);
    expect(diffOps(twoSets(), b)).toEqual([expect.objectContaining({ t: "set", id: "s1", n: 1, kg: 35, reps: 11 })]);
  });
  it("cancel leaves the set alone", () => {
    const a = twoSets();
    const b = cancelEdit(adjust(startEdit(a, 0), "kg", 1));
    expect(ex0(b, "chest").sets).toEqual(ex0(a, "chest").sets);
    expect(b.editIdx).toBe(-1);
  });
  it("deletes a set, reopens a finished exercise, and undo brings it back", () => {
    let a = twoSets();
    a = advance(a);
    a = goTo(a, 0);
    expect(ex0(a, "chest").status).toBe("done");
    const b = deleteSet(startEdit(a, 1));
    expect(ex0(b, "chest").sets).toHaveLength(1);
    expect(ex0(b, "chest").status).toBe("todo");
    expect(diffOps(a, b)).toEqual([{ t: "delset", workoutId: W, slug: "chest", n: 2 }]);
    expect(diffOps(b, a)).toEqual([expect.objectContaining({ t: "set", id: "s2", n: 2 })]);
  });
});

describe("moving between steps", () => {
  it("advances to the next thing to do and marks the finished step done", () => {
    let s = fresh();
    s = advance(s);
    expect(s.cur).toBe(1);
    expect(s.steps[0].status).toBe("done");
    s = advance(s);
    expect(s.cur).toBe(2);
  });
  it("skips to the next todo step, and records the skip", () => {
    const a = start();
    const b = skip(a);
    expect(ex0(b, "chest").status).toBe("skipped");
    expect(currentStep(b)).toMatchObject({ slug: "lat" });
    expect(diffOps(a, b)).toEqual([{ t: "skips", workoutId: W, slugs: ["chest"] }]);
    expect(diffOps(b, a)).toEqual([{ t: "skips", workoutId: W, slugs: [] }]);
  });
  it("jumps from the checklist", () => {
    expect(goTo(fresh(), 2).cur).toBe(2);
    expect(goTo(fresh(), 99).cur).toBe(0);
  });
  it("nextIndex falls back to the last step", () => {
    const s = fresh();
    expect(nextIndex(s.steps.map((x) => ({ ...x, status: "done" as const })), 0)).toBe(s.steps.length - 1);
  });
  it("wraps up: skips lifts still to do and lands on cardio, then the cool-down (50:00)", () => {
    let s = start();
    s = advance(logSet(logSet(s, "a"), "b")); // chest done
    s = wrapUp(s);
    expect(ex0(s, "chest").status).toBe("done");
    expect(ex0(s, "lat").status).toBe("skipped");
    expect(ex0(s, "plank").status).toBe("skipped");
    expect(currentStep(s).kind).toBe("cardio"); // cardio is still to do: it can be shortened or skipped there
    const done = wrapUp(finishCardio(s));
    expect(currentStep(done).kind).toBe("cool");
  });
});

describe("swap", () => {
  it("clears sets (operations delete them) and swaps back", () => {
    const a = logSet(start(), "s1");
    const b = swap(a);
    expect(ex0(b, "chest")).toMatchObject({ swapped: true, sets: [], status: "todo" });
    expect(diffOps(a, b)).toEqual([{ t: "delset", workoutId: W, slug: "chest", n: 1 }]);
    expect(swap(b).steps[1]).toMatchObject({ swapped: false });
  });
  it("records the backup name against sets logged after a swap", () => {
    const s = logSet(swap(start()), "s9");
    expect(diffOps(swap(start()), s)[0]).toMatchObject({ t: "set", variant: "Chest press backup" });
  });
});

describe("notes", () => {
  it("keeps notes on the exercise", () => {
    expect(ex0(setNotes(start(), "Seat 3"), "chest").notes).toBe("Seat 3");
  });
});

describe("chat quick log", () => {
  const entry = (over: Partial<Entry>): Entry => ({ slug: "lat", name: "Lat pulldown", kind: "weight", kg: 35, reps: [10, 10], secs: [], total: 2, same: false, ...over });
  it("replaces an exercise's sets and marks it done when it is not the open one", () => {
    const a = start(); // chest is open
    const b = applyEntry(a, entry({}), 2, ["c1", "c2"]);
    expect(ex0(b, "lat")).toMatchObject({ status: "done", kg: 35, reps: 10 });
    expect(ex0(b, "lat").sets.map((v) => v.id)).toEqual(["c1", "c2"]);
    expect(diffOps(a, b, "chat")).toEqual([
      expect.objectContaining({ t: "set", id: "c1", slug: "lat", position: 2, n: 1, source: "chat" }),
      expect.objectContaining({ t: "set", id: "c2", n: 2, source: "chat" }),
    ]);
    expect(diffOps(b, a)).toEqual([expect.objectContaining({ t: "delset", slug: "lat", n: 1 }), expect.objectContaining({ t: "delset", n: 2 })]);
  });
  it("overwrites existing sets (delete then set when the id changes)", () => {
    const a = applyEntry(start(), entry({}), 2, ["c1", "c2"]);
    const b = applyEntry(a, entry({ reps: [11, 11] }), 2, ["d1", "d2"]);
    const ops = diffOps(a, b, "chat");
    expect(ops.filter((o) => o.t === "set")).toHaveLength(2);
    expect(ops.filter((o) => o.t === "delset")).toHaveLength(2);
  });
  it("trims to the planned sets", () => {
    const b = applyEntry(start(), entry({ reps: [12, 12, 10], total: 3 }), 2, ["c1", "c2"]);
    expect(ex0(b, "lat").sets).toHaveLength(2);
  });
  it("logs an exercise that is not in today's plan under 'Also logged'", () => {
    const a = start();
    const b = applyEntry(a, entry({ slug: "legpress", name: "Leg press", kg: 80 }), 2, ["e1", "e2"]);
    expect(b.extras).toHaveLength(1);
    expect(b.extras[0]).toMatchObject({ slug: "legpress", name: "Leg press" });
    expect(diffOps(a, b, "chat")[0]).toMatchObject({ t: "set", slug: "legpress", position: 100, kg: 80 });
    expect(totalSets(b)).toBe(2);
  });
  it("logs a timed hold", () => {
    const b = applyEntry(goTo(start(), 3), entry({ slug: "plank", name: "Plank", kind: "timed", kg: null, reps: [], secs: [30, 35] }), 2, ["p1", "p2"]);
    expect(ex0(b, "plank").sets.map((v) => v.secs)).toEqual([30, 35]);
  });
});

describe("cardio", () => {
  it("defaults to last time's numbers, and the planned minutes", () => {
    const s = fresh();
    expect(s.cardio.params.bike).toEqual({ res: 6, rpm: 75, min: 10 });
    expect(s.cardio.params.treadmill).toEqual({ speed: 5.5, incline: 3, min: 10 });
  });
  it("adjusts the chosen machine only, and 'same as last time' restores last numbers", () => {
    let s = chooseMachine(fresh(), "treadmill");
    s = adjustCardio(s, "speed", 1);
    expect(s.cardio.params.treadmill.speed).toBe(6);
    expect(s.cardio.params.bike.res).toBe(6);
    s = chooseMachine(s, "bike");
    s = adjustCardio(s, "res", 1);
    s = sameAsLast(s, { res: 6, rpm: 75, min: 9 });
    expect(s.cardio.params.bike).toEqual({ res: 6, rpm: 75, min: 9 });
  });
  it("logs the block when done, and undo removes it", () => {
    let a = setFeel(fresh(), "easy");
    a = goTo(a, 0);
    const b = finishCardio(a);
    expect(b.steps[0].status).toBe("done");
    expect(diffOps(a, b)).toEqual([{ t: "cardio", id: "c-1", workoutId: W, kind: "bike", minutes: 10, params: { res: 6, rpm: 75, min: 10 }, feel: "easy", loggedOn: "2026-10-08" }]);
    expect(diffOps(b, a)).toEqual([{ t: "delcardio", id: "c-1" }]);
  });
  it("does not send anything until cardio is done", () => {
    const a = fresh();
    expect(diffOps(a, adjustCardio(a, "res", 1))).toEqual([]);
  });
  it("re-sends the block if it changes after being logged", () => {
    const logged = finishCardio(goTo(fresh(), 4));
    const changed = setFeel(logged, "hard");
    expect(diffOps(logged, changed)).toEqual([expect.objectContaining({ t: "cardio", feel: "hard" })]);
  });
  it("counts total sets", () => {
    expect(totalSets(logSet(logSet(start(), "a"), "b"))).toBe(2);
  });
});

describe("typing numbers, +jump and last time", () => {
  it("types a weight, clamping and rounding", () => {
    const s = start();
    expect((currentStep(setValue(s, "kg", 37.5)) as ExStep).kg).toBe(37.5);
    expect((currentStep(setValue(s, "kg", -5)) as ExStep).kg).toBe(0);
    expect((currentStep(setValue(s, "kg", 9999)) as ExStep).kg).toBe(400);
    expect((currentStep(setValue(s, "reps", 10.6)) as ExStep).reps).toBe(11);
    expect((currentStep(setValue(s, "kg", NaN)) as ExStep).kg).toBe((currentStep(s) as ExStep).kg);
  });
  it("adds the jump on top of what's showing", () => {
    const s = start();
    const before = (currentStep(s) as ExStep).kg;
    expect((currentStep(addKg(s, 2.5)) as ExStep).kg).toBe(before + 2.5);
  });
  it("puts last session's numbers back", () => {
    const s = adjust(adjust(start(), "kg", 1), "reps", 1);
    const e = currentStep(restoreLast(s)) as ExStep;
    expect(e.kg).toBe(e.last?.kg);
    expect(e.reps).toBe(e.last?.reps[0]);
  });
});

describe("reordering and finishing a skipped lift", () => {
  it("moves a lift earlier or later without touching cardio or the cool-down", () => {
    const s = fresh();
    const names = (x: WState) => x.steps.map((t) => (t.kind === "ex" ? t.slug : t.kind));
    const before = names(s);
    const moved = moveExercise(s, 1, -1);
    expect(names(moved)[0]).toBe(before[1]);
    expect(names(moved)[1]).toBe(before[0]);
    expect(names(moved)[3]).toBe("cardio");
    expect(names(moveExercise(s, 0, -1))).toEqual(before); // nothing before the first lift: no move
    expect(names(moveExercise(s, 2, 1))).toEqual(before); // cardio is not a lift: the last lift stays put
    expect(names(moveExercise(s, s.steps.length - 2, 1))).toEqual(before); // cool-down is last
  });
  it("keeps the current step current after a move", () => {
    const s = goTo(fresh(), 1);
    const cur = currentStep(s);
    expect(currentStep(moveExercise(s, 1, -1))).toBe(cur);
  });
  it("a skipped lift that is finished later shows done, not skipped", () => {
    let s = start();
    s = skip(s); // skip the first lift
    const skippedSlug = (s.steps[0] as ExStep).slug;
    expect(s.steps[0].status).toBe("skipped");
    s = goTo(s, 0);
    s = logSet(logSet(s, "x1"), "x2");
    expect(s.steps.find((t) => t.kind === "ex" && t.slug === skippedSlug)?.status).toBe("done");
  });
});

describe("restoreState: the copy saved on the phone is only used when it still fits", () => {
  const exInit = (slug: string, logged: SetVal[] = []): InitExercise => ({
    slug, name: slug, kind: "weight", repLo: 8, repHi: 12, sets: 2, step: 2.5, increment: 2.5, last: null, startWeightKg: null, notes: "", backup: "x", logged, variant: null,
  });
  const init = (exercises: InitExercise[]): WorkoutInit => ({
    workoutId: "w", loggedOn: "2026-10-12", light: false, setup: false, highSoreness: false, hold: false, skipped: [], exercises, extras: [],
    cardio: { machine: "bike", plannedMinutes: 10, lastParams: {}, logged: null, newId: "c" },
  });
  const fresh = buildState(init([exInit("chest"), exInit("lat")]));
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

  it("keeps a valid saved state", () => {
    const saved = clone(fresh);
    expect(restoreState(saved, fresh)).toMatchObject({ workoutId: "w", cur: saved.cur });
  });
  it("rejects anything that is not this session", () => {
    expect(restoreState(null, fresh)).toBeNull();
    expect(restoreState("nope", fresh)).toBeNull();
    expect(restoreState({ ...clone(fresh), workoutId: "other" }, fresh)).toBeNull();
    expect(restoreState({ ...clone(fresh), steps: "x" }, fresh)).toBeNull();
  });
  it("rejects a state from a plan with different lifts or a different number of steps", () => {
    const other = buildState(init([exInit("chest"), exInit("legpress")]));
    expect(restoreState(clone(other), fresh)).toBeNull();
    const shorter = buildState(init([exInit("chest")]));
    expect(restoreState(clone(shorter), fresh)).toBeNull();
  });
  it("rejects a current step that does not exist", () => {
    expect(restoreState({ ...clone(fresh), cur: 99 }, fresh)).toBeNull();
    expect(restoreState({ ...clone(fresh), cur: -1 }, fresh)).toBeNull();
  });
  it("rejects a step with missing fields (an older version of the app)", () => {
    const broken = clone(fresh);
    const ex = broken.steps.find((s) => s.kind === "ex") as unknown as Record<string, unknown>;
    delete ex.range;
    expect(restoreState(broken, fresh)).toBeNull();
  });
  it("fixes an edit index that points nowhere", () => {
    expect(restoreState({ ...clone(fresh), editIdx: 5 }, fresh)?.editIdx).toBe(-1);
  });
  it("allows lifts to be reordered on the phone", () => {
    const saved = clone(fresh);
    const i = saved.steps.findIndex((s) => s.kind === "ex");
    [saved.steps[i], saved.steps[i + 1]] = [saved.steps[i + 1], saved.steps[i]];
    expect(restoreState(saved, fresh)).not.toBeNull();
  });
  it("keeps sets the server has that the phone does not (logged elsewhere, or by Claude)", () => {
    const withServerSet = buildState(init([exInit("chest", [{ id: "s1", kg: 30, reps: 12, secs: null }]), exInit("lat")]));
    const out = restoreState(clone(fresh), withServerSet)!;
    const chest = out.steps.find((s) => s.kind === "ex" && s.slug === "chest") as ExStep;
    expect(chest.sets).toHaveLength(1);
  });
});
