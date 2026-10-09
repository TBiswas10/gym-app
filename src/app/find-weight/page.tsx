import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sydneyToday, weekdayOf } from "@/lib/dates";
import { FindWeightView, type Candidate } from "./FindWeightView";

export const dynamic = "force-dynamic";

/** One exercise at a time: the one asked for, or today's weighted exercises that have no starting weight yet. */
export default async function FindWeightPage({ searchParams }: { searchParams: Promise<{ slug?: string; date?: string; all?: string }> }) {
  const { slug, date, all } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) redirect("/login");

  const after = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `/workout?date=${date}` : "/";

  const { data: state } = await supabase.from("program_state").select("plan_type").maybeSingle();
  if (!state) redirect("/install");

  let slugs: string[] = [];
  if (slug && /^[a-z]{2,20}$/.test(slug)) slugs = [slug];
  else if (all) {
    // Re-run setup for any exercise in your plan.
    const { data: tpl } = await supabase.from("program_templates").select("id").eq("user_id", uid).eq("plan_type", state.plan_type).maybeSingle();
    if (tpl) {
      const { data: rows } = await supabase.from("template_exercises").select("exercise_slug, weekday, position").eq("template_id", tpl.id).order("weekday").order("position");
      slugs = [...new Set((rows ?? []).map((r) => r.exercise_slug))];
    }
  } else {
    const origin = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : sydneyToday();
    const { data: tpl } = await supabase.from("program_templates").select("id").eq("user_id", uid).eq("plan_type", state.plan_type).maybeSingle();
    if (tpl) {
      const { data: rows } = await supabase.from("template_exercises").select("exercise_slug, position").eq("template_id", tpl.id).eq("weekday", weekdayOf(origin)).order("position");
      slugs = (rows ?? []).map((r) => r.exercise_slug);
    }
  }
  if (slugs.length === 0) redirect(after);

  const [{ data: exs }, { data: have }] = await Promise.all([
    supabase.from("exercises").select("slug, name, kind, category, weight_step_kg").in("slug", slugs),
    supabase.from("user_exercise_settings").select("exercise_slug, start_weight_kg").in("exercise_slug", slugs).not("start_weight_kg", "is", null),
  ]);
  const done = new Set((have ?? []).map((h) => h.exercise_slug));
  const only = !!slug || !!all; // asked for by name or re-running: offer them even if they already have a weight
  const list: Candidate[] = slugs
    .map((s) => exs?.find((e) => e.slug === s))
    .filter((e): e is NonNullable<typeof e> => !!e && e.kind === "weight" && (only || !done.has(e.slug)))
    .map((e) => ({ slug: e.slug, name: e.name, category: e.category as Candidate["category"], step: Number(e.weight_step_kg) }));
  if (list.length === 0) redirect(after);

  return <FindWeightView list={list} after={after} />;
}
