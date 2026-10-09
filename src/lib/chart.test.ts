import { describe, expect, it } from "vitest";
import { chartGeometry } from "./chart";

describe("chart geometry", () => {
  it("spreads points across the plot area and draws a line", () => {
    const g = chartGeometry([20, 25, 30], 2);
    expect(g.dots.map((d) => d.x)).toEqual([52, 187, 322]);
    expect(g.path.startsWith("M52.0 ")).toBe(true);
    expect(g.path.split("L")).toHaveLength(3);
  });
  it("puts higher values higher on the chart", () => {
    const g = chartGeometry([20, 25, 30], 0);
    expect(g.dots[2].y).toBeLessThan(g.dots[0].y);
  });
  it("keeps points inside the plot area", () => {
    for (const d of chartGeometry([27.5, 30, 30, 32.5, 35, 35], 5).dots) {
      expect(d.y).toBeGreaterThanOrEqual(30);
      expect(d.y).toBeLessThanOrEqual(150);
    }
  });
  it("copes with one point and with a flat line", () => {
    const one = chartGeometry([30], 0);
    expect(one.dots).toHaveLength(1);
    expect(one.dots[0].x).toBe(187);
    expect(Number.isFinite(one.dots[0].y)).toBe(true);
    const flat = chartGeometry([30, 30, 30], 1);
    expect(flat.dots.every((d) => Number.isFinite(d.y))).toBe(true);
  });
  it("gives three grid lines with rounded labels", () => {
    const g = chartGeometry([20, 30], 0);
    expect(g.grid).toHaveLength(3);
    expect(g.grid.every((l) => Number.isInteger(l.label))).toBe(true);
  });
  it("keeps the tooltip on the chart and clamps a bad selection", () => {
    const first = chartGeometry([20, 30], 0);
    const last = chartGeometry([20, 30], 1);
    expect(parseFloat(first.tip.left)).toBeGreaterThanOrEqual(11);
    expect(parseFloat(last.tip.left)).toBeLessThanOrEqual(89);
    expect(chartGeometry([20, 30], 99).tip).toEqual(last.tip);
  });
});
