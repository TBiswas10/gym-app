import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPB, type LastTime } from "@/lib/progression";
import { lastTimes } from "@/lib/server/workout-data";
import { encouragement } from "@/lib/encourage";
import { consistency } from "@/lib/stats";
import { weekDates } from "@/lib/dates";
import { mmss } from "@/lib/timers";
import { fmtNum } from "@/lib/format";
import type { ExerciseKind } from "@/lib/plan";
import { CompleteView } from "./CompleteView";

export const dynamic = "force-dynamic";

const MACHINE_WORDS: Record<string, string> = { bike: "bike", treadmill: "treadmill", stair: "stair machine", rower: "rower", xtrainer: "cross-trainer" };

export default async function CompletePage({ searchParams }: { searchParams: Promise<{ w?: string; problem?: string }> }) {
  const { w, problem } = await searchParams;
  if (!w || !/^[0-9a-f-]{36}$/i.test(w)) redirect("/");
  const supabase = await createClient();

  const { data: workout } = await supabase.from("workouts").select("id, day_name, started_at, ended_at, planned_date").eq("id", w).maybeSingle();
  if (!workout) redirect("/");

  const [{ data: sets }, { data: cardio }, { data: recent }, { data: exInfo }, { data: existing }, { data: prog }, { data: done }, { data: ps }] = await Promise.all([
    supabase.from("sets").select("exercise_slug, set_number, variant, weight_kg, reps, seconds").eq("workout_id", w).order("position").order("set_number"),
    supabase.from("cardio_entries").select("kind, minutes").eq("workout_id", w).limit(1),
    supabase.from("workouts").select("id").eq("status", "completed").neq("id", w).order("planned_date", { ascending: false }).limit(12),
    supabase.from("exercises").select("slug, name, kind"),
    supabase.from("checkins").select("soreness, energy, notes, bodyweight_kg").eq("workout_id", w).maybeSingle(),
    supabase.from("program_state").select("track_bodyweight").maybeSingle(),
    supabase.from("workouts").select("planned_date").eq("status", "completed"),
    supabase.from("program_state_view").select("start_date, plan_type, current_week").maybeSingle(),
  ]);

  const order = (recent ?? []).map((r) => r.id);
  let history: Parameters<typeof lastTimes>[0] = [];
  if (order.length) {
    const { data } = await supabase.from("sets").select("workout_id, exercise_slug, set_number, weight_kg, reps, seconds").in("workout_id", order);
    history = data ?? [];
  }
  const last: Record<string, LastTime> = lastTimes(history, order);
  const info = new Map((exInfo ?? []).map((e) => [e.slug, e]));

  // New personal bests against the last session (swapped exercises have no fair comparison).
  const bySlug = new Map<string, NonNullable<typeof sets>>();
  for (const s of sets ?? []) if (!s.variant) bySlug.set(s.exercise_slug, [...(bySlug.get(s.exercise_slug) ?? []), s]);
  const pbs: { name: string; text: string }[] = [];
  for (const [slug, rows] of bySlug) {
    const e = info.get(slug);
    if (!e) continue;
    const kind = e.kind as ExerciseKind;
    const vals = rows.map((r) => ({ kg: r.weight_kg, reps: r.reps, secs: r.seconds }));
    if (!isPB(kind, last[slug] ?? null, vals)) continue;
    const best = vals[vals.length - 1];
    pbs.push({ name: e.name, text: kind === "timed" ? `${best.secs} s` : kind === "bodyweight" && !best.kg ? `Bodyweight × ${best.reps}` : `${fmtNum(best.kg ?? 0)} kg × ${best.reps}` });
  }

  // The warm line: this week's sessions against the plan, and the run of full weeks.
  const planned = ps?.plan_type === "3day" ? 3 : 5;
  const dates = (done ?? []).map((d) => d.planned_date);
  const thisWeek = new Set(weekDates(workout.planned_date));
  const cons = ps?.start_date ? consistency(ps.start_date, dates, planned, ps.current_week ?? 1) : { weeks: [], streak: 0 };
  const line = encouragement({ totalSessions: dates.length, doneThisWeek: dates.filter((d) => thisWeek.has(d)).length, plannedThisWeek: planned, streakWeeks: cons.streak, pbs: pbs.length });

  const endMs = workout.ended_at ? Date.parse(workout.ended_at) : Date.now();
  const secs = Math.max(0, Math.round((endMs - Date.parse(workout.started_at)) / 1000));
  const c = cardio?.[0];

  return (
    <CompleteView
      workoutId={w}
      problem={!!problem}
      data={{
        name: workout.day_name,
        line,
        sets: sets?.length ?? 0,
        time: mmss(secs),
        pbs,
        cardio: c ? `${c.minutes} min on the ${MACHINE_WORDS[c.kind] ?? c.kind}` : "skipped",
        soreness: existing?.soreness ?? 2,
        energy: existing?.energy ?? 4,
        notes: existing?.notes ?? "",
        trackBodyweight: !!prog?.track_bodyweight,
        bodyweight: existing?.bodyweight_kg != null ? String(existing.bodyweight_kg) : "",
      }}
    />
  );
}
