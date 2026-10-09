import type { ServerClient } from "../supabase/server";
import { programmeWeek, sydneyDate, weekDates } from "../dates";
import type { ExerciseKind } from "../plan";
import { checkInDue, exercisesWithData, nextCheckIn, topSeries, weekCells, weekStats, type WeekCell } from "../stats";
import { fmtNum } from "../format";

export interface ProgressData {
  week: number;
  empty: boolean;
  chips: { slug: string; name: string; kind: ExerciseKind; values: number[]; unit: "kg" | "s" | "reps" }[];
  thisWeek: { sessions: number; planned: number; sets: number; groups: [string, number][]; pbs: { name: string; text: string }[] };
  trend: { soreness: number; energy: number }[];
  cells: { week: number; cell: WeekCell }[];
  next: number | null;
  due: number | null;
}

const GROUPS = ["Legs", "Chest", "Shoulders", "Arms", "Back", "Core"];
const kindOf = (k: string): ExerciseKind => (k === "timed" || k === "bodyweight" ? k : "weight");

export async function loadProgress(supabase: ServerClient, now = new Date()): Promise<ProgressData> {
  const today = sydneyDate(now);
  const { data: state } = await supabase.from("program_state_view").select("start_date, current_week").maybeSingle();
  const week = state?.start_date ? programmeWeek(state.start_date, today) : 1;

  const [workoutsRes, exRes, checkRes, reviewRes, tplRes] = await Promise.all([
    supabase.from("workouts").select("id, planned_date").eq("status", "completed").order("planned_date"),
    supabase.from("exercises").select("slug, name, kind, muscle_group"),
    supabase.from("checkins").select("soreness, energy").not("soreness", "is", null).not("energy", "is", null).order("created_at", { ascending: false }).limit(8),
    supabase.from("reviews").select("week").not("applied_at", "is", null),
    supabase.from("program_templates").select("template_days(weekday)").not("user_id", "is", null).limit(2),
  ]);
  for (const r of [workoutsRes, exRes, checkRes, reviewRes, tplRes]) if (r.error) throw r.error;

  const workouts = workoutsRes.data ?? [];
  let sets: { workout_id: string; exercise_slug: string; set_number: number; weight_kg: number | null; reps: number | null; seconds: number | null; variant: string | null }[] = [];
  if (workouts.length) {
    const { data } = await supabase.from("sets").select("workout_id, exercise_slug, set_number, weight_kg, reps, seconds, variant").in("workout_id", workouts.map((w) => w.id));
    sets = data ?? [];
  }

  const info = new Map((exRes.data ?? []).map((e) => [e.slug, e]));
  const infoObj = Object.fromEntries([...info].map(([slug, e]) => [slug, { kind: kindOf(e.kind), group: e.muscle_group }]));

  const chips = exercisesWithData(sets).slice(0, 12).map((slug) => {
    const e = info.get(slug)!;
    const kind = kindOf(e.kind);
    return {
      slug, name: e.name, kind,
      values: topSeries(workouts, sets, slug, kind, 8).map((p) => p.value),
      unit: (kind === "timed" ? "s" : kind === "bodyweight" ? "reps" : "kg") as "kg" | "s" | "reps",
    };
  });

  const wk = new Set(weekDates(today));
  const weekIds = workouts.filter((w) => wk.has(w.planned_date)).map((w) => w.id);
  const ws = weekStats(workouts, sets, weekIds, infoObj);
  const planned = (tplRes.data ?? []).reduce((n, t) => Math.max(n, (t.template_days as unknown[]).length), 0) || 5;

  const done = (reviewRes.data ?? []).map((r) => r.week);
  return {
    week,
    empty: workouts.length === 0,
    chips,
    thisWeek: {
      sessions: ws.sessions, planned, sets: ws.sets,
      groups: GROUPS.map((g) => [g, ws.groupSets[g] ?? 0] as [string, number]),
      pbs: ws.pbs.map((p) => {
        const e = info.get(p.slug)!;
        const k = kindOf(e.kind);
        const v = p.value;
        return { name: e.name, text: k === "timed" ? `${v.secs} s` : k === "bodyweight" && !v.kg ? `Bodyweight × ${v.reps}` : `${fmtNum(v.kg ?? 0)} kg × ${v.reps}` };
      }),
    },
    trend: [...(checkRes.data ?? [])].reverse().map((c) => ({ soreness: c.soreness as number, energy: c.energy as number })),
    cells: weekCells(week, done),
    next: nextCheckIn(week, done),
    due: checkInDue(week, done),
  };
}
