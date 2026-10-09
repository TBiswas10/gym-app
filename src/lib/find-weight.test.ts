import { describe, expect, it } from "vitest";
import { firstGuess, jumpLabel, nextAttempt } from "./find-weight";

describe("find your weight", () => {
  it("jumps two steps up when it felt easy and one step down when too hard", () => {
    expect(nextAttempt(20, "easy", 2.5)).toBe(25); // the design: Easy is +5 kg
    expect(nextAttempt(25, "hard", 2.5)).toBe(22.5); // Too hard is -2.5 kg
  });
  it("uses the exercise's own step (a leg press jumps 10)", () => {
    expect(nextAttempt(40, "easy", 5)).toBe(50);
    expect(nextAttempt(40, "hard", 5)).toBe(35);
  });
  it("stays put when it was just right", () => {
    expect(nextAttempt(25, "right", 2.5)).toBe(25);
  });
  it("never goes below one step", () => {
    expect(nextAttempt(2.5, "hard", 2.5)).toBe(2.5);
    expect(nextAttempt(5, "hard", 5)).toBe(5);
  });
  it("starts lower body heavier", () => {
    expect(firstGuess("upper")).toBe(20);
    expect(firstGuess("lower")).toBe(40);
  });
  it("labels the buttons", () => {
    expect(jumpLabel("easy", 2.5)).toBe("+5 kg");
    expect(jumpLabel("hard", 2.5)).toBe("−2.5 kg");
    expect(jumpLabel("easy", 5)).toBe("+10 kg");
  });
});
