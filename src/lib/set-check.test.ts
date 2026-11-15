import { describe, expect, it } from "vitest";
import { againstLast, looksLikeTypo } from "./set-check";

describe("typo check", () => {
  it("flags a weight more than double last time and 10 kg above it", () => {
    expect(looksLikeTypo(300, 30)).toBe(true);
    expect(looksLikeTypo(65, 30)).toBe(true);
  });
  it("lets real jumps through and says nothing without a last weight", () => {
    expect(looksLikeTypo(35, 30)).toBe(false);
    expect(looksLikeTypo(15, 8)).toBe(false); // under double
    expect(looksLikeTypo(300, null)).toBe(false);
    expect(looksLikeTypo(null, 30)).toBe(false);
  });
});

describe("set against last time", () => {
  const last = { kg: 30, reps: [12, 10], secs: [] };
  it("compares weight first, then reps", () => {
    expect(againstLast("weight", last, 0, { kg: 32.5, reps: 8, secs: null })).toBe("up");
    expect(againstLast("weight", last, 0, { kg: 27.5, reps: 15, secs: null })).toBe("down");
    expect(againstLast("weight", last, 1, { kg: 30, reps: 11, secs: null })).toBe("up");
    expect(againstLast("weight", last, 1, { kg: 30, reps: 10, secs: null })).toBe("same");
    expect(againstLast("weight", last, 0, { kg: 30, reps: 9, secs: null })).toBe("down");
  });
  it("handles holds and missing history", () => {
    expect(againstLast("timed", { kg: null, reps: [], secs: [40] }, 0, { kg: null, reps: null, secs: 45 })).toBe("up");
    expect(againstLast("weight", null, 0, { kg: 30, reps: 12, secs: null })).toBeNull();
    expect(againstLast("weight", last, 2, { kg: 30, reps: 12, secs: null })).toBeNull();
  });
});
