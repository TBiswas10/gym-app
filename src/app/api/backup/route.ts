import { createClient } from "@/lib/supabase/server";
import { sydneyToday } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * A full backup of everything in your account as one JSON file: workouts, sets, cardio, check-ins, reviews, your plan,
 * settings, schedule choices and the change log. Your rows only (row-level security applies). Notification
 * subscriptions and connector request logs are left out on purpose.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return new Response("Please log in first.", { status: 401 });

  const [state, workouts, sets, cardio, checkins, reviews, overrides, exSettings, templates, days, tex, changes] = await Promise.all([
    supabase.from("program_state").select("*"),
    supabase.from("workouts").select("*").order("planned_date"),
    supabase.from("sets").select("*").order("logged_at"),
    supabase.from("cardio_entries").select("*").order("logged_at"),
    supabase.from("checkins").select("*").order("created_at"),
    supabase.from("reviews").select("*").order("week"),
    supabase.from("schedule_overrides").select("*").order("planned_date"),
    supabase.from("user_exercise_settings").select("*"),
    supabase.from("program_templates").select("*").not("user_id", "is", null),
    supabase.from("template_days").select("*"),
    supabase.from("template_exercises").select("*").order("position"),
    supabase.from("change_log").select("*").order("created_at"),
  ]);
  const all = [state, workouts, sets, cardio, checkins, reviews, overrides, exSettings, templates, days, tex, changes];
  if (all.some((r) => r.error)) return new Response("Couldn’t build the backup. Try again in a moment.", { status: 500 });

  const mine = new Set((templates.data ?? []).map((t) => t.id));
  const body = {
    app: "workout-tracker",
    version: 1,
    exported_at: new Date().toISOString(),
    exported_on_sydney: sydneyToday(),
    program_state: state.data,
    workouts: workouts.data,
    sets: sets.data,
    cardio_entries: cardio.data,
    checkins: checkins.data,
    reviews: reviews.data,
    schedule_overrides: overrides.data,
    user_exercise_settings: exSettings.data,
    plan: {
      templates: templates.data,
      days: (days.data ?? []).filter((d) => mine.has(d.template_id)),
      exercises: (tex.data ?? []).filter((e) => mine.has(e.template_id)),
    },
    change_log: changes.data,
  };
  return new Response(JSON.stringify(body, null, 1), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="workout-backup-${sydneyToday()}.json"`,
      "cache-control": "no-store",
    },
  });
}
