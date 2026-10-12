import { describe, expect, it } from "vitest";
import { buildBriefing, type BriefInput } from "./briefing";
import { goalProgress, goalUnit, recordNumber } from "./goals";
import { computeNudges, type NudgeInput } from "./nudges";
import { STRETCH_ROUTINE } from "./stretch";

const brief = (over: Partial<BriefInput> = {}): BriefInput => ({
  sessionName: "Push", minutes: 38, light: false, setup: false, deload: false, highSoreness: false,
  lifts: [
    { name: "Chest press", next: "Go up to 32.5 kg", up: true, first: false },
    { name: "Shoulder press", next: "Hold at 20 kg", up: false, first: false },
  ],
  cardio: { plan: "Bike or cross-trainer", label: "10 min", last: "10 min bike · Resistance 6 level" },
  feel: null, goal: null, ...over,
});

describe("Today briefing", () => {
  it("names the session, the time and the order", () => {
    const b = buildBriefing(brief());
    expect(b.headline).toBe("Push, about 38 min");
    expect(b.sub).toBe("Start with bike or cross-trainer (10 min), then 2 lifts.");
  });
  it("lists only the lifts that go up, as things to try", () => {
    expect(buildBriefing(brief()).tries).toEqual(["Chest press: go up to 32.5 kg"]);
  });
  it("in setup weeks asks for finding a weight instead of suggesting jumps", () => {
    const b = buildBriefing(brief({ setup: true }));
    expect(b.tries).toHaveLength(1);
    expect(b.tries[0]).toContain("Weeks 1 and 2");
  });
  it("adds care notes for deload, soreness, low energy, last cardio and the goal, capped at four", () => {
    const b = buildBriefing(brief({ deload: true, light: true, highSoreness: true, feel: { soreness: 5, energy: 1 }, goal: { name: "Leg press", toGo: "10 kg" } }));
    expect(b.notes).toHaveLength(4);
    expect(b.notes[0]).toContain("Deload");
  });
  it("calls out a first-time lift", () => {
    const b = buildBriefing(brief({ lifts: [{ name: "Seated leg press", next: "No suggestion yet", up: false, first: true }] }));
    expect(b.tries[0]).toContain("First time on Seated leg press");
  });
});

const nin = (over: Partial<NudgeInput> = {}): NudgeInput => ({
  week: 6, setup: false, inDeload: false, deloadSuggested: false, stalls: [], feel: [], nextSession: "2026-10-14",
  nextSessionLight: false, answered: new Set(), ...over,
});

describe("plan nudges", () => {
  it("offers nothing when nothing is wrong", () => {
    expect(computeNudges(nin())).toEqual([]);
  });
  it("offers a lighter session after two sore check-ins in a row", () => {
    const n = computeNudges(nin({ feel: [{ soreness: 4, energy: 3 }, { soreness: 5, energy: 3 }] }));
    expect(n[0]).toMatchObject({ kind: "tired", key: "tired:w6", payload: { date: "2026-10-14" } });
  });
  it("offers it after two drained check-ins too, but not when the next session is already light", () => {
    expect(computeNudges(nin({ feel: [{ soreness: 1, energy: 2 }, { soreness: 1, energy: 1 }] }))[0].kind).toBe("tired");
    expect(computeNudges(nin({ feel: [{ soreness: 5, energy: 1 }, { soreness: 5, energy: 1 }], nextSessionLight: true }))).toEqual([]);
  });
  it("suggests a deload only when one is suggested and not already on", () => {
    expect(computeNudges(nin({ deloadSuggested: true }))[0]).toMatchObject({ kind: "deload", payload: { week: 6 } });
    expect(computeNudges(nin({ deloadSuggested: true, inDeload: true }))).toEqual([]);
  });
  it("turns a stalled lift into a smaller weight jump, never in setup weeks", () => {
    const stalls = [{ slug: "chest", name: "Chest press", title: "Same 30 kg for 3 sessions", tip: "One more rep earns the jump.", smallKg: 1 }];
    expect(computeNudges(nin({ stalls }))[0]).toMatchObject({ kind: "stalled", key: "stalled:chest:w6", payload: { slug: "chest", kg: 1 } });
    expect(computeNudges(nin({ stalls, setup: true }))).toEqual([]);
  });
  it("hides answered nudges and shows at most two", () => {
    const stalls = ["a", "b", "c"].map((s) => ({ slug: s, name: s, title: "t", tip: "t", smallKg: 1 }));
    expect(computeNudges(nin({ stalls }))).toHaveLength(2);
    expect(computeNudges(nin({ stalls, answered: new Set(["stalled:a:w6", "stalled:b:w6"]) })).map((n) => n.key)).toEqual(["stalled:c:w6"]);
  });
});

describe("goals", () => {
  it("measures a goal by the number that fits the exercise", () => {
    expect(goalUnit("weight")).toBe("kg");
    expect(goalUnit("timed")).toBe("s");
    expect(goalUnit("bodyweight")).toBe("reps");
    expect(recordNumber("weight", { kg: 80, reps: 8, secs: null })).toBe(80);
    expect(recordNumber("timed", { kg: null, reps: null, secs: 45 })).toBe(45);
    expect(recordNumber("bodyweight", { kg: null, reps: 14, secs: null })).toBe(14);
  });
  it("computes progress, what is left, and reaching it", () => {
    expect(goalProgress(60, 80, 100)).toEqual({ fraction: 0.5, toGo: 20, reached: false });
    expect(goalProgress(60, 100, 100)).toMatchObject({ fraction: 1, reached: true, toGo: 0 });
    expect(goalProgress(60, 50, 100).fraction).toBe(0);
  });
});

describe("stretch routine", () => {
  it("is about ten minutes of simple moves", () => {
    expect(STRETCH_ROUTINE.length).toBeGreaterThanOrEqual(6);
    for (const m of STRETCH_ROUTINE) expect(m.how.length).toBeGreaterThan(10);
  });
});
