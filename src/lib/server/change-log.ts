import type { Json } from "../database.types";
import type { ServerClient } from "../supabase/server";

// The change log: every edit or delete Claude makes (and plan/settings edits made in the app) is written here with
// enough of the "before" to put it back. Undo re-applies the "before" and marks the row undone; it never deletes history.

export type ChangeKind =
  | "delete_sets"
  | "delete_workout"
  | "delete_cardio"
  | "edit_plan_day"
  | "schedule_day"
  | "update_settings"
  | "exercise_settings";

export interface ChangeRow {
  id: string;
  created_at: string;
  source: "app" | "claude";
  action: string;
  summary: string;
  undoable: boolean;
  undone_at: string | null;
}

interface Snapshot {
  kind: ChangeKind;
  [k: string]: unknown;
}

export async function recordChange(
  supabase: ServerClient,
  entry: { source: "app" | "claude"; action: ChangeKind; summary: string; before: Snapshot | null; after?: Json | null; undoable: boolean },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("change_log")
    .insert({ source: entry.source, action: entry.action, summary: entry.summary.slice(0, 400), before: (entry.before as Json) ?? null, after: entry.after ?? null, undoable: entry.undoable })
    .select("id")
    .single();
  return error || !data ? null : data.id;
}

export async function listChanges(supabase: ServerClient, limit = 30): Promise<ChangeRow[]> {
  const { data } = await supabase
    .from("change_log")
    .select("id, created_at, source, action, summary, undoable, undone_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ChangeRow[];
}

const strip = <T extends Record<string, unknown>>(row: T): Omit<T, "user_id"> => {
  const { user_id: _u, ...rest } = row as Record<string, unknown>;
  void _u;
  return rest as Omit<T, "user_id">;
};

/** Everything a workout is made of, so deleting it can be undone. */
export async function snapshotWorkout(supabase: ServerClient, workoutId: string) {
  const [w, sets, cardio, checkins] = await Promise.all([
    supabase.from("workouts").select("*").eq("id", workoutId).maybeSingle(),
    supabase.from("sets").select("*").eq("workout_id", workoutId),
    supabase.from("cardio_entries").select("*").eq("workout_id", workoutId),
    supabase.from("checkins").select("*").eq("workout_id", workoutId),
  ]);
  if (!w.data) return null;
  return {
    workout: strip(w.data),
    sets: (sets.data ?? []).map(strip),
    cardio: (cardio.data ?? []).map(strip),
    checkins: (checkins.data ?? []).map(strip),
  };
}

export type UndoResult = { ok: true; summary: string } | { ok: false; error: string };

const FRIENDLY = "Couldn’t undo that. Check your connection and try again.";

/** Put a change back. Only changes marked undoable, and not already undone, can be undone. */
export async function undoChange(supabase: ServerClient, id: string): Promise<UndoResult> {
  const { data: row } = await supabase.from("change_log").select("id, action, summary, before, undoable, undone_at").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "I can’t find that change." };
  if (row.undone_at) return { ok: false, error: "That change was already undone." };
  if (!row.undoable || !row.before) return { ok: false, error: "That change can’t be undone automatically." };
  const b = row.before as unknown as Snapshot & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  let failed = false;
  switch (b.kind) {
    case "delete_workout": {
      const w = await supabase.from("workouts").insert(b.workout);
      if (w.error) return { ok: false, error: w.error.code === "23505" ? "That day already has a session again, so I couldn’t restore the old one." : FRIENDLY };
      if (b.sets?.length) failed = (await supabase.from("sets").insert(b.sets)).error !== null || failed;
      if (b.cardio?.length) failed = (await supabase.from("cardio_entries").insert(b.cardio)).error !== null || failed;
      if (b.checkins?.length) failed = (await supabase.from("checkins").insert(b.checkins)).error !== null || failed;
      break;
    }
    case "delete_sets": {
      failed = (await supabase.from("sets").insert(b.rows)).error !== null;
      break;
    }
    case "delete_cardio": {
      failed = (await supabase.from("cardio_entries").insert(b.rows)).error !== null;
      break;
    }
    case "edit_plan_day": {
      failed = (await supabase.rpc("replace_day_exercises", { p_template: b.template_id, p_weekday: b.weekday, p_rows: b.rows })).error !== null;
      break;
    }
    case "schedule_day": {
      if (b.previous) {
        failed = (await supabase.from("schedule_overrides").upsert(b.previous, { onConflict: "user_id,planned_date" })).error !== null;
      } else {
        failed = (await supabase.from("schedule_overrides").delete().eq("planned_date", b.planned_date)).error !== null;
      }
      break;
    }
    case "update_settings": {
      failed = (await supabase.from("program_state").update(b.previous).not("user_id", "is", null)).error !== null;
      break;
    }
    case "exercise_settings": {
      if (b.previous) {
        failed = (await supabase.from("user_exercise_settings").upsert(b.previous, { onConflict: "user_id,exercise_slug" })).error !== null;
      } else {
        failed = (await supabase.from("user_exercise_settings").delete().eq("exercise_slug", b.exercise_slug)).error !== null;
      }
      break;
    }
    default:
      return { ok: false, error: "That change can’t be undone automatically." };
  }
  if (failed) return { ok: false, error: FRIENDLY };
  await supabase.from("change_log").update({ undone_at: new Date().toISOString() }).eq("id", id);
  return { ok: true, summary: row.summary };
}
