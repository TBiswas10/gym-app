import { describe, expect, it } from "vitest";
import { rollingAverage, summarise, weightRate } from "./bodyweight";

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

describe("weightRate", () => {
  const today = "2026-11-15";
  it("is zero when the weight is flat", () => {
    expect(weightRate([p("2026-11-01", 80), p("2026-11-04", 80), p("2026-11-08", 80), p("2026-11-15", 80)], today)).toBe(0);
  });
  it("is negative when the weight falls", () => {
    expect(weightRate([p("2026-11-01", 80), p("2026-11-04", 79.7), p("2026-11-08", 79.3), p("2026-11-15", 78.6)], today)).toBe(-0.7);
  });
  it("is positive when the weight rises", () => {
    expect(weightRate([p("2026-11-01", 80), p("2026-11-04", 80.3), p("2026-11-08", 80.7), p("2026-11-15", 81.4)], today)).toBe(0.7);
  });
  it("ignores weigh-ins older than 21 days", () => {
    const old = p("2026-10-01", 95);
    expect(weightRate([old, p("2026-11-01", 80), p("2026-11-04", 79.7), p("2026-11-08", 79.3), p("2026-11-15", 78.6)], today)).toBe(-0.7);
  });
  it("needs at least four weigh-ins", () => {
    expect(weightRate([p("2026-11-01", 80), p("2026-11-08", 79.3), p("2026-11-15", 78.6)], today)).toBeNull();
  });
  it("needs the weigh-ins to span at least seven days", () => {
    expect(weightRate([p("2026-11-09", 80), p("2026-11-10", 79.9), p("2026-11-12", 79.8), p("2026-11-15", 79.6)], today)).toBeNull();
  });
});
