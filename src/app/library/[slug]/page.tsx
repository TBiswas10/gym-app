import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { topSeries } from "@/lib/stats";
import type { ExerciseKind } from "@/lib/plan";
import { GuideView } from "./GuideView";

export const dynamic = "force-dynamic";

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z]{2,20}$/.test(slug)) notFound();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  // One round trip, all at once (the database is far from the server, so every extra query costs time).
  const [{ data: ex }, { data: mine }, { data: active }, { data: rows }] = await Promise.all([
    supabase.from("exercises").select("*").eq("slug", slug).maybeSingle(),
    supabase.from("user_exercise_settings").select("increment_kg, notes").eq("exercise_slug", slug).maybeSingle(),
    supabase.from("workouts").select("id").eq("status", "in_progress").maybeSingle(),
    supabase
      .from("sets")
      .select("workout_id, exercise_slug, set_number, weight_kg, reps, seconds, variant, workouts!inner(planned_date, status)")
      .eq("exercise_slug", slug)
      .eq("workouts.status", "completed"),
  ]);
  if (!ex) notFound();
  const sets = (rows ?? []).map(({ workouts: _w, ...s }) => s);
  const workouts = [...new Map((rows ?? []).map((r) => [r.workout_id, { id: r.workout_id, planned_date: (r.workouts as unknown as { planned_date: string }).planned_date }])).values()].sort((a, b) => a.planned_date.localeCompare(b.planned_date));
  const series = workouts.length ? topSeries(workouts, sets, slug, ex.kind as ExerciseKind, 8).map((p) => p.value) : [];

  return (
    <GuideView
      slug={slug}
      name={ex.name}
      kit={ex.kit}
      kind={ex.kind as ExerciseKind}
      muscles={ex.muscles}
      tabs={[ex.setup, ex.cues, ex.mistakes]}
      series={series}
      step={Number(ex.weight_step_kg)}
      defaultIncrement={Number(ex.default_increment_kg)}
      increment={mine?.increment_kg != null ? Number(mine.increment_kg) : null}
      notes={mine?.notes ?? ex.default_notes ?? ""}
      hasActive={!!active}
    />
  );
}
