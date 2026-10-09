import { describe, expect, it } from "vitest";
import { checkInDue, exercisesWithData, nextCheckIn, strengthChange, topSeries, topValue, weekCells, weekStats, type HistSet, type HistWorkout } from "./stats";
import { average, effectOf, reasonFor, recommend, suggestDeload } from "./review";

const W = (id: string, d: string): HistWorkout => ({ id, planned_date: d });
const S = (w: string, slug: string, n: number, kg: number | null, reps: number | null, secs: number | null = null, variant: string | null = null): HistSet => ({
  workout_id: w, exercise_slug: slug, set_number: n, weight_kg: kg, reps, seconds: secs, variant,
});

const workouts = [W("c", "2026-10-12"), W("a", "2026-10-05"), W("b", "2026-10-08")]; // deliberately unordered
const sets: HistSet[] = [
  S("a", "chest", 1, 25, 10), S("a", "chest", 2, 25, 10), S("a", "plank", 1, null, null, 30), S("a", "plank", 2, null, null, 30),
  S("b", "chest", 1, 27.5, 12), S("b", "chest", 2, 27.5, 12), S("b", "lat", 1, 30, 10),
  S("c", "chest", 1, 30, 8), S("c", "chest", 2, 30, 8), S("c", "plank", 1, null, null, 35), S("c", "plank", 2, null, null, 35), S("c", "back", 1, 0, 12),
];
const info = { chest: { kind: "weight" as const, group: "Chest" }, lat: { kind: "weight" as const, group: "Back" }, plank: { kind: "timed" as const, group: "Core" }, back: { kind: "bodyweight" as const, group: "Back" } };

describe("top series", () => {
  it("takes the top value per session, oldest first", () => {
    expect(topSeries(workouts, sets, "chest", "weight")).toEqual([
      { date: "2026-10-05", value: 25 }, { date: "2026-10-08", value: 27.5 }, { date: "2026-10-12", value: 30 },
    ]);
  });
  it("uses holds for planks and reps for bodyweight", () => {
    expect(topSeries(workouts, sets, "plank", "timed").map((p) => p.value)).toEqual([30, 35]);
    expect(topSeries(workouts, sets, "back", "bodyweight").map((p) => p.value)).toEqual([12]);
  });
  it("keeps only the last N sessions and ignores swapped-in backups", () => {
    expect(topSeries(workouts, sets, "chest", "weight", 2)).toHaveLength(2);
    expect(topSeries(workouts, [S("a", "chest", 1, 99, 5, null, "Backup")], "chest", "weight")).toEqual([]);
  });
  it("topValue", () => {
    expect(topValue("weight", [{ weight_kg: 20, reps: 10, seconds: null }, { weight_kg: 22.5, reps: 8, seconds: null }])).toBe(22.5);
    expect(topValue("weight", [])).toBe(0);
  });
  it("lists exercises with data, most-logged first", () => {
    expect(exercisesWithData(sets)).toEqual(["chest", "plank", "back", "lat"]);
  });
});

describe("week stats", () => {
  it("counts sessions and sets and groups sets by muscle", () => {
    const st = weekStats(workouts, sets, ["b", "c"], info);
    expect(st.sessions).toBe(2);
    expect(st.sets).toBe(8);
    expect(st.groupSets).toEqual({ Chest: 4, Back: 2, Core: 2 });
  });
  it("finds PBs against the previous session", () => {
    const st = weekStats(workouts, sets, ["b", "c"], info);
    const names = st.pbs.map((p) => `${p.workoutId}:${p.slug}`).sort();
    // b: chest 27.5 > 25 (PB), lat has no earlier session. c: chest 30 > 27.5 (PB), plank 35 > 30 (PB), back has no earlier session
    expect(names).toEqual(["b:chest", "c:chest", "c:plank"]);
  });
  it("is not a PB when nothing improved", () => {
    const flat = [S("a", "chest", 1, 25, 10), S("a", "chest", 2, 25, 10), S("b", "chest", 1, 25, 10), S("b", "chest", 2, 25, 9)];
    expect(weekStats([W("a", "2026-10-05"), W("b", "2026-10-08")], flat, ["b"], info).pbs).toEqual([]);
  });
});

describe("programme weeks", () => {
  it("marks done, now, and the check-ins still to come (design: week 3)", () => {
    const cells = weekCells(3);
    expect(cells.map((c) => c.cell)).toEqual(["done", "done", "now", "check", "todo", "todo", "todo", "check", "todo", "todo", "todo", "check"]);
  });
  it("turns a finished check-in week into done", () => {
    expect(weekCells(5, [4])[3].cell).toBe("done");
  });
  it("knows which check-in is next and when one is due", () => {
    expect(nextCheckIn(3, [])).toBe(4);
    expect(nextCheckIn(5, [4])).toBe(8);
    expect(nextCheckIn(12, [4, 8, 12])).toBeNull();
    expect(checkInDue(3, [])).toBeNull();
    expect(checkInDue(4, [])).toBe(4);
    expect(checkInDue(6, [4])).toBeNull();
    expect(checkInDue(9, [4])).toBe(8);
  });
  it("works out strength change", () => {
    expect(strengthChange([{ date: "a", value: 20 }, { date: "b", value: 30 }])).toEqual({ from: 20, to: 30, delta: 10 });
    expect(strengthChange([{ date: "a", value: 20 }])).toBeNull();
  });
});

describe("check-in recommendation (the design's three examples)", () => {
  it("week 4: low soreness, good energy -> keep building", () => {
    expect(recommend({ sessionsDone: 16, sessionsPlanned: 17, avgSoreness: 2.6, avgEnergy: 3.8 })).toBe("build");
  });
  it("week 8: soreness creeping up, energy dipping -> hold", () => {
    expect(recommend({ sessionsDone: 35, sessionsPlanned: 37, avgSoreness: 3.4, avgEnergy: 3.1 })).toBe("hold");
  });
  it("week 12: high soreness, low energy -> deload", () => {
    expect(recommend({ sessionsDone: 54, sessionsPlanned: 57, avgSoreness: 3.9, avgEnergy: 2.6 })).toBe("deload");
  });
  it("holds after a lot of missed sessions even if recovery is fine", () => {
    expect(recommend({ sessionsDone: 8, sessionsPlanned: 17, avgSoreness: 2, avgEnergy: 4 })).toBe("hold");
  });
  it("copes with no check-in data", () => {
    expect(recommend({ sessionsDone: 5, sessionsPlanned: 5, avgSoreness: null, avgEnergy: null })).toBe("build");
  });
  it("explains itself in plain words", () => {
    const i = { sessionsDone: 16, sessionsPlanned: 17, avgSoreness: 2.6, avgEnergy: 3.8 };
    expect(reasonFor("build", i)).toContain("16 of 17 sessions");
    expect(reasonFor("deload", i)).toContain("half the sets");
    expect(reasonFor("hold", { ...i, sessionsDone: 5 })).toContain("get the routine back");
  });
});

describe("what a choice does", () => {
  it("hold covers the next two weeks", () => {
    expect(effectOf("hold", 4)).toEqual({ holdWeeks: [5, 6], deloadWeeks: [] });
    expect(effectOf("hold", 12)).toEqual({ holdWeeks: [], deloadWeeks: [] });
  });
  it("deload makes the next week an easy one", () => {
    expect(effectOf("deload", 8)).toEqual({ holdWeeks: [], deloadWeeks: [9] });
    expect(effectOf("deload", 12).deloadWeeks).toEqual([]);
  });
  it("keep building changes nothing", () => {
    expect(effectOf("build", 4)).toEqual({ holdWeeks: [], deloadWeeks: [] });
  });
  it("averages ignoring blanks", () => {
    expect(average([2, 3, null, 3])).toBe(2.7);
    expect(average([null])).toBeNull();
  });
});

describe("deload every 6-8 weeks", () => {
  it("suggests one in weeks 6 to 8 when none has been taken", () => {
    expect(suggestDeload(5, [])).toBe(false);
    expect(suggestDeload(6, [])).toBe(true);
    expect(suggestDeload(8, [])).toBe(true);
    expect(suggestDeload(9, [])).toBe(false);
  });
  it("stops suggesting once one was taken recently", () => {
    expect(suggestDeload(7, [7])).toBe(false);
    expect(suggestDeload(7, [5])).toBe(false);
  });
});
