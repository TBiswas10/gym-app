import { describe, expect, it } from "vitest";
import { rollingAverage, summarise } from "./bodyweight";

const p = (date: string, kg: number) => ({ date, kg });

describe("bodyweight", () => {
  it("averages the weigh-ins of the last 7 days", () => {
    const a = rollingAverage([p("2026-10-01", 80), p("2026-10-03", 79), p("2026-10-12", 78)]);
    expect(a).toEqual([80, 79.5, 78]);
  });
  it("says how far to the goal, and when you are there", () => {
    const pts = [p("2026-10-01", 82), p("2026-10-20", 80)];
    expect(summarise(pts, 76)).toMatchObject({ now: 80, start: 82, change: -2, toGo: 4, direction: "down", reached: false });
    expect(summarise(pts, 80)).toMatchObject({ toGo: 0 });
    expect(summarise(pts, 85)).toMatchObject({ direction: "up", toGo: 5 });
    expect(summarise(pts, 90)?.reached).toBe(false);
    expect(summarise(pts, 79)?.reached).toBe(false);
    expect(summarise([p("2026-10-01", 82), p("2026-10-20", 75)], 78)?.reached).toBe(true);
  });
  it("has nothing to say with no weigh-ins", () => {
    expect(summarise([], 70)).toBeNull();
  });
});
