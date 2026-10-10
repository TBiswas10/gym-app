import { describe, expect, it } from "vitest";
import { circumference, ringFraction } from "./rings";

describe("rings", () => {
  it("is done over planned, clamped", () => {
    expect(ringFraction(3, 5)).toBeCloseTo(0.6);
    expect(ringFraction(7, 5)).toBe(1);
    expect(ringFraction(-1, 5)).toBe(0);
  });
  it("is empty with no plan or bad numbers", () => {
    expect(ringFraction(2, 0)).toBe(0);
    expect(ringFraction(NaN, 5)).toBe(0);
  });
  it("gives the circumference", () => {
    expect(circumference(10)).toBeCloseTo(62.83, 1);
  });
});
