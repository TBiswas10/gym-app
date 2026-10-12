import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { wordFor } from "@/lib/checkin-scale";
import { mmss } from "@/lib/timers";

export const dynamic = "force-dynamic";

const DAY = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const dayOf = (iso: string) => DAY.format(new Date(`${iso}T00:00:00Z`));

/** Every finished session, newest first. Tap one to see its sets and fix its check-in. */
export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, planned_date, day_name, started_at, ended_at, is_light")
    .eq("status", "completed")
    .eq("is_test", false)
    .order("planned_date", { ascending: false })
    .limit(60);
  const ids = (workouts ?? []).map((w) => w.id);
  const [setsRes, checkRes] = ids.length
    ? await Promise.all([
        supabase.from("sets").select("workout_id").in("workout_id", ids),
        supabase.from("checkins").select("workout_id, soreness, energy").in("workout_id", ids),
      ])
    : [{ data: [] as { workout_id: string }[] }, { data: [] as { workout_id: string | null; soreness: number | null; energy: number | null }[] }];
  const count = new Map<string, number>();
  for (const s of setsRes.data ?? []) count.set(s.workout_id, (count.get(s.workout_id) ?? 0) + 1);
  const check = new Map((checkRes.data ?? []).map((c) => [c.workout_id, c]));

  return (
    <div className="scroll">
      <div className="topbar">
        <Link className="btn btn-tertiary" href="/progress" style={{ paddingLeft: "var(--space-2)" }}>Progress</Link>
      </div>
      <div className="col g1">
        <h1 className="t-title">History</h1>
        <p className="t-body c-2">Your finished sessions. Open one to see the sets and fix its check-in.</p>
      </div>
      {(workouts ?? []).length === 0 ? (
        <div className="empty">
          <h2 className="t-heading">Nothing here yet</h2>
          <p className="t-small c-2">Finish a workout and it shows up here.</p>
        </div>
      ) : (
        <div className="col g2">
          {(workouts ?? []).map((w) => {
            const c = check.get(w.id);
            const secs = w.ended_at ? Math.max(0, Math.round((Date.parse(w.ended_at) - Date.parse(w.started_at)) / 1000)) : null;
            return (
              <Link key={w.id} className="list-row row-link" href={`/progress/history/${w.id}`} style={{ textDecoration: "none", color: "var(--text)" }}>
                <span className="col" style={{ flex: 1, minWidth: 0 }}>
                  <strong className="t-body">{w.day_name}{w.is_light ? " (light)" : ""}</strong>
                  <span className="t-small c-2">
                    {dayOf(w.planned_date)} · {count.get(w.id) ?? 0} sets{secs !== null ? ` · ${mmss(secs)}` : ""}
                  </span>
                  <span className="t-small c-2">
                    {c?.soreness != null && c?.energy != null ? `Soreness: ${wordFor("soreness", c.soreness)} · Energy: ${wordFor("energy", c.energy)}` : "No check-in"}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
