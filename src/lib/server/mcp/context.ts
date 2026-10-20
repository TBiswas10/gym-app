import type { ServerClient } from "../../supabase/server";
import { isSetupWeek, programmeWeek, sydneyDate } from "../../dates";
import type { ExerciseKind } from "../../plan";
import type { CatalogItem } from "../../parser";
import { highSoreness, overloadTarget, suggestNext, type LastTime, type Overload, type Reason, type Spec, type Suggestion } from "../../progression";
import { effectOf } from "../../review";
import { lastTimes } from "../workout-data";

export interface ExerciseInfo {
  slug: string;
  name: string;
  kind: ExerciseKind;
  repLo: number;
  repHi: number;
  step: number;
  defaultIncrement: number;
}

export interface Cx {
  today: string;
  week: number;
  setup: boolean;
  hold: boolean;
  highSoreness: boolean;
  lastBySlug: Record<string, LastTime>;
  increments: Map<string, number>;
  exercises: Map<string, ExerciseInfo>;
  catalog: CatalogItem[];
  state: { startDate: string; planType: "5day" | "3day"; deloadWeeks: number[] };
}

const kindOf = (k: string): ExerciseKind => (k === "timed" || k === "bodyweight" ? k : "weight");

/** Everything the read tools need to explain progression, loaded as the signed-in user (RLS applies). */
export async function loadCx(supabase: ServerClient, now = new Date()): Promise<Cx | null> {
  const today = sydneyDate(now);
  const { data: state } = await supabase.from("program_state").select("start_date, plan_type, deload_weeks").maybeSingle();
  if (!state) return null;
  const week = programmeWeek(state.start_date, today);

  const [exRes, setRes, recentRes, soreRes, reviewRes] = await Promise.all([
    supabase.from("exercises").select("slug, name, kind, rep_lo, rep_hi, weight_step_kg, default_increment_kg").order("sort_order"),
    supabase.from("user_exercise_settings").select("exercise_slug, increment_kg"),
    supabase.from("workouts").select("id").eq("status", "completed").order("planned_date", { ascending: false }).limit(12),
    supabase.from("checkins").select("soreness").not("soreness", "is", null).order("created_at", { ascending: false }).limit(3),
    supabase.from("reviews").select("week").eq("chosen", "hold").not("applied_at", "is", null),
  ]);
  for (const r of [exRes, setRes, recentRes, soreRes, reviewRes]) if (r.error) throw r.error;

  const order = (recentRes.data ?? []).map((r) => r.id);
  let sets: Parameters<typeof lastTimes>[0] = [];
  if (order.length) {
    const { data } = await supabase.from("sets").select("workout_id, exercise_slug, set_number, weight_kg, reps, seconds").in("workout_id", order);
    sets = data ?? [];
  }

  const exercises = new Map<string, ExerciseInfo>();
  for (const e of exRes.data ?? []) {
    exercises.set(e.slug, { slug: e.slug, name: e.name, kind: kindOf(e.kind), repLo: e.rep_lo, repHi: e.rep_hi, step: Number(e.weight_step_kg), defaultIncrement: Number(e.default_increment_kg) });
  }
  return {
    today, week, setup: isSetupWeek(week),
    hold: (reviewRes.data ?? []).some((r) => effectOf("hold", r.week).holdWeeks.includes(week)),
    highSoreness: highSoreness([...(soreRes.data ?? []).map((r) => r.soreness as number)].reverse()),
    lastBySlug: lastTimes(sets, order),
    increments: new Map((setRes.data ?? []).filter((s) => s.increment_kg != null).map((s) => [s.exercise_slug, Number(s.increment_kg)])),
    exercises,
    catalog: [...exercises.values()].map((e) => ({ slug: e.slug, name: e.name, kind: e.kind, aliases: e.slug === "glute" ? ["hip thrust machine"] : undefined })),
    state: { startDate: state.start_date, planType: state.plan_type as "5day" | "3day", deloadWeeks: state.deload_weeks },
  };
}

export function specFor(cx: Cx, slug: string, range?: [number, number]): Spec {
  const e = cx.exercises.get(slug)!;
  return { kind: e.kind, repLo: range?.[0] ?? e.repLo, repHi: range?.[1] ?? e.repHi, step: e.step, increment: cx.increments.get(slug) ?? e.defaultIncrement };
}

export function suggestionFor(cx: Cx, slug: string, range?: [number, number]): { spec: Spec; last: LastTime | null; suggestion: Suggestion } {
  const spec = specFor(cx, slug, range);
  const last = cx.lastBySlug[slug] ?? null;
  return { spec, last, suggestion: suggestNext(spec, last, { setup: cx.setup, highSoreness: cx.highSoreness, hold: cx.hold }) };
}

/** Today's goal for one exercise: what to aim for to beat last time (progressive overload). */
export function overloadFor(cx: Cx, slug: string, range?: [number, number]): Overload {
  const spec = specFor(cx, slug, range);
  return overloadTarget(spec, cx.lastBySlug[slug] ?? null, { setup: cx.setup, highSoreness: cx.highSoreness, hold: cx.hold });
}

const REASONS: Record<Reason, string> = {
  "top-hit": "You hit the top of the rep range on both sets last time.",
  "below-top": "Not both sets reached the top of the rep range yet, so hold and build reps.",
  setup: "Weeks 1 and 2 are for finding your weights, so hold.",
  soreness: "Soreness has been 4 or 5 for three sessions in a row, so hold or go light.",
  review: "You chose to hold at your last check-in.",
  "no-history": "No history yet for this exercise.",
};
export const reasonText = (r: Reason): string => REASONS[r];
