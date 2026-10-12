import type { ServerClient } from "../supabase/server";
import type { Op } from "../ops";

type Outcome = "ok" | "permanent" | "transient";

// PostgREST / Postgres error codes that will never succeed on retry (bad reference, constraint, RLS).
const PERMANENT = new Set(["23503", "23514", "23505", "23502", "22P02", "22003", "42501", "PGRST116"]);
const classify = (error: { code?: string } | null): Outcome => (!error ? "ok" : PERMANENT.has(error.code ?? "") ? "permanent" : "transient");

/** Apply one validated operation as the signed-in user (row-level security applies). */
export async function applyOne(supabase: ServerClient, op: Op): Promise<Outcome> {
  switch (op.t) {
    case "set": {
      const { error } = await supabase.from("sets").upsert(
        {
          id: op.id, workout_id: op.workoutId, exercise_slug: op.slug, position: op.position, set_number: op.n,
          variant: op.variant, weight_kg: op.kg, reps: op.reps, seconds: op.secs, source: op.source,
        },
        { onConflict: "workout_id,exercise_slug,set_number" },
      );
      return classify(error);
    }
    case "delset": {
      const { error } = await supabase.from("sets").delete().eq("workout_id", op.workoutId).eq("exercise_slug", op.slug).eq("set_number", op.n);
      return classify(error);
    }
    case "skips": {
      const { error } = await supabase.from("workouts").update({ skipped_exercises: op.slugs }).eq("id", op.workoutId);
      return classify(error);
    }
    case "cardio": {
      const { error } = await supabase.from("cardio_entries").upsert(
        { id: op.id, workout_id: op.workoutId, kind: op.kind, minutes: op.minutes, params: op.params, feel: op.feel, logged_on: op.loggedOn, source: "app" },
        { onConflict: "id" },
      );
      return classify(error);
    }
    case "delcardio": {
      const { error } = await supabase.from("cardio_entries").delete().eq("id", op.id);
      return classify(error);
    }
    case "notes": {
      const { error } = await supabase.from("user_exercise_settings").upsert({ exercise_slug: op.slug, notes: op.notes || null }, { onConflict: "user_id,exercise_slug" });
      return classify(error);
    }
    case "finish": {
      const { error } = await supabase.from("workouts").update({ status: "completed", ended_at: op.endedAt }).eq("id", op.workoutId).eq("status", "in_progress");
      return classify(error);
    }
    case "checkin": {
      // One check-in per workout: update it if it is there, otherwise add it. Safe to send twice.
      const { data: existing, error: e1 } = await supabase.from("checkins").select("id").eq("workout_id", op.workoutId).maybeSingle();
      if (e1) return classify(e1);
      const row = { soreness: op.soreness, energy: op.energy, notes: op.notes || null, ...(op.bodyweightKg !== null ? { bodyweight_kg: op.bodyweightKg } : {}) };
      const { error } = existing
        ? await supabase.from("checkins").update(row).eq("id", existing.id)
        : await supabase.from("checkins").insert({ ...row, workout_id: op.workoutId, checked_on: op.checkedOn });
      return classify(error);
    }
  }
}

export interface ApplyResult {
  /** How many leading operations are finished (applied, or dropped because they can never succeed). */
  done: number;
  /** True if it stopped early on a temporary problem; send the rest again later. */
  retry: boolean;
  dropped: number;
}

/** Apply operations in order. Stops at the first temporary failure so order is preserved. */
export async function applyOps(supabase: ServerClient, ops: Op[]): Promise<ApplyResult> {
  let dropped = 0;
  for (let i = 0; i < ops.length; i++) {
    let outcome: Outcome;
    try {
      outcome = await applyOne(supabase, ops[i]);
    } catch {
      outcome = "transient";
    }
    if (outcome === "transient") return { done: i, retry: true, dropped };
    if (outcome === "permanent") dropped++;
  }
  return { done: ops.length, retry: false, dropped };
}
