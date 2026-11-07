import { describe, expect, it } from "vitest";
import { warmupLine, warmupSets } from "./warmup";

describe("warmupSets", () => {
  it("ramps to about half and three quarters of the working weight", () => {
    expect(warmupSets(20, 2.5)).toEqual([
      { kg: 10, reps: 8 },
      { kg: 15, reps: 5 },
    ]);
  });
  it("rounds down to the exercise's real step", () => {
    // 75% of 30 is 22.5, which is already a 2.5 step
    expect(warmupSets(30, 2.5)[1]).toEqual({ kg: 22.5, reps: 5 });
    // 50% of 32.5 is 16.25, rounded down to 15; 75% is 24.375, rounded down to 22.5
    expect(warmupSets(32.5, 2.5)).toEqual([
      { kg: 15, reps: 8 },
      { kg: 22.5, reps: 5 },
    ]);
    // dumbbells on a 2 kg step: 50% of 22 is 11, down to 10; 75% is 16.5, down to 16
    expect(warmupSets(22, 2)).toEqual([
      { kg: 10, reps: 8 },
      { kg: 16, reps: 5 },
    ]);
  });
  it("never reaches the working weight", () => {
    for (const kg of [20, 21, 25, 40, 77.5]) {
      for (const s of warmupSets(kg, 1)) expect(s.kg).toBeLessThan(kg);
    }
  });
  it("drops a duplicate weight", () => {
    // 50% of 20 and 75% of 20 both round down to 10 on a step of 10
    expect(warmupSets(20, 10)).toEqual([{ kg: 10, reps: 8 }]);
  });
  it("drops a ramp set that rounds down to nothing", () => {
    expect(warmupSets(4, 2.5)).toEqual([{ kg: 2.5, reps: 5 }]);
  });
  it("is empty without a working weight or a step", () => {
    expect(warmupSets(0, 2.5)).toEqual([]);
    expect(warmupSets(20, 0)).toEqual([]);
  });
});

describe("warmupLine", () => {
  it("writes one quiet line for a weighted lift of 20 kg or more", () => {
    expect(warmupLine(20, 2.5)).toBe("Warm up: 10 kg × 8, 15 kg × 5");
    expect(warmupLine(30, 2.5)).toBe("Warm up: 15 kg × 8, 22.5 kg × 5");
  });
  it("says nothing under 20 kg or when there is no working weight yet", () => {
    expect(warmupLine(19.5, 2.5)).toBeNull();
    expect(warmupLine(null, 2.5)).toBeNull();
  });
});
