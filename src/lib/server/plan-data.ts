import type { ServerClient } from "../supabase/server";
import type { ExerciseKind } from "../plan";

export interface PlanExercise {
  slug: string;
  name: string;
  kind: ExerciseKind;
  sets: number;
  repLo: number;
  repHi: number;
}
export interface PlanDayData {
  weekday: number;
  shortName: string;
  fullName: string;
  cardioName: string;
  cardioLabel: string;
  cardioMinutes: number;
  exercises: PlanExercise[];
}
export interface PlanData {
  planType: "5day" | "3day";
  templateId: string;
  days: PlanDayData[];
  library: { slug: string; name: string; group: string; kind: ExerciseKind; repLo: number; repHi: number }[];
  restAlerts: boolean;
  trackBodyweight: boolean;
  testMode?: boolean;
  email: string;
  /** Per exercise: your own Swap-button substitute (null = use the built-in one) and the built-in one. */
  backups?: Record<string, { own: string | null; builtin: string | null }>;
}

const kindOf = (k: string): ExerciseKind => (k === "timed" || k === "bodyweight" ? k : "weight");

export async function loadPlan(supabase: ServerClient, uid: string, email: string): Promise<PlanData | null> {
  const { data: state } = await supabase.from("program_state").select("plan_type, rest_alerts, track_bodyweight, test_mode").maybeSingle();
  if (!state) return null;
  const planType = state.plan_type as "5day" | "3day";

  let { data: tpl } = await supabase.from("program_templates").select("id").eq("user_id", uid).eq("plan_type", planType).maybeSingle();
  if (!tpl) {
    await supabase.rpc("clone_template", { p_plan_type: planType });
    ({ data: tpl } = await supabase.from("program_templates").select("id").eq("user_id", uid).eq("plan_type", planType).maybeSingle());
  }
  if (!tpl) throw new Error("plan missing");

  const [daysRes, exRes, libRes, ownRes] = await Promise.all([
    supabase.from("template_days").select("weekday, short_name, full_name, cardio_name, cardio_label, cardio_minutes").eq("template_id", tpl.id).order("weekday"),
    supabase.from("template_exercises").select("weekday, position, sets, rep_lo, rep_hi, exercise_slug, exercises(name, kind)").eq("template_id", tpl.id).order("position"),
    supabase.from("exercises").select("slug, name, muscle_group, kind, rep_lo, rep_hi, backup_name").order("sort_order"),
    supabase.from("user_exercise_settings").select("exercise_slug, backup_name"),
  ]);
  for (const r of [daysRes, exRes, libRes]) if (r.error) throw r.error;

  const days: PlanDayData[] = (daysRes.data ?? []).map((d) => ({
    weekday: d.weekday, shortName: d.short_name, fullName: d.full_name, cardioName: d.cardio_name, cardioLabel: d.cardio_label, cardioMinutes: d.cardio_minutes,
    exercises: (exRes.data ?? [])
      .filter((e) => e.weekday === d.weekday)
      .map((e) => {
        const ex = e.exercises as unknown as { name: string; kind: string } | null;
        return { slug: e.exercise_slug, name: ex?.name ?? e.exercise_slug, kind: kindOf(ex?.kind ?? "weight"), sets: e.sets, repLo: e.rep_lo, repHi: e.rep_hi };
      }),
  }));

  const own = new Map((ownRes.data ?? []).map((r) => [r.exercise_slug, r.backup_name]));
  const backups: NonNullable<PlanData["backups"]> = {};
  for (const e of libRes.data ?? []) backups[e.slug] = { own: own.get(e.slug) ?? null, builtin: e.backup_name };

  return {
    backups,
    planType, templateId: tpl.id, days,
    library: (libRes.data ?? []).map((e) => ({ slug: e.slug, name: e.name, group: e.muscle_group, kind: kindOf(e.kind), repLo: e.rep_lo, repHi: e.rep_hi })),
    restAlerts: state.rest_alerts, trackBodyweight: state.track_bodyweight, testMode: !!state.test_mode, email,
  };
}
