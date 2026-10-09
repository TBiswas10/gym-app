import type { ServerClient } from "../supabase/server";
import { programmeComplete, programmeWeek, isSetupWeek, sydneyDate, weekDates, longDay } from "../dates";
import { buildStrip, freeDays, missedCard, type MissedCard, type Override, type OverrideAction, type StripDay } from "../schedule";
import type { ExerciseKind } from "../plan";
import { highSoreness } from "../progression";

export interface DayExercise {
  slug: string;
  name: string;
  kind: ExerciseKind;
  sets: number;
  repLo: number;
  repHi: number;
  hasStartWeight: boolean;
}
export interface PlanDay {
  weekday: number;
  shortName: string;
  fullName: string;
  isLightDay: boolean;
  cardioName: string;
  cardioLabel: string;
  cardioMinutes: number;
  exercises: DayExercise[];
}
export interface TodayData {
  today: string;
  startDate: string;
  week: number;
  complete: boolean;
  setup: boolean;
  planType: "5day" | "3day";
  days: Record<number, PlanDay>;
  strip: StripDay[];
  missed: MissedCard | null;
  free: { date: string; label: string }[];
  restLogs: Record<string, { walk: boolean; stretch: boolean }>;
  totalDone: number;
  weekDone: number;
  weekPlan: number;
  weekSets: number;
  toGo: string[]; // weekday names still to do this week
  highSoreness: boolean; // soreness 4-5 for three sessions in a row
}

const KINDS: ExerciseKind[] = ["weight", "timed", "bodyweight"];

/** Everything the Today screen needs, or null when the programme has not been started yet. */
export async function loadToday(supabase: ServerClient, uid: string, now = new Date()): Promise<TodayData | null> {
  const today = sydneyDate(now);

  const { data: state } = await supabase.from("program_state").select("start_date, plan_type").maybeSingle();
  if (!state) return null;
  const planType = state.plan_type as "5day" | "3day";

  const fetchTemplateId = async () => {
    const { data } = await supabase.from("program_templates").select("id").eq("user_id", uid).eq("plan_type", planType).maybeSingle();
    return data?.id ?? null;
  };
  let templateId = await fetchTemplateId();
  if (!templateId) {
    await supabase.rpc("clone_template", { p_plan_type: planType });
    templateId = await fetchTemplateId();
  }
  if (!templateId) throw new Error("plan missing");

  const [daysRes, exRes] = await Promise.all([
    supabase.from("template_days").select("weekday, short_name, full_name, is_light, cardio_name, cardio_label, cardio_minutes").eq("template_id", templateId),
    supabase.from("template_exercises").select("weekday, position, sets, rep_lo, rep_hi, exercise_slug, exercises(name, kind)").eq("template_id", templateId).order("position"),
  ]);
  if (daysRes.error) throw daysRes.error;
  if (exRes.error) throw exRes.error;

  const dates = weekDates(today);
  const [mon, sun] = [dates[0], dates[6]];

  const [workoutsRes, overridesRes, restRes, settingsRes, soreRes] = await Promise.all([
    supabase.from("workouts").select("id, planned_date").eq("status", "completed"),
    supabase.from("schedule_overrides").select("planned_date, action, moved_to_date, created_at").gte("planned_date", mon).lte("planned_date", sun),
    supabase.from("cardio_entries").select("kind, logged_on").in("kind", ["walk", "stretch"]).gte("logged_on", mon).lte("logged_on", sun),
    supabase.from("user_exercise_settings").select("exercise_slug").not("start_weight_kg", "is", null),
    supabase.from("checkins").select("soreness").not("soreness", "is", null).order("created_at", { ascending: false }).limit(3),
  ]);
  for (const r of [workoutsRes, overridesRes, restRes, settingsRes, soreRes]) if (r.error) throw r.error;

  const withWeight = new Set((settingsRes.data ?? []).map((s) => s.exercise_slug));

  const days: Record<number, PlanDay> = {};
  for (const d of daysRes.data ?? []) {
    days[d.weekday] = {
      weekday: d.weekday,
      shortName: d.short_name,
      fullName: d.full_name,
      isLightDay: d.is_light,
      cardioName: d.cardio_name,
      cardioLabel: d.cardio_label,
      cardioMinutes: d.cardio_minutes,
      exercises: [],
    };
  }
  for (const e of exRes.data ?? []) {
    const ex = e.exercises as unknown as { name: string; kind: string } | null;
    days[e.weekday]?.exercises.push({
      slug: e.exercise_slug,
      name: ex?.name ?? e.exercise_slug,
      kind: (KINDS.includes(ex?.kind as ExerciseKind) ? ex!.kind : "weight") as ExerciseKind,
      sets: e.sets,
      repLo: e.rep_lo,
      repHi: e.rep_hi,
      hasStartWeight: withWeight.has(e.exercise_slug),
    });
  }

  const workouts = workoutsRes.data ?? [];
  const completed = new Set(workouts.map((w) => w.planned_date));
  const overrides: Override[] = (overridesRes.data ?? []).map((o) => ({
    plannedDate: o.planned_date,
    action: o.action as OverrideAction,
    movedToDate: o.moved_to_date,
    createdOn: sydneyDate(o.created_at),
  }));

  const liftWeekdays = Object.keys(days).map(Number);
  const strip = buildStrip({ today, startDate: state.start_date, liftWeekdays, completed, overrides });

  const weekWorkoutIds = workouts.filter((w) => dates.includes(w.planned_date)).map((w) => w.id);
  let weekSets = 0;
  if (weekWorkoutIds.length) {
    const { count } = await supabase.from("sets").select("id", { count: "exact", head: true }).in("workout_id", weekWorkoutIds);
    weekSets = count ?? 0;
  }

  const restLogs: TodayData["restLogs"] = {};
  for (const r of restRes.data ?? []) {
    restLogs[r.logged_on] ??= { walk: false, stretch: false };
    if (r.kind === "walk" || r.kind === "stretch") restLogs[r.logged_on][r.kind] = true;
  }

  const week = programmeWeek(state.start_date, today);
  const sessionsThisWeek = strip.filter((d) => d.sessionOrigin);
  return {
    today,
    startDate: state.start_date,
    week,
    complete: programmeComplete(state.start_date, today),
    setup: isSetupWeek(week),
    planType,
    days,
    strip,
    missed: missedCard(strip, overrides, completed, today),
    free: freeDays(strip, today).map((d) => ({ date: d.date, label: longDay(d.weekday) })),
    restLogs,
    totalDone: workouts.length,
    weekDone: sessionsThisWeek.filter((d) => d.status === "done").length,
    weekPlan: liftWeekdays.length,
    weekSets,
    highSoreness: highSoreness([...(soreRes.data ?? []).map((r) => r.soreness as number)].reverse()),
    toGo: strip.filter((d) => d.sessionOrigin && d.date >= today && d.status !== "done").map((d) => longDay(d.weekday)),
  };
}
