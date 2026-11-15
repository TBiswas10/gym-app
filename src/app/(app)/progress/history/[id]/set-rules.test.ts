import { describe, expect, it } from "vitest";
import { checkSetInput } from "./set-rules";

const weighted = (kg: number | null, reps: number | null) => ({ kg, reps, secs: null });

describe("checkSetInput", () => {
  it("stores a weighted set as kg and reps", () => {
    expect(checkSetInput("weight", weighted(32.5, 10))).toEqual({ ok: true, values: { weight_kg: 32.5, reps: 10, seconds: null } });
  });

  it("stores bodyweight as 0 kg, the same as the workout screen", () => {
    expect(checkSetInput("bodyweight", weighted(0, 12))).toEqual({ ok: true, values: { weight_kg: 0, reps: 12, seconds: null } });
  });

  it("allows up to 2 decimals and rejects a third", () => {
    expect(checkSetInput("weight", weighted(30.25, 8))).toMatchObject({ ok: true, values: { weight_kg: 30.25 } });
    expect(checkSetInput("weight", weighted(30.125, 8)).ok).toBe(false);
  });

  it("accepts the weight limits and rejects anything outside them", () => {
    expect(checkSetInput("weight", weighted(0, 5)).ok).toBe(true);
    expect(checkSetInput("weight", weighted(400, 5)).ok).toBe(true);
    expect(checkSetInput("weight", weighted(400.01, 5)).ok).toBe(false);
    expect(checkSetInput("weight", weighted(-0.5, 5)).ok).toBe(false);
  });

  it("accepts whole reps from 0 to 100 only", () => {
    expect(checkSetInput("weight", weighted(20, 0)).ok).toBe(true);
    expect(checkSetInput("weight", weighted(20, 100)).ok).toBe(true);
    expect(checkSetInput("weight", weighted(20, 101)).ok).toBe(false);
    expect(checkSetInput("weight", weighted(20, 8.5)).ok).toBe(false);
    expect(checkSetInput("weight", weighted(20, -1)).ok).toBe(false);
  });

  it("stores a timed hold as seconds only, from 0 to 3600 whole seconds", () => {
    expect(checkSetInput("timed", { kg: 20, reps: 3, secs: 35 })).toEqual({ ok: true, values: { weight_kg: null, reps: null, seconds: 35 } });
    expect(checkSetInput("timed", { kg: null, reps: null, secs: 3600 }).ok).toBe(true);
    expect(checkSetInput("timed", { kg: null, reps: null, secs: 3601 }).ok).toBe(false);
    expect(checkSetInput("timed", { kg: null, reps: null, secs: 30.5 }).ok).toBe(false);
  });

  it("requires the value for the kind", () => {
    expect(checkSetInput("weight", weighted(20, null)).ok).toBe(false);
    expect(checkSetInput("weight", weighted(null, 10)).ok).toBe(false);
    expect(checkSetInput("timed", { kg: null, reps: null, secs: null }).ok).toBe(false);
  });

  it("rejects NaN, infinity and values that are not numbers", () => {
    expect(checkSetInput("weight", weighted(Number.NaN, 10)).ok).toBe(false);
    expect(checkSetInput("weight", weighted(Number.POSITIVE_INFINITY, 10)).ok).toBe(false);
    expect(checkSetInput("weight", { kg: "20" as unknown as number, reps: 10, secs: null }).ok).toBe(false);
    expect(checkSetInput("timed", { kg: null, reps: null, secs: Number.NaN }).ok).toBe(false);
    expect(checkSetInput("weight", null as unknown as { kg: number; reps: number; secs: number })).toMatchObject({ ok: false });
  });
});
