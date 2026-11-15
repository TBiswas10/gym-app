"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkSetInput, type SetInput } from "./set-rules";

export type Result = { ok: true } | { ok: false; error: string };
const FRIENDLY = "Couldn’t save that. Check your connection and try again.";
const MISSING = "That set could not be found. Refresh the page and try again.";
const NOT_FINISHED = "Only finished sessions can be changed here.";
const UUID = /^[0-9a-f-]{36}$/i;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Loads a set only when its session is completed. RLS already limits both reads to your own rows. */
async function finishedSet(supabase: Supabase, setId: string): Promise<{ ok: true; kind: string } | { ok: false; error: string }> {
  const { data: set, error } = await supabase.from("sets").select("workout_id, exercise_slug").eq("id", setId).maybeSingle();
  if (error) return { ok: false, error: FRIENDLY };
  if (!set) return { ok: false, error: MISSING };
  const [{ data: w, error: wErr }, { data: ex }] = await Promise.all([
    supabase.from("workouts").select("status").eq("id", set.workout_id).maybeSingle(),
    supabase.from("exercises").select("kind").eq("slug", set.exercise_slug).maybeSingle(),
  ]);
  if (wErr) return { ok: false, error: FRIENDLY };
  if (!w) return { ok: false, error: MISSING };
  if (w.status !== "completed") return { ok: false, error: NOT_FINISHED };
  return { ok: true, kind: ex?.kind ?? "weight" };
}

/** Correct one logged set in a finished session. Records, charts and history are derived from sets, so they follow. */
export async function editSet(setId: string, input: SetInput): Promise<Result> {
  if (!UUID.test(setId)) return { ok: false, error: MISSING };
  const supabase = await createClient();
  const found = await finishedSet(supabase, setId);
  if (!found.ok) return found;
  const check = checkSetInput(found.kind, input);
  if (!check.ok) return check;
  const { data, error } = await supabase.from("sets").update(check.values).eq("id", setId).select("id");
  if (error || !data?.length) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Delete one logged set from a finished session. */
export async function deleteSet(setId: string): Promise<Result> {
  if (!UUID.test(setId)) return { ok: false, error: MISSING };
  const supabase = await createClient();
  const found = await finishedSet(supabase, setId);
  if (!found.ok) return found;
  const { data, error } = await supabase.from("sets").delete().eq("id", setId).select("id");
  if (error || !data?.length) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true };
}
