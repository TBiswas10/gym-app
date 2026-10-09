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

  const { data: ex } = await supabase.from("exercises").select("*").eq("slug", slug).maybeSingle();
  if (!ex) notFound();

  const [{ data: mine }, { data: workouts }, { data: active }] = await Promise.all([
    supabase.from("user_exercise_settings").select("increment_kg, notes").eq("exercise_slug", slug).maybeSingle(),
    supabase.from("workouts").select("id, planned_date").eq("status", "completed").order("planned_date"),
    supabase.from("workouts").select("id").eq("status", "in_progress").maybeSingle(),
  ]);
  let series: number[] = [];
  if (workouts?.length) {
    const { data: sets } = await supabase.from("sets").select("workout_id, exercise_slug, set_number, weight_kg, reps, seconds, variant").eq("exercise_slug", slug).in("workout_id", workouts.map((w) => w.id));
    series = topSeries(workouts, sets ?? [], slug, ex.kind as ExerciseKind, 8).map((p) => p.value);
  }

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
