import { createClient } from "@/lib/supabase/server";
import { toCsv, type Cell } from "@/lib/csv";
import { sydneyDate, sydneyToday } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** All of your workout data as one CSV (sets, cardio, check-ins). Your rows only: row-level security applies. */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return new Response("Please log in first.", { status: 401 });

  const [workouts, sets, cardio, checkins, exercises] = await Promise.all([
    supabase.from("workouts").select("id, planned_date, week, day_name, status, is_light, started_at, ended_at").order("planned_date"),
    supabase.from("sets").select("workout_id, exercise_slug, set_number, variant, weight_kg, reps, seconds, source").order("workout_id").order("position").order("set_number"),
    supabase.from("cardio_entries").select("workout_id, kind, minutes, params, feel, logged_on").order("logged_on"),
    supabase.from("checkins").select("workout_id, checked_on, soreness, energy, bodyweight_kg, notes").order("checked_on"),
    supabase.from("exercises").select("slug, name"),
  ]);
  for (const r of [workouts, sets, cardio, checkins, exercises]) {
    if (r.error) return new Response("Couldn’t build the export. Try again in a moment.", { status: 500 });
  }

  const name = new Map((exercises.data ?? []).map((e) => [e.slug, e.name]));
  const w = new Map((workouts.data ?? []).map((x) => [x.id, x]));

  const header: Cell[] = ["date", "week", "session", "type", "exercise", "set", "weight_kg", "reps", "seconds", "minutes", "machine", "feel", "soreness", "energy", "bodyweight_kg", "notes", "started_sydney", "swapped_to"];
  const rows: Cell[][] = [];
  for (const s of sets.data ?? []) {
    const x = w.get(s.workout_id);
    rows.push([x?.planned_date, x?.week, x?.day_name, "set", name.get(s.exercise_slug) ?? s.exercise_slug, s.set_number, s.weight_kg, s.reps, s.seconds, null, null, null, null, null, null, null, x ? sydneyDate(x.started_at) : null, s.variant]);
  }
  for (const c of cardio.data ?? []) {
    const x = c.workout_id ? w.get(c.workout_id) : undefined;
    rows.push([c.logged_on, x?.week, x?.day_name ?? "Rest day", "cardio", null, null, null, null, null, c.minutes, c.kind, c.feel, null, null, null, JSON.stringify(c.params), null, null]);
  }
  for (const k of checkins.data ?? []) {
    const x = k.workout_id ? w.get(k.workout_id) : undefined;
    rows.push([k.checked_on, x?.week, x?.day_name, "checkin", null, null, null, null, null, null, null, null, k.soreness, k.energy, k.bodyweight_kg, k.notes, null, null]);
  }
  rows.sort((a, b) => String(a[0] ?? "").localeCompare(String(b[0] ?? "")));

  return new Response("﻿" + toCsv([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="workouts-${sydneyToday()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
