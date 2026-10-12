"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sydneyToday, weekDates } from "@/lib/dates";

export type ActionResult = { ok: true } | { ok: false; error: string };

const FRIENDLY = "Couldn’t save that. Check your connection and try again.";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (d: unknown): d is string => typeof d === "string" && DATE.test(d) && !Number.isNaN(Date.parse(d));

/** Go-light on or off for one planned session. Never overwrites a skip or a move. */
export async function setLight(plannedDate: string, on: boolean): Promise<ActionResult> {
  if (!isDate(plannedDate)) return { ok: false, error: FRIENDLY };
  const supabase = await createClient();

  if (on) {
    const { data: existing } = await supabase.from("schedule_overrides").select("action").eq("planned_date", plannedDate).maybeSingle();
    if (existing && existing.action !== "light") return { ok: false, error: "That day was already skipped or moved." };
    const { error } = await supabase
      .from("schedule_overrides")
      .upsert({ planned_date: plannedDate, action: "light", moved_to_date: null }, { onConflict: "user_id,planned_date" });
    if (error) return { ok: false, error: FRIENDLY };
  } else {
    const { error } = await supabase.from("schedule_overrides").delete().eq("planned_date", plannedDate).eq("action", "light");
    if (error) return { ok: false, error: FRIENDLY };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** The missed-day card: skip it, do a light version, or move it to a free day this week. */
export async function chooseMissed(plannedDate: string, action: "skipped" | "light" | "moved", movedTo?: string): Promise<ActionResult> {
  if (!isDate(plannedDate) || !["skipped", "light", "moved"].includes(action)) return { ok: false, error: FRIENDLY };
  const today = sydneyToday();
  const week = weekDates(today);
  if (!week.includes(plannedDate) || plannedDate >= today) return { ok: false, error: FRIENDLY };
  if (action === "moved" && !(isDate(movedTo) && week.includes(movedTo) && movedTo >= today)) return { ok: false, error: FRIENDLY };

  const supabase = await createClient();
  const { error } = await supabase
    .from("schedule_overrides")
    .upsert({ planned_date: plannedDate, action, moved_to_date: action === "moved" ? movedTo! : null }, { onConflict: "user_id,planned_date" });
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Undo on the missed-day card. */
export async function undoMissed(plannedDate: string): Promise<ActionResult> {
  if (!isDate(plannedDate)) return { ok: false, error: FRIENDLY };
  const supabase = await createClient();
  const { error } = await supabase.from("schedule_overrides").delete().eq("planned_date", plannedDate);
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true };
}

const REST_MINUTES = { walk: 20, stretch: 10 } as const; // the low end of "20-30 min" and the "10 min routine"

/** Rest-day extras: log or un-log an easy walk or a stretch for a date (today or earlier). */
export async function toggleRestLog(date: string, kind: "walk" | "stretch", on: boolean): Promise<ActionResult> {
  if (!isDate(date) || !(kind in REST_MINUTES) || date > sydneyToday()) return { ok: false, error: FRIENDLY };
  const supabase = await createClient();

  if (on) {
    const { data: existing } = await supabase.from("cardio_entries").select("id").eq("kind", kind).eq("logged_on", date).limit(1);
    if (!existing?.length) {
      const { error } = await supabase.from("cardio_entries").insert({ kind, minutes: REST_MINUTES[kind], logged_on: date });
      if (error) return { ok: false, error: FRIENDLY };
    }
  } else {
    const { error } = await supabase.from("cardio_entries").delete().eq("kind", kind).eq("logged_on", date);
    if (error) return { ok: false, error: FRIENDLY };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Skip a session that is today or later this week (it can still be done later with "Do it now"). */
export async function skipDay(plannedDate: string): Promise<ActionResult> {
  if (!isDate(plannedDate)) return { ok: false, error: FRIENDLY };
  const today = sydneyToday();
  if (!weekDates(today).includes(plannedDate) || plannedDate < today) return { ok: false, error: FRIENDLY };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("schedule_overrides").select("action").eq("planned_date", plannedDate).maybeSingle();
  if (existing && existing.action === "moved") return { ok: false, error: "That day was already moved." };
  const { error } = await supabase.from("schedule_overrides").upsert({ planned_date: plannedDate, action: "skipped", moved_to_date: null }, { onConflict: "user_id,planned_date" });
  if (error) return { ok: false, error: FRIENDLY };
  revalidatePath("/", "layout");
  return { ok: true };
}
