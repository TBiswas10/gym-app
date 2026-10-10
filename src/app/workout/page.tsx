import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadWorkout } from "@/lib/server/workout-data";
import { WorkoutView } from "./WorkoutView";

export const dynamic = "force-dynamic";

export default async function WorkoutPage({ searchParams }: { searchParams: Promise<{ date?: string; test?: string }> }) {
  const { date, test } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) redirect("/login");

  let loaded;
  try {
    const tw = test && /^[1-7]$/.test(test) ? Number(test) : null;
    loaded = await loadWorkout(supabase, uid, date ?? null, new Date(), tw);
  } catch {
    return (
      <div className="screen fill">
        <div className="scroll">
          <div className="empty" style={{ paddingTop: "var(--space-12)" }}>
            <h1 className="t-title">Can’t load your workout</h1>
            <p className="t-body c-2">Check your connection and try again. Anything you logged is safe.</p>
          </div>
        </div>
        <div className="bottom-bar"><a className="btn btn-primary btn-cta" href="/">Back to Today</a></div>
      </div>
    );
  }
  if ("redirect" in loaded) redirect(loaded.redirect);
  return <WorkoutView page={loaded.page} />;
}
