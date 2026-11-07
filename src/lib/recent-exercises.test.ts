import { describe, expect, it } from "vitest";
import { recentSlugs } from "./recent-exercises";

describe("recent exercises", () => {
  it("keeps the newest first and drops repeats", () => {
    expect(recentSlugs(["chest", "chest", "lat", "row", "lat", "curl"])).toEqual(["chest", "lat", "row", "curl"]);
  });
  it("stops at five", () => {
    expect(recentSlugs(["a", "b", "c", "d", "e", "f", "g"])).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("is empty when nothing has been logged", () => {
    expect(recentSlugs([])).toEqual([]);
  });
});
