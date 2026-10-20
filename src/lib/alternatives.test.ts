import { describe, expect, it } from "vitest";
import { alternativesFor, type LibraryItem } from "./alternatives";

const L = (slug: string, name: string, group: string, muscles: string[], kit = "Machine"): LibraryItem => ({ slug, name, kit, group, muscles });
const target = L("chest", "Chest press", "Chest", ["Chest", "Triceps"]);
const lib = [
  target,
  L("pec", "Pec deck", "Chest", ["Chest"]),
  L("incline", "Incline dumbbell press", "Chest", ["Upper chest", "Triceps"], "Dumbbells"),
  L("dips", "Dips", "Arms", ["Triceps", "Chest"]),
  L("squat", "Squat", "Legs", ["Quads"]),
];

describe("swap alternatives", () => {
  it("ranks the same main muscle first, then group, then a shared muscle, and drops unrelated lifts", () => {
    const a = alternativesFor(target, lib, null);
    expect(a.map((x) => x.slug)).toEqual(["pec", "incline", "dips"]);
    expect(a.map((x) => x.match)).toEqual(["main", "group", "shared"]);
  });
  it("puts your chosen backup first", () => {
    expect(alternativesFor(target, lib, "Dips")[0].slug).toBe("dips");
  });
  it("leaves out the lift itself and today's other lifts, and honours the limit", () => {
    expect(alternativesFor(target, lib, null, ["pec"]).map((x) => x.slug)).toEqual(["incline", "dips"]);
    expect(alternativesFor(target, lib, null, [], 1)).toHaveLength(1);
  });
});
