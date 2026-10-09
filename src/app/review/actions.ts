"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadReview } from "@/lib/server/review-data";
import { effectOf, REC_LABEL, type Rec } from "@/lib/review";

export type ReviewResult = { ok: true; text: string } | { ok: false; error: string };

/**
 * Apply a check-in choice. The recommendation is recomputed here on the server (the phone only says
 * which option was chosen). Deload adds the next week to your deload weeks; Hold is remembered for two weeks.
 */
export async function applyReview(week: number, chosen: string): Promise<ReviewResult> {
  const FRIENDLY = "Couldn’t save that. Check your connection and try again.";
  if (![4, 8, 12].includes(week) || !(chosen in REC_LABEL)) return { ok: false, error: FRIENDLY };
  const choice = chosen as Rec;

  const supabase = await createClient();
  let data;
  try {
    data = await loadReview(supabase, week);
  } catch {
    return { ok: false, error: FRIENDLY };
  }
  if (!data || !data.available) return { ok: false, error: "That check-in isn’t ready yet." };

  const { error } = await supabase.from("reviews").upsert(
    { week, recommendation: data.rec, chosen: choice, applied_at: new Date().toISOString(), summary: { ...data.input, rows: data.rows } },
    { onConflict: "user_id,week" },
  );
  if (error) return { ok: false, error: FRIENDLY };

  const effect = effectOf(choice, week);
  if (effect.deloadWeeks.length) {
    const { data: state } = await supabase.from("program_state").select("deload_weeks").maybeSingle();
    const merged = [...new Set([...(state?.deload_weeks ?? []), ...effect.deloadWeeks])].sort((a, b) => a - b);
    const { error: e2 } = await supabase.from("program_state").update({ deload_weeks: merged }).not("user_id", "is", null);
    if (e2) return { ok: false, error: FRIENDLY };
  }
  revalidatePath("/");
  revalidatePath("/progress");
  return { ok: true, text: `Added to your plan: ${REC_LABEL[choice]}` };
}
