"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { recordChange } from "@/lib/server/change-log";
import { recordNumber } from "@/lib/goals";
import { records } from "@/lib/stats";
import type { ExerciseKind } from "@/lib/plan";
import { setDeloadWeek } from "./plan/actions";
import type { ActionResult } from "./actions";

const FRIENDLY = "Couldn’t save that. Check your connection and try again.";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9_-]{1,40}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const kindOf = (k: string): ExerciseKind => (k === "timed" || k === "bodyweight" ? k : "weight");

// ---------------------------------------------------------------- plan nudges
/** Accept or dismiss a nudge. Accepting makes the one small change it describes (and logs it so it can be undone). */
export async function answerNudge(key: string, kind: string, payload: Record<string, string | number>, accept: boolean): Promise<ActionResult> {
  if (typeof key !== "string" || key.length < 3 || key.length > 80) return { ok: false, error: FRIENDLY };
  const supabase = await createClient();

  if (accept) {
    if (kind === "deload") {
      const week = Number(payload.week);
      const r = await setDeloadWeek(week, true);
      if (!r.ok) return { ok: false, error: FRIENDLY };
    } else if (kind === "stalled") {
      const slug = String(payload.slug ?? "");
      const kg = Number(payload.kg);
      if (!SLUG.test(slug) || !(kg > 0 && kg <= 20)) return { ok: false, error: FRIENDLY };
      const { data: prev } = await supabase.from("user_exercise_settings").select("*").eq("exercise_slug", slug).maybeSingle();
      const { error } = await supabase.from("user_exercise_settings").upsert({ exercise_slug: slug, increment_kg: kg }, { onConflict: "user_id,exercise_slug" });
      if (error) return { ok: false, error: FRIENDLY };
      const previous = prev ? (({ user_id: _u, ...r }) => (void _u, r))(prev) : null;
      await recordChange(supabase, { source: "app", action: "exercise_settings", undoable: true, summary: `Weight jump for ${slug} set to ${kg} kg (from a nudge)`, before: { kind: "exercise_settings", exercise_slug: slug, previous } });
    } else if (kind === "tired") {
      const date = String(payload.date ?? "");
      if (!DATE.test(date)) return { ok: false, error: FRIENDLY };
      const { data: prev } = await supabase.from("schedule_overrides").select("planned_date, action, moved_to_date").eq("planned_date", date).maybeSingle();
      if (prev && prev.action !== "light") return { ok: false, error: "That day was already skipped or moved." };
      const { error } = await supabase.from("schedule_overrides").upsert({ planned_date: date, action: "light", moved_to_date: null }, { onConflict: "user_id,planned_date" });
      if (error) return { ok: false, error: FRIENDLY };
      await recordChange(supabase, { source: "app", action: "schedule_day", undoable: true, summary: `${date} set to a light session (from a nudge)`, before: { kind: "schedule_day", planned_date: date, previous: prev ?? null } });
    } else {
      return { ok: false, error: FRIENDLY };
    }
  }

  const { error } = await supabase.from("nudge_responses").upsert({ key, response: accept ? "accepted" : "dismissed" }, { onConflict: "user_id,key" });
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------- goals
export async function saveGoal(slug: string, target: number): Promise<ActionResult> {
  if (!SLUG.test(slug) || !Number.isFinite(target) || target <= 0 || target > 1000) return { ok: false, error: "Enter a number above zero." };
  const supabase = await createClient();
  const { data: ex } = await supabase.from("exercises").select("kind").eq("slug", slug).maybeSingle();
  if (!ex) return { ok: false, error: FRIENDLY };
  const kind = kindOf(ex.kind);

  // The start is your best so far, so the bar shows how far you have come toward the target.
  const { data: done } = await supabase.from("workouts").select("id").eq("status", "completed").eq("is_test", false);
  const ids = (done ?? []).map((w) => w.id);
  let start = 0;
  if (ids.length) {
    const { data: sets } = await supabase.from("sets").select("workout_id, exercise_slug, set_number, weight_kg, reps, seconds, variant").in("workout_id", ids).eq("exercise_slug", slug);
    const rec = records(sets ?? [], { [slug]: kind })[0];
    if (rec) start = recordNumber(kind, rec.value);
  }
  if (target <= start) return { ok: false, error: `You’re already at ${start}. Pick a number above it.` };

  const { error } = await supabase.from("goals").upsert({ exercise_slug: slug, target: Math.round(target * 10) / 10, start_value: start }, { onConflict: "user_id,exercise_slug" });
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeGoal(id: string): Promise<ActionResult> {
  if (!UUID.test(id)) return { ok: false, error: FRIENDLY };
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------- share links
const SHARE_DAYS = 7;

/** A read-only link to this week's totals. The token is the secret; it expires after a week and can be revoked. */
export async function createShareLink(label: string): Promise<ActionResult> {
  const clean = String(label ?? "").trim().slice(0, 40);
  const supabase = await createClient();
  const token = randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + SHARE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("share_links").insert({ token, label: clean, expires_at: expires });
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/plan/share");
  return { ok: true };
}

export async function revokeShareLink(id: string): Promise<ActionResult> {
  if (!UUID.test(id)) return { ok: false, error: FRIENDLY };
  const supabase = await createClient();
  const { error } = await supabase.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/plan/share");
  return { ok: true };
}
