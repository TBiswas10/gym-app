// Line chart geometry, ported from the design's Progress screen. The chart is a 340 x 190 box:
// the SVG draws the line, HTML draws labels, the tooltip and the 48px tap targets (percent positions).

export const W = 340;
export const H = 190;
const X0 = 52;
const X1 = 322;
const Y0 = 30;
const Y1 = 150;

export interface ChartGeometry {
  path: string;
  dots: { i: number; x: number; y: number; left: string }[];
  grid: { y: number; left: string; top: string; label: number }[];
  tip: { left: string; top: string };
}

const pct = (n: number, whole: number): string => `${((n / whole) * 100).toFixed(2)}%`;

export function chartGeometry(values: number[], selected: number): ChartGeometry {
  const n = values.length;
  const mx = Math.max(...values);
  const mn = Math.min(...values);
  const span = Math.max(mx - mn, 1);
  const lo = mn - span * 0.25;
  const hi = mx + span * 0.25;
  const px = (i: number) => (n === 1 ? (X0 + X1) / 2 : X0 + ((X1 - X0) * i) / (n - 1));
  const py = (v: number) => Y1 - ((Y1 - Y0) * (v - lo)) / (hi - lo);

  const dots = values.map((v, i) => ({ i, x: px(i), y: py(v), left: pct(px(i), W) }));
  const path = dots.map((d, i) => `${i ? "L" : "M"}${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(" ");
  const gridValues = [hi - (hi - lo) * 0.1, (hi + lo) / 2, lo + (hi - lo) * 0.1];
  const grid = gridValues.map((v) => ({ y: py(v), left: pct(44, W), top: pct(py(v), H), label: Math.round(v) }));

  const sel = Math.min(Math.max(selected, 0), n - 1);
  const tx = Math.min(Math.max(px(sel), 40), 300);
  const ty = py(values[sel]);
  const tipY = ty - 40 < 4 ? ty + 14 : ty - 40;
  return { path, dots, grid, tip: { left: pct(tx, W), top: pct(tipY, H) } };
}

export const CHART_X = { x0: X0, x1: X1 };
