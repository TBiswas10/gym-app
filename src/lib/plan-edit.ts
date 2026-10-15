// Plan editing as pure list operations. The screen applies them, then saves the whole day.

import { CAP_MIN, overCap, type ExerciseKind } from "./plan";

export interface Row {
  slug: string;
  name: string;
  kind: ExerciseKind;
  sets: number;
  repLo: number;
  repHi: number;
}

export const MAX_EXERCISES = 8;
export const MAX_SETS = 2; // plan fact: all exercises are 2 sets (1 on a lighter day or a deload)

/** Rep ranges offered per kind (the design's chips). Timed holds are in seconds. */
export const RANGES: Record<"weight" | "timed", [number, number][]> = {
  weight: [[8, 12], [10, 12], [12, 15]],
  timed: [[15, 30], [20, 40], [30, 60]],
};
export const rangesFor = (kind: ExerciseKind): [number, number][] => (kind === "timed" ? RANGES.timed : RANGES.weight);
export const rangeLabel = (lo: number, hi: number, kind: ExerciseKind): string => `${lo}–${hi}${kind === "timed" ? " s" : ""}`;

export function move(rows: Row[], i: number, dir: -1 | 1): Row[] {
  const j = i + dir;
  if (i < 0 || i >= rows.length || j < 0 || j >= rows.length) return rows;
  const next = [...rows];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const removeAt = (rows: Row[], i: number): Row[] => rows.filter((_, k) => k !== i);

export function add(rows: Row[], row: Row): Row[] {
  if (rows.length >= MAX_EXERCISES || rows.some((r) => r.slug === row.slug)) return rows;
  return [...rows, row];
}

export const setSets = (rows: Row[], i: number, sets: number): Row[] =>
  rows.map((r, k) => (k === i ? { ...r, sets: Math.min(MAX_SETS, Math.max(1, sets)) } : r));

export const setRange = (rows: Row[], i: number, lo: number, hi: number): Row[] => rows.map((r, k) => (k === i ? { ...r, repLo: lo, repHi: hi } : r));

/** "About N min including cardio at the end. Cap is 50." or the red version with a fix hint. */
export function estimateNote(minutes: number): { over: boolean; text: string } {
  return overCap(minutes)
    ? { over: true, text: `About ${minutes} min. Over ${CAP_MIN}. Remove a set or an exercise.` }
    : { over: false, text: `About ${minutes} min with cardio first. Cap is ${CAP_MIN}.` };
}

/** Light days and deloads run on half the sets, so the editor shows the planned (full) count. */
export const totalSets = (rows: Row[]): number => rows.reduce((n, r) => n + r.sets, 0);
