import { describe, expect, it } from "vitest";
import { matchesQuery } from "./library-search";

const chest = { name: "Smith machine bench press", group: "Chest", kit: "Smith machine", muscles: ["Chest", "Shoulders", "Triceps"] };
const curl = { name: "Straight bar cable curl", group: "Arms", kit: "Cable", muscles: ["Biceps"] };

describe("library search", () => {
  it("matches everything for an empty query", () => {
    expect(matchesQuery(chest, "")).toBe(true);
    expect(matchesQuery(chest, "   ")).toBe(true);
  });
  it("matches name, group, kit and muscles, ignoring case", () => {
    expect(matchesQuery(chest, "BENCH")).toBe(true);
    expect(matchesQuery(chest, "chest")).toBe(true);
    expect(matchesQuery(chest, "smith")).toBe(true);
    expect(matchesQuery(curl, "biceps")).toBe(true);
  });
  it("needs every word, in any order", () => {
    expect(matchesQuery(curl, "cable curl")).toBe(true);
    expect(matchesQuery(curl, "curl cable")).toBe(true);
    expect(matchesQuery(curl, "cable press")).toBe(false);
  });
  it("matches the start of words and tolerates punctuation", () => {
    expect(matchesQuery(curl, "str")).toBe(true);
    expect(matchesQuery(curl, "ur")).toBe(false);
    expect(matchesQuery({ ...curl, name: "Push-up" }, "push up")).toBe(true);
  });
  it("understands db", () => {
    expect(matchesQuery({ name: "Dumbbell curl", group: "Arms", kit: "Dumbbells", muscles: ["Biceps"] }, "db curl")).toBe(true);
  });
});
