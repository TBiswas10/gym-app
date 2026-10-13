import { sydneyDate, weekdayOf } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { LibraryView } from "./LibraryView";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").select("slug, name, muscle_group, kit, muscles, setup, cues, mistakes").order("sort_order");
  if (error || !data) {
    return (
      <div className="scroll">
        <div className="empty" style={{ paddingTop: "var(--space-12)" }}>
          <h1 className="t-title">Can’t load the library</h1>
          <p className="t-body c-2">Check your connection and try again.</p>
        </div>
      </div>
    );
  }

  // Your current plan: for each exercise, the weekdays it is on. The library is still useful if this cannot load.
  const plan: Record<string, number[]> = {};
  try {
    const { data: state } = await supabase.from("program_state").select("plan_type").maybeSingle();
    if (state?.plan_type) {
      const { data: tpl } = await supabase.from("program_templates").select("id").eq("plan_type", state.plan_type).not("user_id", "is", null).limit(1).maybeSingle();
      if (tpl) {
        const { data: rows } = await supabase.from("template_exercises").select("exercise_slug, weekday").eq("template_id", tpl.id);
        for (const r of rows ?? []) (plan[r.exercise_slug] ??= []).push(r.weekday);
        for (const k of Object.keys(plan)) plan[k] = [...new Set(plan[k])].sort((a, b) => a - b);
      }
    }
  } catch {
    /* no plan marks */
  }

  return <LibraryView plan={plan} todayWeekday={weekdayOf(sydneyDate())} items={data.map((e) => ({ slug: e.slug, name: e.name, group: e.muscle_group, kit: e.kit, muscles: e.muscles, setup: e.setup, cues: e.cues, mistakes: e.mistakes }))} />;
}
