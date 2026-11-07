// Warm-up ramp for the first lift of a session. Advice only: it never adds a set and never changes the 2-set plan or progression.

import { fmtNum } from "./format";

/** Below this working weight the warm-up is not worth a line. */
export const WARMUP_MIN_KG = 20;

export interface WarmupSet {
  kg: number;
  reps: number;
}

/** Rounds down to a whole number of steps, removing float noise first. */
const downToStep = (kg: number, step: number): number => Math.round(Math.floor(kg / step + 1e-9) * step * 100) / 100;

/** Up to two ramp sets, about 50% and 75% of the working weight, rounded down to the exercise's step. Never at or above the working weight. */
export function warmupSets(workingKg: number, step: number): WarmupSet[] {
  if (!(workingKg > 0) || !(step > 0)) return [];
  const ramp: WarmupSet[] = [
    { kg: downToStep(workingKg * 0.5, step), reps: 8 },
    { kg: downToStep(workingKg * 0.75, step), reps: 5 },
  ];
  const out: WarmupSet[] = [];
  for (const s of ramp) {
    if (s.kg <= 0 || s.kg >= workingKg || out.some((o) => o.kg === s.kg)) continue;
    out.push(s);
  }
  return out;
}

/** "Warm up: 10 kg × 8, 15 kg × 5", or null when the lift is light or has no working weight yet. */
export function warmupLine(workingKg: number | null, step: number): string | null {
  if (workingKg === null || workingKg < WARMUP_MIN_KG) return null;
  const sets = warmupSets(workingKg, step);
  if (!sets.length) return null;
  return `Warm up: ${sets.map((s) => `${fmtNum(s.kg)} kg × ${s.reps}`).join(", ")}`;
}
