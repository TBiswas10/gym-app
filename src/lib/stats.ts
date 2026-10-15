// Progress numbers. Pure functions over rows already loaded from the database.

import { programmeWeek } from "./dates";
import { bestSet, isPB, type LastTime } from "./progression";
import type { ExerciseKind } from "./plan";

export interface HistWorkout {
  id: string;
  planned_date: string;
}
export interface HistSet {
  workout_id: string;
  exercise_slug: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  seconds: number | null;
  variant?: string | null;
}

/** The headline number of a session for an exercise: top weight, longest hold, or best bodyweight reps. */
export function topValue(kind: ExerciseKind, sets: { weight_kg: number | null; reps: number | null; seconds: number | null }[]): number {
  if (kind === "timed") return Math.max(0, ...sets.map((s) => s.seconds ?? 0));
  if (kind === "bodyweight") return Math.max(0, ...sets.map((s) => s.reps ?? 0));
  return Math.max(0, ...sets.map((s) => s.weight_kg ?? 0));
}

export interface SeriesPoint {
  date: string;
  value: number;
}

/** Top value per session, oldest first, last `limit` sessions. Swapped-in backups are left out. */
export function topSeries(workouts: HistWorkout[], sets: HistSet[], slug: string, kind: ExerciseKind, limit = 8): SeriesPoint[] {
  const ordered = [...workouts].sort((a, b) => (a.planned_date < b.planned_date ? -1 : a.planned_date > b.planned_date ? 1 : 0));
  const points: SeriesPoint[] = [];
  for (const w of ordered) {
    const mine = sets.filter((s) => s.workout_id === w.id && s.exercise_slug === slug && !s.variant);
    if (mine.length) points.push({ date: w.planned_date, value: topValue(kind, mine) });
  }
  return points.slice(-limit);
}

/** Exercises with data, most-logged first. */
export function exercisesWithData(sets: HistSet[]): string[] {
  const count = new Map<string, Set<string>>();
  for (const s of sets) {
    if (s.variant) continue;
    count.set(s.exercise_slug, (count.get(s.exercise_slug) ?? new Set()).add(s.workout_id));
  }
  return [...count.entries()].sort((a, b) => b[1].size - a[1].size || (a[0] < b[0] ? -1 : 1)).map(([slug]) => slug);
}

/** What was done last in `workoutId`'s predecessor for an exercise (for PB checks). */
function lastBefore(workouts: HistWorkout[], sets: HistSet[], workoutId: string, slug: string): LastTime | null {
  const ordered = [...workouts].sort((a, b) => (a.planned_date < b.planned_date ? -1 : a.planned_date > b.planned_date ? 1 : 0));
  const idx = ordered.findIndex((w) => w.id === workoutId);
  for (let i = idx - 1; i >= 0; i--) {
    const mine = sets.filter((s) => s.workout_id === ordered[i].id && s.exercise_slug === slug && !s.variant).sort((a, b) => a.set_number - b.set_number);
    if (mine.length) {
      return {
        kg: mine[0].weight_kg,
        reps: mine.map((s) => s.reps).filter((v): v is number => v !== null),
        secs: mine.map((s) => s.seconds).filter((v): v is number => v !== null),
      };
    }
  }
  return null;
}

export interface WeekPB {
  slug: string;
  workoutId: string;
  value: { kg: number | null; reps: number | null; secs: number | null };
}

export interface WeekStats {
  sessions: number;
  sets: number;
  groupSets: Record<string, number>;
  pbs: WeekPB[];
}

/** Sessions, sets, sets per muscle group and new PBs among the workouts in `weekWorkoutIds`. */
export function weekStats(
  workouts: HistWorkout[],
  sets: HistSet[],
  weekWorkoutIds: string[],
  info: Record<string, { kind: ExerciseKind; group: string }>,
): WeekStats {
  const inWeek = new Set(weekWorkoutIds);
  const mine = sets.filter((s) => inWeek.has(s.workout_id));
  const groupSets: Record<string, number> = {};
  for (const s of mine) {
    const g = info[s.exercise_slug]?.group;
    if (g) groupSets[g] = (groupSets[g] ?? 0) + 1;
  }
  const pbs: WeekPB[] = [];
  for (const wid of weekWorkoutIds) {
    const slugs = [...new Set(sets.filter((s) => s.workout_id === wid && !s.variant).map((s) => s.exercise_slug))];
    for (const slug of slugs) {
      const kind = info[slug]?.kind;
      if (!kind) continue;
      const rows = sets.filter((s) => s.workout_id === wid && s.exercise_slug === slug && !s.variant).sort((a, b) => a.set_number - b.set_number);
      const vals = rows.map((r) => ({ kg: r.weight_kg, reps: r.reps, secs: r.seconds }));
      if (isPB(kind, lastBefore(workouts, sets, wid, slug), vals)) pbs.push({ slug, workoutId: wid, value: bestSet(kind, vals) ?? vals[vals.length - 1] });
    }
  }
  return { sessions: weekWorkoutIds.length, sets: mine.length, groupSets, pbs };
}

/** Which of the 12 programme weeks is done, current, or a check-in still to come. */
export type WeekCell = "done" | "now" | "check" | "todo";
export function weekCells(currentWeek: number, doneReviews: number[] = []): { week: number; cell: WeekCell }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const week = i + 1;
    const isCheck = week === 4 || week === 8 || week === 12;
    let cell: WeekCell = "todo";
    if (week < currentWeek) cell = "done";
    else if (week === currentWeek) cell = "now";
    else if (isCheck && !doneReviews.includes(week)) cell = "check";
    return { week, cell };
  });
}

/** The next check-in (4, 8 or 12) not yet done, or null when all three are. */
export function nextCheckIn(currentWeek: number, doneReviews: number[]): number | null {
  for (const w of [4, 8, 12]) if (!doneReviews.includes(w) && (w >= currentWeek || !doneReviews.includes(w))) return w;
  return null;
}

/** A check-in is ready once its week has begun and it has not been done. */
export const checkInDue = (currentWeek: number, doneReviews: number[]): number | null => {
  for (const w of [4, 8, 12]) if (currentWeek >= w && !doneReviews.includes(w)) return w;
  return null;
};

/** First and latest top weight for the strength table on the check-in. */
export function strengthChange(points: SeriesPoint[]): { from: number; to: number; delta: number } | null {
  if (points.length < 2) return null;
  const from = points[0].value;
  const to = points[points.length - 1].value;
  return { from, to, delta: Math.round((to - from) * 10) / 10 };
}

export interface WeekDone {
  week: number;
  done: number;
  planned: number;
}

/** Sessions finished in each of the 12 programme weeks, against the plan, plus the current run of full weeks. */
export function consistency(startDate: string, doneDates: string[], planned: number, currentWeek: number): { weeks: WeekDone[]; streak: number } {
  const counts = Array.from({ length: 12 }, () => 0);
  for (const d of doneDates) {
    const w = programmeWeek(startDate, d);
    if (w >= 1 && w <= 12) counts[w - 1]++;
  }
  const weeks = counts.map((done, i) => ({ week: i + 1, done, planned }));
  // The current week is still in progress, so it only extends the run once it's full; it never breaks it.
  let streak = 0;
  for (let w = Math.min(currentWeek, 12); w >= 1; w--) {
    const full = weeks[w - 1].done >= planned;
    if (w === currentWeek && !full) continue;
    if (!full) break;
    streak++;
  }
  return { weeks, streak };
}

export interface RecordRow {
  slug: string;
  value: { kg: number | null; reps: number | null; secs: number | null };
}

/** All-time best per exercise: heaviest weight (then most reps at it), longest hold, or most bodyweight reps. Swapped sets are ignored. */
export function records(sets: HistSet[], kinds: Record<string, ExerciseKind>): RecordRow[] {
  const best = new Map<string, RecordRow["value"]>();
  for (const s of sets) {
    const kind = kinds[s.exercise_slug];
    if (!kind || s.variant) continue;
    const cur = best.get(s.exercise_slug);
    const v = { kg: s.weight_kg, reps: s.reps, secs: s.seconds };
    const better =
      !cur ||
      (kind === "timed"
        ? (v.secs ?? 0) > (cur.secs ?? 0)
        : kind === "bodyweight" && !(v.kg && v.kg > 0)
          ? (v.reps ?? 0) > (cur.reps ?? 0)
          : (v.kg ?? 0) > (cur.kg ?? 0) || ((v.kg ?? 0) === (cur.kg ?? 0) && (v.reps ?? 0) > (cur.reps ?? 0)));
    if (better) best.set(s.exercise_slug, v);
  }
  return [...best].map(([slug, value]) => ({ slug, value }));
}
