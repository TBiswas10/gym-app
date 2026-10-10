import { describe, expect, it } from "vitest";
import { CAP_MIN, countLine, estimateMinutes, formatTarget, liftMinutes, overCap, type ExerciseKind } from "./plan";

const w = (n: number): ExerciseKind[] => Array(n).fill("weight");

describe("session length", () => {
  it("counts 5 min per exercise and 3 for plank", () => {
    expect(liftMinutes(w(5))).toBe(25);
    expect(liftMinutes([...w(5), "timed"])).toBe(28);
  });

  it("is the lifts plus the cardio block (cardio is the warm-up)", () => {
    expect(estimateMinutes(w(5), 10)).toBe(35); // Monday Push
    expect(estimateMinutes([...w(5), "timed"], 15)).toBe(43); // Saturday
  });

  it("keeps every built-in session at or under 50 min", () => {
    const sessions: [ExerciseKind[], number][] = [
      [w(5), 10], // Push
      [w(5), 9], // Pull
      [[...w(4), "timed"], 10], // Legs + Core
      [w(6), 10], // Upper (light)
      [[...w(5), "timed"], 15], // Lower + Core + Cardio
      [[...w(5), "timed"], 10], // Full A
      [w(6), 10], // Full B
      [w(5), 15], // Full C
    ];
    for (const [kinds, cardio] of sessions) expect(estimateMinutes(kinds, cardio)).toBeLessThanOrEqual(CAP_MIN);
  });

  it("shortens lifts on a light day", () => {
    expect(liftMinutes(w(6), true)).toBe(26); // 30 * 0.85 = 25.5 -> 26
    expect(estimateMinutes(w(6), 10, true)).toBeLessThan(estimateMinutes(w(6), 10, false));
  });

  it("flags anything over the cap", () => {
    expect(overCap(50)).toBe(false);
    expect(overCap(51)).toBe(true);
  });
});

describe("labels", () => {
  it("formats targets", () => {
    expect(formatTarget(2, 8, 12, "weight")).toBe("2 × 8–12");
    expect(formatTarget(2, 20, 40, "timed")).toBe("2 × 20–40 s");
  });
  it("pluralises the count line", () => {
    expect(countLine(6)).toBe("6 exercises · 2 sets each");
    expect(countLine(1)).toBe("1 exercise · 2 sets each");
  });
});
