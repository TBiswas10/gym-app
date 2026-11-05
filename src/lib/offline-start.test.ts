import { describe, expect, it } from "vitest";
import { validateOp } from "./ops-validate";
import { hasPendingStart, startOp, startedNow } from "./offline-start";
import type { WorkoutPage } from "./server/workout-data";

const page = { meta: { workoutId: "11111111-1111-4111-8111-111111111111", sessionName: "Push", startedAt: "2026-11-05T01:00:00.000Z", start: { plannedDate: "2026-11-05", weekday: 4, week: 3, planType: "5day", light: false } } } as unknown as WorkoutPage;

describe("starting a workout with no signal", () => {
  it("sets the start time to the moment you start and builds one start operation", () => {
    const now = new Date();
    const op = startOp(startedNow(page, now));
    expect(op).toMatchObject({ t: "start", workoutId: page.meta.workoutId, plannedDate: "2026-11-05", weekday: 4, week: 3, planType: "5day", dayName: "Push", light: false, startedAt: now.toISOString() });
  });
  it("has no start operation for a session the server already has", () => {
    expect(startOp({ meta: { ...page.meta, start: undefined } } as unknown as WorkoutPage)).toBeNull();
  });
  it("knows when a start is still waiting in the queue", () => {
    const op = startOp(startedNow(page, new Date()))!;
    expect(hasPendingStart([op])).toBe(true);
    expect(hasPendingStart([])).toBe(false);
  });
  it("accepts a good start and rejects bad ones", () => {
    const op = startOp(startedNow(page, new Date()))!;
    expect(validateOp(op)).toMatchObject({ t: "start" });
    expect(validateOp({ ...op, weekday: 9 })).toBeNull();
    expect(validateOp({ ...op, workoutId: "nope" })).toBeNull();
    expect(validateOp({ ...op, startedAt: "2020-01-01T00:00:00Z" })).toBeNull();
    expect(validateOp({ ...op, planType: "7day" })).toBeNull();
  });
});
