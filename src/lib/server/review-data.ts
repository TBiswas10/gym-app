import type { ServerClient } from "../supabase/server";
import { addDays, sydneyDate, weekdayOf } from "../dates";
import { average, recommend, reasonFor, type Rec, type ReviewInput } from "../review";
import { strengthChange, topSeries } from "../stats";
import type { ExerciseKind } from "../plan";

export interface ReviewData {
  week: number; // 4, 8 or 12
  available: boolean; // that week has begun
  input: ReviewInput;
  rec: Rec;
  why: string;
  rows: { name: string; from: number; to: number; delta: number }[];
  applied: Rec | null;
}

const MAIN = ["chest", "lat", "legpress", "shoulder", "row", "glute"];

/** The numbers behind a check-in: weeks 1..N from the programme start. Computed on the server only. */
export async function loadReview(supabase: ServerClient, week: number, now = new Date()): Promise<ReviewData | null> {
  if (![4, 8, 12].includes(week)) return null;
  const today = sydneyDate(now);
  const { data: state } = await supabase.from("program_state").select("start_date, plan_type").maybeSingle();
  if (!state) return null;

  const from = state.start_date;
  const to = addDays(from, week * 7 - 1);
  const upTo = to < today ? to : today;

  const [tplRes, workoutsRes, checkRes, reviewRes, exRes] = await Promise.all([
    supabase.from("program_templates").select("id").not("user_id", "is", null).eq("plan_type", state.plan_type).maybeSingle(),
    supabase.from("workouts").select("id, planned_date").eq("status", "completed").gte("planned_date", from).lte("planned_date", to).order("planned_date"),
    supabase.from("checkins").select("soreness, energy").gte("checked_on", from).lte("checked_on", to),
    supabase.from("reviews").select("applied_at, chosen").eq("week", week).maybeSingle(),
    supabase.from("exercises").select("slug, name, kind"),
  ]);
  for (const r of [tplRes, workoutsRes, checkRes, exRes]) if (r.error) throw r.error;

  let liftDays: number[] = [];
  if (tplRes.data) {
    const { data } = await supabase.from("template_days").select("weekday").eq("template_id", tplRes.data.id);
    liftDays = (data ?? []).map((d) => d.weekday);
  }
  let planned = 0;
  for (let d = from; d <= upTo; d = addDays(d, 1)) if (liftDays.includes(weekdayOf(d))) planned++;

  const workouts = workoutsRes.data ?? [];
  const input: ReviewInput = {
    sessionsDone: workouts.length,
    sessionsPlanned: planned,
    avgSoreness: average((checkRes.data ?? []).map((c) => c.soreness)),
    avgEnergy: average((checkRes.data ?? []).map((c) => c.energy)),
  };
  const rec = recommend(input);

  let sets: { workout_id: string; exercise_slug: string; set_number: number; weight_kg: number | null; reps: number | null; seconds: number | null; variant: string | null }[] = [];
  if (workouts.length) {
    const { data } = await supabase.from("sets").select("workout_id, exercise_slug, set_number, weight_kg, reps, seconds, variant").in("workout_id", workouts.map((w) => w.id));
    sets = data ?? [];
  }
  const rows = [];
  for (const slug of MAIN) {
    const e = exRes.data?.find((x) => x.slug === slug);
    if (!e) continue;
    const change = strengthChange(topSeries(workouts, sets, slug, e.kind as ExerciseKind, 99));
    if (change) rows.push({ name: e.name, ...change });
  }

  return {
    week,
    available: today >= addDays(from, (week - 1) * 7),
    input, rec, why: reasonFor(rec, input), rows,
    applied: reviewRes.data?.applied_at ? ((reviewRes.data.chosen as Rec | null) ?? null) : null,
  };
}
