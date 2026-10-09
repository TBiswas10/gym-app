"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateOp } from "@/lib/ops-validate";
import { applyOps } from "@/lib/server/apply-ops";
import { MAX_OPS_PER_CALL, type Op } from "@/lib/ops";
import { sydneyToday } from "@/lib/dates";

export interface FlushResponse {
  done: number;
  retry: boolean;
  dropped: number;
  signedOut?: boolean;
}

/**
 * The phone's offline queue lands here. Every operation is validated; ones that can never succeed are
 * dropped (so one bad item can't block the queue), temporary failures are reported so the phone retries.
 */
export async function applyOpsAction(raw: unknown): Promise<FlushResponse> {
  if (!Array.isArray(raw) || raw.length > MAX_OPS_PER_CALL) return { done: Array.isArray(raw) ? raw.length : 0, retry: false, dropped: Array.isArray(raw) ? raw.length : 0 };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { done: 0, retry: true, dropped: 0, signedOut: true };

  const valid: Op[] = [];
  const at: number[] = []; // index in `raw` of each valid op
  raw.forEach((r, i) => {
    const op = validateOp(r);
    if (op) {
      valid.push(op);
      at.push(i);
    }
  });
  const invalid = raw.length - valid.length;

  const res = await applyOps(supabase, valid);
  if (res.retry) return { done: at[res.done] ?? raw.length, retry: true, dropped: res.dropped + invalid };
  if (valid.some((o) => o.t === "finish")) revalidatePath("/");
  return { done: raw.length, retry: false, dropped: res.dropped + invalid };
}

const FRIENDLY = "Couldn’t save that. Check your connection and try again.";
export type Result = { ok: true } | { ok: false; error: string };

/** "Find your weight": remember the starting weight for an exercise. */
export async function saveStartWeight(slug: string, kg: number): Promise<Result> {
  if (!/^[a-z]{2,20}$/.test(slug) || !Number.isFinite(kg) || kg < 0 || kg > 400) return { ok: false, error: FRIENDLY };
  const supabase = await createClient();
  const { error } = await supabase.from("user_exercise_settings").upsert({ exercise_slug: slug, start_weight_kg: Math.round(kg * 10) / 10 }, { onConflict: "user_id,exercise_slug" });
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/");
  return { ok: true };
}

/** Session complete: make sure the workout is finished and keep the soreness / energy check-in. */
export async function saveCheckin(formData: FormData) {
  const workoutId = String(formData.get("workoutId") ?? "");
  const soreness = Number(formData.get("soreness"));
  const energy = Number(formData.get("energy"));
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500);
  const bwRaw = String(formData.get("bodyweight") ?? "").trim();
  const bodyweight = bwRaw === "" ? null : Number(bwRaw);
  if (bodyweight !== null && !(Number.isFinite(bodyweight) && bodyweight >= 20 && bodyweight <= 400)) redirect(`/complete?w=${encodeURIComponent(workoutId)}&problem=1`);
  if (!/^[0-9a-f-]{36}$/i.test(workoutId) || ![soreness, energy].every((n) => Number.isInteger(n) && n >= 1 && n <= 5)) redirect(`/complete?w=${encodeURIComponent(workoutId)}&problem=1`);

  const supabase = await createClient();
  const { data: w } = await supabase.from("workouts").select("id, status, planned_date").eq("id", workoutId).maybeSingle();
  if (!w) redirect("/");
  if (w.status === "in_progress") await supabase.from("workouts").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", workoutId);

  const { data: existing } = await supabase.from("checkins").select("id").eq("workout_id", workoutId).maybeSingle();
  const row = { soreness, energy, notes: notes || null, ...(bodyweight !== null ? { bodyweight_kg: Math.round(bodyweight * 10) / 10 } : {}) };
  const { error } = existing
    ? await supabase.from("checkins").update(row).eq("id", existing.id)
    : await supabase.from("checkins").insert({ ...row, workout_id: workoutId, checked_on: sydneyToday() });
  if (error) redirect(`/complete?w=${encodeURIComponent(workoutId)}&problem=1`);
  revalidatePath("/");
  redirect("/");
}
