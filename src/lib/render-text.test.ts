import { describe, expect, it } from "vitest";
import { muscleLabel, tempoHint } from "./render-text";

describe("exercise viewer text", () => {
  it("names the muscles in plain words", () => {
    expect(muscleLabel(["chest", "frontdelt"])).toBe("Chest, Front shoulders");
    expect(muscleLabel([])).toBe("Whole body");
  });
  it("states the tempo", () => {
    expect(tempoHint([1, 0.45, 2.2, 0.35])).toBe("Tempo: lift in 1 s, squeeze 0.5 s, lower over 2.2 s.");
    expect(tempoHint([2, 1.2, 2, 0.5])).toBe("Tempo: lift in 2 s, squeeze 1.2 s, lower over 2 s.");
  });
});
