import { randomUUID } from "node:crypto";
import type { ServerClient } from "../supabase/server";
import type { Database } from "../database.types";
import { isSetupWeek, programmeWeek, sydneyDate, weekDates, weekdayOf } from "../dates";
import { defaultMachine, isMachine, type Feel, type MachineId, type Params } from "../cardio";
import { highSoreness, stallCheck, type LastTime } from "../progression";
import type { ExerciseKind } from "../plan";
import { effectOf } from "../review";
import type { CatalogItem } from "../parser";
import type { InitExercise, SetVal, WorkoutInit } from "../workout-state";

export interface Guide {
  name: string;
  group: string;
  muscles: string[];
  setup: string[];
  cues: string[];
  mistakes: string[];
}

export interface WorkoutPage {
  init: WorkoutInit;
  meta: {
    workoutId: string;
    sessionName: string;
    startedAt: string;
    cardioName: string;
    cardioLabel: string;
    week: number;
    deload: boolean;
    restAlerts: boolean;
    light: boolean;
    setup: boolean;
    highSoreness: boolean;
    hold: boolean;
  };
  guides: Record<string, Guide>;
  catalog: CatalogItem[];
  lastBySlug: Record<string, LastTime>;
  lastCardio: Partial<Record<MachineId, { params: Params; min: number }>>;
}

export type Loaded = { redirect: string } | { page: WorkoutPage };

const KINDS: ExerciseKind[] = ["weight", "timed", "bodyweight"];
const asKind = (k: string): ExerciseKind => (KINDS.includes(k as ExerciseKind) ? (k as ExerciseKind) : "weight");

/** Per exercise: the most recent completed session's sets. */
export function lastTimes(rows: { workout_id: string; exercise_slug: string; set_number: number; weight_kg: number | null; reps: number | null; seconds: number | null }[], workoutOrder: string[]): Record<string, LastTime> {
  const out: Record<string, LastTime> = {};
  for (const wid of workoutOrder) {
    const bySlug = new Map<string, typeof rows>();
    for (const r of rows) if (r.workout_id === wid) bySlug.set(r.exercise_slug, [...(bySlug.get(r.exercise_slug) ?? []), r]);
    for (const [slug, sets] of bySlug) {
      if (out[slug]) continue;
      const ordered = [...sets].sort((a, b) => a.set_number - b.set_number);
      out[slug] = {
        kg: ordered[0].weight_kg,
        reps: ordered.map((s) => s.reps).filter((v): v is number => v !== null),
        secs: ordered.map((s) => s.seconds).filter((v): v is number => v !== null),
      };
    }
  }
  return out;
}

/** Per exercise: up to `n` most recent completed sessions, newest first. */
export function recentSessions(rows: { workout_id: string; exercise_slug: string; set_number: number; weight_kg: number | null; reps: number | null; seconds: number | null }[], workoutOrder: string[], n = 3): Record<string, LastTime[]> {
  const out: Record<string, LastTime[]> = {};
  for (const wid of workoutOrder) {
    const bySlug = new Map<string, typeof rows>();
    for (const r of rows) if (r.workout_id === wid) bySlug.set(r.exercise_slug, [...(bySlug.get(r.exercise_slug) ?? []), r]);
    for (const [slug, sets] of bySlug) {
      if ((out[slug]?.length ?? 0) >= n) continue;
      const ordered = [...sets].sort((a, b) => a.set_number - b.set_number);
      (out[slug] ??= []).push({
        kg: ordered[0].weight_kg,
        reps: ordered.map((s) => s.reps).filter((v): v is number => v !== null),
        secs: ordered.map((s) => s.seconds).filter((v): v is number => v !== null),
      });
    }
  }
  return out;
}

type WorkoutRow = Database["public"]["Tables"]["workouts"]["Row"];

/**
 * Start the session planned for `date` (an origin date this week). Returns null unless it is a real session:
 * a planned lifting day this week, on or after the start date, not already done, skipped or moved.
 */
export async function startSession(
  supabase: ServerClient,
  ctx: { startDate: string; planType: "5day" | "3day"; templateId: string; week: number; today: string },
  date: string,
): Promise<WorkoutRow | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const dates = weekDates(ctx.today);
  const weekday = weekdayOf(date);
  const [{ data: day }, { data: ovr }, { data: done }] = await Promise.all([
    supabase.from("template_days").select("weekday, full_name").eq("template_id", ctx.templateId).eq("weekday", weekday).maybeSingle(),
    supabase.from("schedule_overrides").select("planned_date, action, moved_to_date, created_at").eq("planned_date", date).maybeSingle(),
    supabase.from("workouts").select("id").eq("status", "completed").eq("planned_date", date).limit(1),
  ]);
  // A skipped day can still be done later (it then shows a tick); a moved one is done from its new slot.
  if (!day || !dates.includes(date) || date < ctx.startDate || done?.length || ovr?.action === "moved") return null;
  const { data: created, error } = await supabase
    .from("workouts")
    .insert({ planned_date: date, week: ctx.week, plan_type: ctx.planType, weekday, day_name: day.full_name, is_light: ovr?.action === "light" })
    .select("*")
    .single();
  return error || !created ? null : created;
}

/** Test mode only: start any template day today, flagged so it can be wiped. Returns null unless test mode is on. */
export async function startTestSession(
  supabase: ServerClient,
  ctx: { planType: "5day" | "3day"; templateId: string; week: number; today: string },
  weekday: number,
): Promise<WorkoutRow | null> {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return null;
  const [{ data: ps }, { data: day }] = await Promise.all([
    supabase.from("program_state").select("test_mode").maybeSingle(),
    supabase.from("template_days").select("weekday, full_name").eq("template_id", ctx.templateId).eq("weekday", weekday).maybeSingle(),
  ]);
  if (!ps?.test_mode || !day) return null;
  const { data: created, error } = await supabase
    .from("workouts")
    .insert({ planned_date: ctx.today, week: Math.min(12, Math.max(1, ctx.week)), plan_type: ctx.planType, weekday, day_name: day.full_name, is_test: true })
    .select("*")
    .single();
  return error || !created ? null : created;
}

export async function loadWorkout(supabase: ServerClient, uid: string, dateParam: string | null, now = new Date(), testWeekday: number | null = null): Promise<Loaded> {
  const today = sydneyDate(now);

  const { data: state } = await supabase.from("program_state_view").select("start_date, plan_type, current_week, deload_weeks, rest_alerts").maybeSingle();
  if (!state || !state.start_date || !state.plan_type) return { redirect: "/install" };
  const planType = state.plan_type as "5day" | "3day";
  const week = programmeWeek(state.start_date, today);

  // Resume the session in progress, otherwise start the one asked for.
  let { data: workout } = await supabase.from("workouts").select("*").eq("status", "in_progress").maybeSingle();

  const { data: tpl } = await supabase.from("program_templates").select("id").eq("user_id", uid).eq("plan_type", planType).maybeSingle();
  if (!tpl) return { redirect: "/" };

  if (!workout) {
    if (testWeekday !== null) {
      workout = await startTestSession(supabase, { planType, templateId: tpl.id, week, today }, testWeekday);
    } else {
      if (!dateParam) return { redirect: "/" };
      workout = await startSession(supabase, { startDate: state.start_date, planType, templateId: tpl.id, week, today }, dateParam);
    }
    if (!workout) return { redirect: "/" };
  }
  const w = workout!;

  const [daysRes, exRes, recentRes, settingsRes, mySetsRes, cardioRes, cardioHistRes, soreRes, catalogRes] = await Promise.all([
    supabase.from("template_days").select("full_name, cardio_name, cardio_label, cardio_minutes").eq("template_id", tpl.id).eq("weekday", w.weekday).maybeSingle(),
    supabase
      .from("template_exercises")
      .select("position, sets, rep_lo, rep_hi, exercise_slug, exercises(name, kind, muscle_group, muscles, setup, cues, mistakes, weight_step_kg, default_increment_kg, default_notes, backup_name)")
      .eq("template_id", tpl.id).eq("weekday", w.weekday).order("position"),
    supabase.from("workouts").select("id").eq("status", "completed").neq("id", w.id).order("planned_date", { ascending: false }).limit(12),
    supabase.from("user_exercise_settings").select("exercise_slug, increment_kg, start_weight_kg, notes"),
    supabase.from("sets").select("id, exercise_slug, set_number, variant, weight_kg, reps, seconds").eq("workout_id", w.id).order("set_number"),
    supabase.from("cardio_entries").select("id, kind, params, feel").eq("workout_id", w.id).limit(1),
    supabase.from("cardio_entries").select("kind, params, minutes").not("kind", "in", "(walk,stretch)").order("logged_at", { ascending: false }).limit(40),
    supabase.from("checkins").select("soreness").not("soreness", "is", null).order("created_at", { ascending: false }).limit(3),
    supabase.from("exercises").select("slug, name, kind").order("sort_order"),
  ]);
  for (const r of [daysRes, exRes, recentRes, settingsRes, mySetsRes, cardioRes, cardioHistRes, soreRes, catalogRes]) if (r.error) throw r.error;
  const day = daysRes.data;
  if (!day) return { redirect: "/" };

  const workoutOrder = (recentRes.data ?? []).map((r) => r.id);
  let historySets: Parameters<typeof lastTimes>[0] = [];
  if (workoutOrder.length) {
    const { data } = await supabase.from("sets").select("workout_id, exercise_slug, set_number, weight_kg, reps, seconds").in("workout_id", workoutOrder);
    historySets = data ?? [];
  }
  const lastBySlug = lastTimes(historySets, workoutOrder);
  const recentBySlug = recentSessions(historySets, workoutOrder, 3);

  const settings = new Map((settingsRes.data ?? []).map((s) => [s.exercise_slug, s]));
  const mySets = mySetsRes.data ?? [];
  const deload = (state.deload_weeks ?? []).includes(week);
  const setup = isSetupWeek(week);
  const { data: reviews } = await supabase.from("reviews").select("week, chosen, applied_at").eq("chosen", "hold").not("applied_at", "is", null);
  const reviewHold = (reviews ?? []).some((r) => effectOf("hold", r.week).holdWeeks.includes(week));
  const sore = highSoreness([...(soreRes.data ?? []).map((r) => r.soreness as number)].reverse());

  const guides: Record<string, Guide> = {};
  const exercises: InitExercise[] = (exRes.data ?? []).map((e) => {
    const ex = e.exercises as unknown as { name: string; kind: string; muscle_group: string; muscles: string[]; setup: string[]; cues: string[]; mistakes: string[]; weight_step_kg: number; default_increment_kg: number; default_notes: string; backup_name: string | null };
    const s = settings.get(e.exercise_slug);
    guides[e.exercise_slug] = { name: ex.name, group: ex.muscle_group, muscles: ex.muscles, setup: ex.setup, cues: ex.cues, mistakes: ex.mistakes };
    const logged: SetVal[] = mySets.filter((m) => m.exercise_slug === e.exercise_slug).map((m) => ({ id: m.id, kg: m.weight_kg, reps: m.reps, secs: m.seconds }));
    return {
      slug: e.exercise_slug,
      name: ex.name,
      kind: asKind(ex.kind),
      repLo: e.rep_lo,
      repHi: e.rep_hi,
      sets: deload ? Math.max(1, Math.ceil(e.sets / 2)) : e.sets,
      step: Number(ex.weight_step_kg),
      increment: Number(s?.increment_kg ?? ex.default_increment_kg),
      last: lastBySlug[e.exercise_slug] ?? null,
      stall: setup ? null : stallCheck({ kind: asKind(ex.kind), repLo: e.rep_lo, repHi: e.rep_hi, step: Number(ex.weight_step_kg) }, recentBySlug[e.exercise_slug] ?? []),
      startWeightKg: s?.start_weight_kg != null ? Number(s.start_weight_kg) : null,
      notes: s?.notes ?? ex.default_notes ?? "",
      backup: ex.backup_name ?? "a similar exercise",
      logged,
      variant: mySets.find((m) => m.exercise_slug === e.exercise_slug && m.variant)?.variant ?? null,
    };
  });

  // Exercises logged by chat that are not in today's plan.
  const planSlugs = new Set(exercises.map((e) => e.slug));
  const catalog: CatalogItem[] = (catalogRes.data ?? []).map((c) => ({ slug: c.slug, name: c.name, kind: asKind(c.kind), aliases: c.slug === "glute" ? ["hip thrust machine"] : undefined }));
  const extraSlugs = [...new Set(mySets.filter((m) => !planSlugs.has(m.exercise_slug)).map((m) => m.exercise_slug))];
  const extras = extraSlugs.map((slug) => {
    const c = catalog.find((x) => x.slug === slug)!;
    return { slug, name: c.name, exKind: c.kind, sets: mySets.filter((m) => m.exercise_slug === slug).map((m) => ({ id: m.id, kg: m.weight_kg, reps: m.reps, secs: m.seconds })) };
  });

  // Cardio: last numbers per machine, and this session's entry if it was already logged.
  const lastCardio: WorkoutPage["lastCardio"] = {};
  for (const r of cardioHistRes.data ?? []) {
    if (isMachine(r.kind) && !lastCardio[r.kind]) lastCardio[r.kind] = { params: { ...(r.params as Params), min: r.minutes }, min: r.minutes };
  }
  const loggedRow = cardioRes.data?.[0];
  const lastParams: Partial<Record<MachineId, Params>> = {};
  for (const [k, v] of Object.entries(lastCardio)) lastParams[k as MachineId] = v.params;

  const light = w.is_light;
  const init: WorkoutInit = {
    workoutId: w.id,
    loggedOn: today,
    light,
    setup,
    highSoreness: sore,
    hold: reviewHold,
    exercises,
    skipped: w.skipped_exercises,
    cardio: {
      machine: (isMachine(loggedRow?.kind) ? loggedRow!.kind : defaultMachine(day.cardio_name)) as MachineId,
      plannedMinutes: day.cardio_minutes,
      lastParams,
      logged: loggedRow && isMachine(loggedRow.kind) ? { id: loggedRow.id, kind: loggedRow.kind, params: loggedRow.params as Params, feel: (loggedRow.feel as Feel | null) ?? null } : null,
      newId: randomUUID(),
    },
    extras,
  };

  return {
    page: {
      init,
      meta: {
        workoutId: w.id, sessionName: w.day_name, startedAt: w.started_at, cardioName: day.cardio_name, cardioLabel: day.cardio_label,
        week, deload, restAlerts: state.rest_alerts ?? true, light, setup, highSoreness: sore, hold: reviewHold,
      },
      guides, catalog, lastBySlug, lastCardio,
    },
  };
}
