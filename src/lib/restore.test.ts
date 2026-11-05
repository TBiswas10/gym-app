import { describe, expect, it } from "vitest";
import { counts, missingRows, parseBackup } from "./restore";

const W = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";
const set = { id: S, workout_id: W, exercise_slug: "chest", position: 1, set_number: 1, variant: null, weight_kg: 30, reps: 10, seconds: null, source: "app", logged_at: "2026-10-05T01:10:00Z", user_id: "someone-else" };
const workout = { id: W, planned_date: "2026-10-05", week: 1, plan_type: "5day", weekday: 1, day_name: "Push", is_light: false, started_at: "2026-10-05T01:00:00Z", ended_at: "2026-10-05T01:40:00Z", notes: null, skipped_exercises: [], status: "completed", is_test: false };
const base = (over: object = {}) => ({ app: "workout-tracker", version: 1, workouts: [workout], sets: [set], cardio_entries: [], checkins: [], ...over });

describe("restore from a backup", () => {
  it("keeps good rows, drops the account id and anything unusable", () => {
    const bad = { ...set, id: "33333333-3333-4333-8333-333333333333", set_number: 3 };
    const orphan = { ...set, id: "44444444-4444-4444-8444-444444444444", workout_id: "55555555-5555-4555-8555-555555555555" };
    const p = parseBackup(JSON.stringify(base({ sets: [set, bad, orphan] })));
    expect(p.ok && counts(p.rows)).toEqual({ sessions: 1, sets: 1, cardio: 0, checkins: 0 });
    expect(p.ok && p.skipped).toBe(2);
    expect(p.ok && "user_id" in p.rows.sets[0]).toBe(false);
  });
  it("leaves out unfinished sessions", () => {
    const p = parseBackup(JSON.stringify(base({ workouts: [{ ...workout, status: "in_progress" }] })));
    expect(p.ok && counts(p.rows).sessions).toBe(0);
  });
  it("refuses files that are not backups", () => {
    expect(parseBackup("nope").ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: "other", version: 1 })).ok).toBe(false);
  });
  it("only adds what the account does not have", () => {
    const p = parseBackup(JSON.stringify(base()));
    if (!p.ok) throw new Error("parse");
    const have = { workouts: new Set([W]), sets: new Set<string>(), cardio_entries: new Set<string>(), checkins: new Set<string>() };
    expect(counts(missingRows(p.rows, have))).toEqual({ sessions: 0, sets: 1, cardio: 0, checkins: 0 });
  });
});
