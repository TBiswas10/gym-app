"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Result = { ok: true } | { ok: false; error: string };
const FRIENDLY = "Couldn’t save that. Check your connection and try again.";
const UUID = /^[0-9a-f-]{36}$/i;
const SLUG = /^[a-z]{2,20}$/;

interface Row {
  slug: string;
  sets: number;
  repLo: number;
  repHi: number;
}

/** Replace one day's exercise list in your own plan (atomic in the database). */
export async function savePlanDay(templateId: string, weekday: number, rows: Row[]): Promise<Result> {
  if (!UUID.test(templateId) || !Number.isInteger(weekday) || weekday < 1 || weekday > 7 || !Array.isArray(rows) || rows.length > 8) return { ok: false, error: FRIENDLY };
  const clean = [];
  for (const r of rows) {
    if (!r || !SLUG.test(r.slug) || ![1, 2].includes(r.sets) || !Number.isInteger(r.repLo) || !Number.isInteger(r.repHi) || r.repLo < 1 || r.repHi < r.repLo || r.repHi > 120) return { ok: false, error: FRIENDLY };
    clean.push({ slug: r.slug, sets: r.sets, rep_lo: r.repLo, rep_hi: r.repHi });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("replace_day_exercises", { p_template: templateId, p_weekday: weekday, p_rows: clean });
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Switch between the 5-day split and the 3-day full body plan. Your start date and history stay as they are. */
export async function switchPlan(planType: string): Promise<Result> {
  if (planType !== "5day" && planType !== "3day") return { ok: false, error: FRIENDLY };
  const supabase = await createClient();
  const { error } = await supabase.rpc("clone_template", { p_plan_type: planType });
  if (error) return { ok: false, error: FRIENDLY };
  const { error: e2 } = await supabase.from("program_state").update({ plan_type: planType }).not("user_id", "is", null);
  if (e2) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveSettings(patch: { restAlerts?: boolean; trackBodyweight?: boolean }): Promise<Result> {
  const update: { rest_alerts?: boolean; track_bodyweight?: boolean } = {};
  if (typeof patch.restAlerts === "boolean") update.rest_alerts = patch.restAlerts;
  if (typeof patch.trackBodyweight === "boolean") update.track_bodyweight = patch.trackBodyweight;
  if (Object.keys(update).length === 0) return { ok: false, error: FRIENDLY };
  const supabase = await createClient();
  const { error } = await supabase.from("program_state").update(update).not("user_id", "is", null);
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Test mode on: any day's session can be started from Today and is flagged as a test.
 * Test mode off: every test session (with its sets, cardio and check-ins) is deleted, so nothing leaks into your history.
 */
export async function setTestMode(on: boolean): Promise<Result & { removed?: number }> {
  const supabase = await createClient();
  let removed = 0;
  if (!on) {
    const { data: tests, error: e1 } = await supabase.from("workouts").select("id").eq("is_test", true);
    if (e1) return { ok: false, error: FRIENDLY };
    const ids = (tests ?? []).map((t) => t.id);
    if (ids.length) {
      // Check-ins keep their row when a workout goes (workout_id is set to null), so remove them first.
      const c = await supabase.from("checkins").delete().in("workout_id", ids);
      if (c.error) return { ok: false, error: FRIENDLY };
      const w = await supabase.from("workouts").delete().in("id", ids);
      if (w.error) return { ok: false, error: FRIENDLY };
      removed = ids.length;
    }
  }
  const { error } = await supabase.from("program_state").update({ test_mode: on }).not("user_id", "is", null);
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true, removed };
}

/** Make a programme week a deload week (half the sets) or take it back. */
export async function setDeloadWeek(week: number, on: boolean): Promise<Result> {
  if (!Number.isInteger(week) || week < 1 || week > 12) return { ok: false, error: FRIENDLY };
  const supabase = await createClient();
  const { data: state } = await supabase.from("program_state").select("deload_weeks").maybeSingle();
  if (!state) return { ok: false, error: FRIENDLY };
  const set = new Set(state.deload_weeks);
  if (on) set.add(week);
  else set.delete(week);
  const { error } = await supabase.from("program_state").update({ deload_weeks: [...set].sort((a, b) => a - b) }).not("user_id", "is", null);
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true };
}
