"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Result = { ok: true } | { ok: false; error: string };
const FRIENDLY = "Couldn’t save that. Check your connection and try again.";
const SLUG = /^[a-z]{2,20}$/;

export async function saveMachineNotes(slug: string, notes: string): Promise<Result> {
  if (!SLUG.test(slug) || typeof notes !== "string" || notes.length > 200) return { ok: false, error: FRIENDLY };
  const supabase = await createClient();
  const { error } = await supabase.from("user_exercise_settings").upsert({ exercise_slug: slug, notes: notes.trim() || null }, { onConflict: "user_id,exercise_slug" });
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** The weight jump used when you hit the top of the range on both sets. null puts it back to the default. */
export async function saveIncrement(slug: string, increment: number | null): Promise<Result> {
  if (!SLUG.test(slug) || (increment !== null && (!Number.isFinite(increment) || increment <= 0 || increment > 20))) return { ok: false, error: FRIENDLY };
  const supabase = await createClient();
  const { error } = await supabase.from("user_exercise_settings").upsert({ exercise_slug: slug, increment_kg: increment === null ? null : Math.round(increment * 10) / 10 }, { onConflict: "user_id,exercise_slug" });
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true };
}
