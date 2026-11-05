// Bodyweight: a 7-day average smooths day-to-day water swings so the trend is what you see, and a goal says how far to go.

export interface WeightPoint {
  date: string; // YYYY-MM-DD
  kg: number;
}

const DAY = 86_400_000;
const t = (d: string): number => Date.parse(d + "T00:00:00Z");
const r1 = (n: number): number => Math.round(n * 10) / 10;

/** For each weigh-in (oldest first): the average of the weigh-ins in the 7 days up to and including it. */
export function rollingAverage(points: WeightPoint[], days = 7): number[] {
  const sorted = [...points].sort((a, b) => t(a.date) - t(b.date));
  return sorted.map((p, i) => {
    const from = t(p.date) - (days - 1) * DAY;
    const win = sorted.slice(0, i + 1).filter((q) => t(q.date) >= from);
    return r1(win.reduce((n, q) => n + q.kg, 0) / win.length);
  });
}

export interface WeightSummary {
  now: number;
  start: number;
  change: number;
  toGo: number | null; // kg still to go (positive); null with no goal
  direction: "down" | "up" | null; // which way the goal is from the start
  reached: boolean;
}

export function summarise(points: WeightPoint[], goal: number | null): WeightSummary | null {
  if (points.length === 0) return null;
  const avg = rollingAverage(points);
  const now = avg[avg.length - 1];
  const start = avg[0];
  const direction = goal === null ? null : goal < start ? "down" : goal > start ? "up" : null;
  const reached = goal !== null && (direction === "down" ? now <= goal : direction === "up" ? now >= goal : Math.abs(now - goal) < 0.05);
  return { now, start, change: r1(now - start), toGo: goal === null ? null : reached ? 0 : r1(Math.abs(now - goal)), direction, reached };
}
