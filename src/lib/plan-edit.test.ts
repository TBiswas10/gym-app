import { describe, expect, it } from "vitest";
import { add, estimateNote, move, rangeLabel, rangesFor, removeAt, setRange, setSets, totalSets, type Row } from "./plan-edit";

const r = (slug: string, over: Partial<Row> = {}): Row => ({ slug, name: slug, kind: "weight", sets: 2, repLo: 8, repHi: 12, ...over });
const list = [r("a"), r("b"), r("c")];
const slugs = (rows: Row[]) => rows.map((x) => x.slug);

describe("plan editing", () => {
  it("moves an exercise up or down and stops at the ends", () => {
    expect(slugs(move(list, 1, -1))).toEqual(["b", "a", "c"]);
    expect(slugs(move(list, 1, 1))).toEqual(["a", "c", "b"]);
    expect(move(list, 0, -1)).toBe(list);
    expect(move(list, 2, 1)).toBe(list);
  });
  it("removes an exercise", () => {
    expect(slugs(removeAt(list, 1))).toEqual(["a", "c"]);
  });
  it("adds an exercise once, up to eight", () => {
    expect(slugs(add(list, r("d")))).toEqual(["a", "b", "c", "d"]);
    expect(add(list, r("a"))).toBe(list);
    const eight = Array.from({ length: 8 }, (_, i) => r(`x${i}`));
    expect(add(eight, r("extra"))).toBe(eight);
  });
  it("keeps sets between 1 and 2 (plan fact: 2 sets)", () => {
    expect(setSets(list, 0, 3)[0].sets).toBe(2);
    expect(setSets(list, 0, 0)[0].sets).toBe(1);
    expect(setSets(list, 0, 1)[0].sets).toBe(1);
  });
  it("changes a rep range", () => {
    expect(setRange(list, 2, 10, 12)[2]).toMatchObject({ repLo: 10, repHi: 12 });
  });
  it("offers the right ranges and labels", () => {
    expect(rangesFor("weight")).toEqual([[8, 12], [10, 12], [12, 15]]);
    expect(rangesFor("timed")).toEqual([[15, 30], [20, 40], [30, 60]]);
    expect(rangeLabel(8, 12, "weight")).toBe("8–12");
    expect(rangeLabel(20, 40, "timed")).toBe("20–40 s");
  });
  it("warns when a session is over 50 minutes, with a fix hint", () => {
    expect(estimateNote(47)).toEqual({ over: false, text: "About 47 min with the 7 min warm-up. Cap is 50." });
    expect(estimateNote(53)).toEqual({ over: true, text: "About 53 min. Over 50. Remove a set or an exercise." });
    expect(estimateNote(50).over).toBe(false);
  });
  it("totals sets", () => {
    expect(totalSets(list)).toBe(6);
  });
});
