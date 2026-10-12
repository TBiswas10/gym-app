import { describe, expect, it } from "vitest";
import { direction, ENERGY_WORDS, SORENESS_WORDS, wordFor } from "./checkin-scale";

describe("check-in scales in words", () => {
  it("has five words for each scale and maps 1-5 to them", () => {
    expect(SORENESS_WORDS).toHaveLength(5);
    expect(ENERGY_WORDS).toHaveLength(5);
    expect(wordFor("soreness", 1)).toBe("None");
    expect(wordFor("soreness", 5)).toBe("Very sore");
    expect(wordFor("energy", 1)).toBe("Drained");
    expect(wordFor("energy", 4)).toBe("Good");
  });
  it("clamps odd values instead of returning undefined", () => {
    expect(wordFor("energy", 0)).toBe("Drained");
    expect(wordFor("energy", 9)).toBe("Buzzing");
    expect(wordFor("soreness", 2.6)).toBe("Moderate");
  });
});

describe("direction of a series (oldest first)", () => {
  it("needs two points to say anything", () => {
    expect(direction([])).toBe("flat");
    expect(direction([3])).toBe("flat");
  });
  it("compares the older half with the newer half", () => {
    expect(direction([4, 4, 3, 2, 2, 1])).toBe("down");
    expect(direction([1, 2, 2, 3, 4, 4])).toBe("up");
    expect(direction([3, 3, 3, 3])).toBe("flat");
  });
  it("ignores a change smaller than half a point", () => {
    expect(direction([3, 3, 3, 3.4])).toBe("flat");
  });
});
