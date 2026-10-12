import { describe, expect, it } from "vitest";
import { validateOp } from "./ops-validate";

const W = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";
const set = { t: "set", id: S, workoutId: W, slug: "chest", position: 1, n: 1, variant: null, kg: 30, reps: 12, secs: null, source: "app" };

describe("validateOp", () => {
  it("accepts a well-formed set", () => {
    expect(validateOp(set)).toEqual(set);
  });
  it("accepts a timed set, a delete, skips, notes, cardio and finish", () => {
    expect(validateOp({ ...set, slug: "plank", kg: null, reps: null, secs: 35 })).not.toBeNull();
    expect(validateOp({ t: "delset", workoutId: W, slug: "chest", n: 2 })).not.toBeNull();
    expect(validateOp({ t: "skips", workoutId: W, slugs: ["lat", "lat", "row"] })).toEqual({ t: "skips", workoutId: W, slugs: ["lat", "row"] });
    expect(validateOp({ t: "notes", slug: "chest", notes: "  Seat 3  " })).toEqual({ t: "notes", slug: "chest", notes: "Seat 3" });
    expect(validateOp({ t: "cardio", id: S, workoutId: W, kind: "bike", minutes: 10, params: { res: 5, rpm: 70, min: 10 }, feel: "easy", loggedOn: "2026-10-08" })).not.toBeNull();
    expect(validateOp({ t: "delcardio", id: S })).not.toBeNull();
    expect(validateOp({ t: "finish", workoutId: W, endedAt: new Date().toISOString() })).not.toBeNull();
  });
  it("rejects junk, wrong types and unknown operations", () => {
    for (const bad of [null, 5, "x", [], {}, { t: "drop table" }, { t: 4 }]) expect(validateOp(bad)).toBeNull();
  });
  it("rejects bad ids and slugs (no injection through names)", () => {
    expect(validateOp({ ...set, id: "nope" })).toBeNull();
    expect(validateOp({ ...set, workoutId: "1; delete from sets" })).toBeNull();
    expect(validateOp({ ...set, slug: "chest'; --" })).toBeNull();
    expect(validateOp({ ...set, slug: "Chest" })).toBeNull();
  });
  it("enforces the limits (2 sets, sane weights, reps and times)", () => {
    expect(validateOp({ ...set, n: 3 })).toBeNull();
    expect(validateOp({ ...set, n: 0 })).toBeNull();
    expect(validateOp({ ...set, kg: 401 })).toBeNull();
    expect(validateOp({ ...set, kg: -1 })).toBeNull();
    expect(validateOp({ ...set, reps: 101 })).toBeNull();
    expect(validateOp({ ...set, reps: 10.5 })).toBeNull();
    expect(validateOp({ ...set, secs: 4000, reps: null })).toBeNull();
    expect(validateOp({ ...set, position: 0 })).toBeNull();
    expect(validateOp({ ...set, kg: NaN })).toBeNull();
    expect(validateOp({ ...set, kg: "30" })).toBeNull();
  });
  it("needs reps or seconds, and a known source", () => {
    expect(validateOp({ ...set, reps: null, secs: null })).toBeNull();
    expect(validateOp({ ...set, source: "mcp" })).toBeNull();
    expect(validateOp({ ...set, variant: "x".repeat(61) })).toBeNull();
  });
  it("only takes known cardio machines, fields and ranges", () => {
    const c = { t: "cardio", id: S, workoutId: W, kind: "bike", minutes: 10, params: { res: 5 }, feel: null, loggedOn: "2026-10-08" };
    expect(validateOp(c)).not.toBeNull();
    expect(validateOp({ ...c, kind: "jetski" })).toBeNull();
    expect(validateOp({ ...c, minutes: 0 })).toBeNull();
    expect(validateOp({ ...c, minutes: 181 })).toBeNull();
    expect(validateOp({ ...c, params: { evil: 1 } })).toBeNull();
    expect(validateOp({ ...c, params: { res: "5" } })).toBeNull();
    expect(validateOp({ ...c, feel: "awful" })).toBeNull();
    expect(validateOp({ ...c, loggedOn: "yesterday" })).toBeNull();
  });
  it("rejects finish times in the future or long ago", () => {
    expect(validateOp({ t: "finish", workoutId: W, endedAt: new Date(Date.now() + 3_600_000).toISOString() })).toBeNull();
    expect(validateOp({ t: "finish", workoutId: W, endedAt: "2020-01-01T00:00:00Z" })).toBeNull();
    expect(validateOp({ t: "finish", workoutId: W, endedAt: "not a date" })).toBeNull();
  });
  it("rejects over-long notes and skip lists", () => {
    expect(validateOp({ t: "notes", slug: "chest", notes: "x".repeat(201) })).toBeNull();
    expect(validateOp({ t: "skips", workoutId: W, slugs: Array(31).fill("lat") })).toBeNull();
  });
});

describe("validateOp checkin", () => {
  const base = { t: "checkin", workoutId: "11111111-1111-4111-8111-111111111111", soreness: 3, energy: 4, notes: " felt ok ", bodyweightKg: 80.04, checkedOn: "2026-10-12" };
  it("accepts a check-in and tidies the notes and weight", () => {
    expect(validateOp(base)).toMatchObject({ t: "checkin", soreness: 3, energy: 4, notes: "felt ok", bodyweightKg: 80 });
  });
  it("accepts a partial check-in but not an empty one", () => {
    expect(validateOp({ ...base, soreness: null, bodyweightKg: null })).not.toBeNull();
    expect(validateOp({ ...base, soreness: null, energy: null, notes: "  ", bodyweightKg: null })).toBeNull();
  });
  it("rejects out-of-range and malformed values", () => {
    expect(validateOp({ ...base, soreness: 6 })).toBeNull();
    expect(validateOp({ ...base, energy: 0 })).toBeNull();
    expect(validateOp({ ...base, bodyweightKg: 5 })).toBeNull();
    expect(validateOp({ ...base, checkedOn: "yesterday" })).toBeNull();
    expect(validateOp({ ...base, workoutId: "nope" })).toBeNull();
    expect(validateOp({ ...base, notes: "x".repeat(501) })).toBeNull();
  });
});
