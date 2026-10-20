import { describe, expect, it } from "vitest";
import { balance, shareOf } from "./balance";
import { cueFor } from "./audio-cues";

const sets = (muscle: string, n: number) => Array.from({ length: n }, () => ({ muscles: [muscle, "x"] }));

describe("muscle balance", () => {
  it("says nothing with too few sets", () => {
    const b = balance(sets("Chest", 5));
    expect(b.enough).toBe(false);
    expect(b.notes).toEqual([]);
  });
  it("counts push, pull, front, back, upper and lower by the primary muscle", () => {
    const b = balance([...sets("Chest", 4), ...sets("Lats", 4), ...sets("Quads", 2), ...sets("Hamstrings", 2)]);
    expect(b).toMatchObject({ push: 4, pull: 4, front: 6, back: 6, upper: 8, lower: 4, total: 12 });
  });
  it("flags pushing more than pulling, and the other way round", () => {
    expect(balance([...sets("Chest", 8), ...sets("Lats", 2)]).notes.join(" ")).toContain("push more than you pull");
    expect(balance([...sets("Chest", 2), ...sets("Lats", 8)]).notes.join(" ")).toContain("pull more than you push");
  });
  it("flags front-heavy and leg-light training", () => {
    const b = balance([...sets("Quads", 5), ...sets("Chest", 5), ...sets("Core", 2), ...sets("Lats", 1)]);
    expect(b.notes.join(" ")).toContain("More front than back");
  });
  it("is quiet when things are even", () => {
    const b = balance([...sets("Chest", 4), ...sets("Lats", 4), ...sets("Quads", 3), ...sets("Hamstrings", 3), ...sets("Glutes", 2)]);
    expect(b.notes).toEqual([]);
  });
  it("shares are 0.5 when there is nothing", () => {
    expect(shareOf(0, 0)).toBe(0.5);
    expect(shareOf(3, 1)).toBe(0.75);
  });
});

describe("rest countdown cues", () => {
  it("ticks as you enter 3, 2 and 1 and chimes at 0", () => {
    expect(cueFor(4, 3)).toBe("tick");
    expect(cueFor(3, 2)).toBe("tick");
    expect(cueFor(2, 1)).toBe("tick");
    expect(cueFor(1, 0)).toBe("go");
  });
  it("is silent outside the last three seconds and never repeats a second", () => {
    expect(cueFor(60, 59)).toBeNull();
    expect(cueFor(10, 4)).toBeNull();
    expect(cueFor(2, 2)).toBeNull();
    expect(cueFor(0, 0)).toBeNull();
  });
  it("does not chime when a rest starts at zero or the app only just opened", () => {
    expect(cueFor(null, 0)).toBeNull();
    expect(cueFor(null, 2)).toBe("tick");
  });
});
