import { describe, expect, it } from "vitest";
import { bothAtTop, highSoreness, isPB, lighten, prefill, roundToStep, suggestNext, verdict, type LastTime, type Spec } from "./progression";

const upper: Spec = { kind: "weight", repLo: 8, repHi: 12, step: 2.5, increment: 2.5 };
const legs: Spec = { kind: "weight", repLo: 8, repHi: 12, step: 5, increment: 5 };
const dumbbell: Spec = { kind: "weight", repLo: 8, repHi: 12, step: 2, increment: 2 };
const plank: Spec = { kind: "timed", repLo: 20, repHi: 40, step: 5, increment: 5 };
const backExt: Spec = { kind: "bodyweight", repLo: 10, repHi: 12, step: 2.5, increment: 5 };
const lt = (kg: number | null, reps: number[], secs: number[] = []): LastTime => ({ kg, reps, secs });

describe("roundToStep", () => {
  it("rounds to realistic steps without float noise", () => {
    expect(roundToStep(32.5, 2.5)).toBe(32.5);
    expect(roundToStep(33, 2.5)).toBe(32.5);
    expect(roundToStep(36.3, 2.5)).toBe(37.5);
    expect(roundToStep(41, 2)).toBe(42);
    expect(roundToStep(22.4, 5)).toBe(20);
    expect(roundToStep(0.1 + 0.2, 0.1)).toBe(0.3);
  });
});

describe("suggestNext: only when the top of the range is hit on BOTH sets", () => {
  it("goes up +2.5 kg for upper body", () => {
    expect(suggestNext(upper, lt(30, [12, 12]))).toMatchObject({ action: "up", kg: 32.5, reason: "top-hit" });
  });
  it("goes up +5 kg for legs", () => {
    expect(suggestNext(legs, lt(80, [12, 12]))).toMatchObject({ action: "up", kg: 85 });
  });
  it("uses dumbbell steps", () => {
    expect(suggestNext(dumbbell, lt(10, [12, 12]))).toMatchObject({ action: "up", kg: 12 });
  });
  it("holds when only one set reached the top", () => {
    expect(suggestNext(upper, lt(30, [12, 11]))).toMatchObject({ action: "hold", kg: 30, reason: "below-top" });
    expect(suggestNext(upper, lt(30, [11, 12]))).toMatchObject({ action: "hold", kg: 30 });
  });
  it("holds when neither set reached the top", () => {
    expect(suggestNext(upper, lt(30, [10, 10]))).toMatchObject({ action: "hold", kg: 30 });
  });
  it("holds with fewer than two sets logged", () => {
    expect(suggestNext(upper, lt(30, [12]))).toMatchObject({ action: "hold" });
  });
  it("counts beating the top as hitting it", () => {
    expect(suggestNext(upper, lt(30, [13, 14]))).toMatchObject({ action: "up", kg: 32.5 });
  });
  it("respects an edited increment", () => {
    expect(suggestNext({ ...upper, increment: 5 }, lt(30, [12, 12]))).toMatchObject({ kg: 35 });
  });
  it("makes no suggestion without history", () => {
    expect(suggestNext(upper, null)).toMatchObject({ action: "hold", kg: null, reason: "no-history" });
  });
  it("always holds in setup weeks 1-2", () => {
    expect(suggestNext(upper, lt(30, [12, 12]), { setup: true })).toMatchObject({ action: "hold", kg: 30, reason: "setup" });
  });
  it("holds when soreness has been high", () => {
    expect(suggestNext(upper, lt(30, [12, 12]), { highSoreness: true })).toMatchObject({ action: "hold", reason: "soreness" });
  });
  it("holds when you chose Hold at a check-in", () => {
    expect(suggestNext(upper, lt(30, [12, 12]), { hold: true })).toMatchObject({ action: "hold", kg: 30, reason: "review" });
    expect(verdict(upper, [{ kg: 30, reps: 12, secs: null }, { kg: 30, reps: 12, secs: null }], { hold: true })).toMatchObject({ up: false });
  });
  it("adds time for planks when both holds reach the top", () => {
    expect(suggestNext(plank, lt(null, [], [40, 40]))).toMatchObject({ action: "up", secs: 45 });
    expect(suggestNext(plank, lt(null, [], [40, 35]))).toMatchObject({ action: "hold", secs: 40 });
  });
  it("starts adding load to bodyweight lifts at the top of the range", () => {
    expect(suggestNext(backExt, lt(0, [12, 12]))).toMatchObject({ action: "up", kg: 5 });
    expect(suggestNext(backExt, lt(0, [12, 10]))).toMatchObject({ action: "hold", kg: 0 });
  });
});

describe("bothAtTop", () => {
  it("needs two sets", () => {
    expect(bothAtTop([12, 12], 12)).toBe(true);
    expect(bothAtTop([12], 12)).toBe(false);
    expect(bothAtTop([], 12)).toBe(false);
  });
});

describe("prefill", () => {
  it("steps up and resets reps after a top hit", () => {
    expect(prefill(upper, lt(30, [12, 12]))).toMatchObject({ kg: 32.5, reps: 10 });
  });
  it("holds the weight and the first set's reps otherwise", () => {
    expect(prefill(upper, lt(30, [11, 10]))).toMatchObject({ kg: 30, reps: 11 });
  });
  it("starts calf raises at the bottom of their 12-15 range after an increase", () => {
    expect(prefill({ ...legs, repLo: 12, repHi: 15 }, lt(40, [15, 15]))).toMatchObject({ kg: 45, reps: 12 });
  });
  it("uses the weight found in setup when there is no history", () => {
    expect(prefill(upper, null, { startWeightKg: 25 })).toMatchObject({ kg: 25, reps: 10 });
    expect(prefill(upper, null)).toMatchObject({ kg: 10, reps: 10 });
  });
  it("makes light days about 20% lighter on the step grid", () => {
    expect(prefill(upper, lt(30, [11, 10]), { light: true })).toMatchObject({ kg: 25, light: true });
    expect(lighten(10, 2.5)).toBe(7.5);
    expect(lighten(2.5, 2.5)).toBe(2.5);
  });
  it("never lightens planks or bodyweight", () => {
    expect(prefill(plank, lt(null, [], [30, 30]), { light: true })).toMatchObject({ secs: 30, light: false });
    expect(prefill(backExt, lt(0, [12, 11]), { light: true })).toMatchObject({ kg: 0, light: false });
  });
  it("does not increase during setup weeks", () => {
    expect(prefill(upper, lt(30, [12, 12]), { ctx: { setup: true } })).toMatchObject({ kg: 30 });
  });
});

describe("isPB", () => {
  const sets = (kg: number, ...reps: number[]) => reps.map((r) => ({ kg, reps: r, secs: null }));
  it("is a PB for a heavier weight", () => expect(isPB("weight", lt(30, [12, 12]), sets(32.5, 8, 8))).toBe(true));
  it("is a PB for more reps at the same weight", () => expect(isPB("weight", lt(30, [10, 10]), sets(30, 11, 10))).toBe(true));
  it("is not a PB for matching or fewer reps", () => {
    expect(isPB("weight", lt(30, [12, 12]), sets(30, 12, 12))).toBe(false);
    expect(isPB("weight", lt(30, [12, 12]), sets(27.5, 12, 12))).toBe(false);
  });
  it("needs a previous session", () => expect(isPB("weight", null, sets(30, 12))).toBe(false));
  it("handles timed holds", () => {
    expect(isPB("timed", lt(null, [], [30, 30]), [{ kg: null, reps: null, secs: 35 }])).toBe(true);
    expect(isPB("timed", lt(null, [], [30, 30]), [{ kg: null, reps: null, secs: 30 }])).toBe(false);
  });
  it("handles bodyweight reps", () => {
    expect(isPB("bodyweight", lt(0, [12, 12]), [{ kg: 0, reps: 13, secs: null }])).toBe(true);
    expect(isPB("bodyweight", lt(0, [12, 12]), [{ kg: 0, reps: 12, secs: null }])).toBe(false);
  });
});

describe("verdict", () => {
  const s = (kg: number, a: number, b: number) => [{ kg, reps: a, secs: null }, { kg, reps: b, secs: null }];
  it("says what to try next after a top hit", () => {
    expect(verdict(upper, s(30, 12, 12))).toMatchObject({ up: true, title: "Next time try 32.5 kg" });
    expect(verdict(legs, s(80, 12, 12))).toMatchObject({ up: true, title: "Next time try 85 kg" });
  });
  it("holds and explains", () => {
    expect(verdict(upper, s(30, 12, 11))).toMatchObject({ up: false, title: "Hold this weight", sub: "Build to 12 on both sets, then go up." });
    expect(verdict(upper, s(30, 7, 9)).sub).toBe("Reps dipped below 8. Same weight next time.");
  });
  it("handles planks and bodyweight", () => {
    expect(verdict(plank, [{ kg: null, reps: null, secs: 40 }, { kg: null, reps: null, secs: 40 }]).title).toBe("Next time try 45 s");
    expect(verdict(plank, [{ kg: null, reps: null, secs: 30 }, { kg: null, reps: null, secs: 40 }]).title).toBe("Hold this time");
    expect(verdict(backExt, s(0, 12, 12)).title).toBe("Next time try adding 5 kg");
  });
  it("never says go up in setup weeks or when sore", () => {
    expect(verdict(upper, s(30, 12, 12), { setup: true }).up).toBe(false);
    expect(verdict(upper, s(30, 12, 12), { highSoreness: true }).up).toBe(false);
  });
});

describe("highSoreness", () => {
  it("needs three sessions at 4-5 in a row", () => {
    expect(highSoreness([4, 5, 4])).toBe(true);
    expect(highSoreness([2, 4, 5, 5])).toBe(true);
    expect(highSoreness([4, 5, 3])).toBe(false);
    expect(highSoreness([5, 5])).toBe(false);
    expect(highSoreness([])).toBe(false);
  });
});
