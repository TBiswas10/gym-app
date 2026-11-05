import { describe, expect, it } from "vitest";
import { applyOps } from "./apply-ops";
import { startOp, startedNow } from "../offline-start";
import type { Op } from "../ops";
import type { WorkoutPage } from "./workout-data";

// A recording stand-in for the database: every call is noted, every call succeeds (or fails with `code` for one table).
function fake(fail?: { table: string; code: string }) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const chain = (table: string): unknown =>
    new Proxy(() => undefined, {
      get: (_t, k) =>
        k === "then"
          ? (res: (v: unknown) => void) => res({ error: fail && fail.table === table ? { code: fail.code } : null, data: null })
          : (...args: unknown[]) => {
              calls.push({ table, method: String(k), args });
              return chain(table);
            },
    });
  return { client: { from: (t: string) => chain(t) } as never, calls };
}

const W = "11111111-1111-4111-8111-111111111111";
const page = { meta: { workoutId: W, sessionName: "Push", startedAt: new Date().toISOString(), start: { plannedDate: "2026-11-05", weekday: 4, week: 3, planType: "5day", light: false } } } as unknown as WorkoutPage;
const set = (n: number): Op => ({ t: "set", id: `2222222${n}-2222-4222-8222-222222222222`, workoutId: W, slug: "chest", position: 1, n, variant: null, kg: 30, reps: 10, secs: null, source: "app" });

describe("sending a session that was started offline", () => {
  it("creates the session first, then its sets, then finishes it, in that order", async () => {
    const { client, calls } = fake();
    const ops: Op[] = [startOp(startedNow(page, new Date()))!, set(1), set(2), { t: "finish", workoutId: W, endedAt: new Date().toISOString() }];
    const r = await applyOps(client, ops);
    expect(r).toEqual({ done: 4, retry: false, dropped: 0 });
    expect(calls.map((c) => `${c.table}.${c.method}`).filter((x) => !x.endsWith(".eq"))).toEqual(["workouts.upsert", "sets.upsert", "sets.upsert", "workouts.update"]);
    const start = calls[0].args[0] as Record<string, unknown>;
    expect(start).toMatchObject({ id: W, planned_date: "2026-11-05", weekday: 4, week: 3, plan_type: "5day", day_name: "Push", status: "in_progress" });
    expect(calls[0].args[1]).toMatchObject({ onConflict: "id", ignoreDuplicates: true }); // sending it twice is harmless
  });
  it("stops and keeps the rest when the connection fails part-way", async () => {
    const { client } = fake({ table: "sets", code: "08006" });
    const r = await applyOps(client, [startOp(startedNow(page, new Date()))!, set(1), set(2)]);
    expect(r).toMatchObject({ done: 1, retry: true });
  });
  it("drops a start the database refuses for good (another session is already in progress)", async () => {
    const { client } = fake({ table: "workouts", code: "23505" });
    const r = await applyOps(client, [startOp(startedNow(page, new Date()))!]);
    expect(r).toEqual({ done: 1, retry: false, dropped: 1 });
  });
});
