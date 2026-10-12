import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { wordFor } from "@/lib/checkin-scale";
import type { ExerciseKind } from "@/lib/plan";
import { cardioLine, setLine } from "@/lib/server/mcp/format";

export const dynamic = "force-dynamic";

const DAY = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const kindOf = (k: string): ExerciseKind => (k === "timed" || k === "bodyweight" ? k : "weight");

/** One finished session: its sets, cardio and check-in, with a way to fix the check-in. */
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  const { data: w } = await supabase.from("workouts").select("id, planned_date, day_name, status, is_light").eq("id", id).maybeSingle();
  if (!w) notFound();
  const [setsRes, cardioRes, checkRes, exRes] = await Promise.all([
    supabase.from("sets").select("exercise_slug, set_number, position, variant, weight_kg, reps, seconds").eq("workout_id", id).order("position").order("set_number"),
    supabase.from("cardio_entries").select("kind, minutes, feel, params").eq("workout_id", id),
    supabase.from("checkins").select("soreness, energy, notes, bodyweight_kg").eq("workout_id", id).maybeSingle(),
    supabase.from("exercises").select("slug, name, kind"),
  ]);
  const info = new Map((exRes.data ?? []).map((e) => [e.slug, e]));
  const groups = new Map<string, NonNullable<typeof setsRes.data>>();
  for (const s of setsRes.data ?? []) groups.set(s.exercise_slug, [...(groups.get(s.exercise_slug) ?? []), s]);
  const c = checkRes.data;

  return (
    <div className="scroll">
      <div className="topbar">
        <Link className="btn btn-tertiary" href="/progress/history" style={{ paddingLeft: "var(--space-2)" }}>History</Link>
      </div>
      <div className="col g1">
        <span className="t-small c-2">{DAY.format(new Date(`${w.planned_date}T00:00:00Z`))}</span>
        <h1 className="t-title">{w.day_name}{w.is_light ? " (light)" : ""}</h1>
      </div>

      <section className="card">
        <h2 className="t-heading">Sets</h2>
        {groups.size === 0 ? (
          <p className="t-small c-2">No sets were logged.</p>
        ) : (
          <div className="col g3">
            {[...groups].map(([slug, rows]) => {
              const e = info.get(slug);
              const kind = kindOf(e?.kind ?? "weight");
              return (
                <div key={slug} className="col g1">
                  <strong className="t-body">{e?.name ?? slug}{rows[0].variant ? ` (swapped to ${rows[0].variant})` : ""}</strong>
                  {rows.map((r) => (
                    <div key={r.set_number} className="row between">
                      <span className="t-small c-2">Set {r.set_number}</span>
                      <span className="t-body" style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{setLine(kind, r)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="t-heading">Cardio</h2>
        {(cardioRes.data ?? []).length === 0 ? <p className="t-small c-2">None logged.</p> : (cardioRes.data ?? []).map((x, i) => <p key={i} className="t-body">{cardioLine(x)}</p>)}
      </section>

      <section className="card">
        <h2 className="t-heading">Check-in</h2>
        {c ? (
          <div className="col g2">
            <div className="row between"><span className="t-body">Soreness</span><strong className="t-body">{c.soreness != null ? `${wordFor("soreness", c.soreness)} · ${c.soreness} of 5` : "Not rated"}</strong></div>
            <div className="row between"><span className="t-body">Energy</span><strong className="t-body">{c.energy != null ? `${wordFor("energy", c.energy)} · ${c.energy} of 5` : "Not rated"}</strong></div>
            {c.bodyweight_kg != null && <div className="row between"><span className="t-body">Bodyweight</span><strong className="t-body">{Number(c.bodyweight_kg)} kg</strong></div>}
            {c.notes && <p className="t-small c-2">{c.notes}</p>}
          </div>
        ) : (
          <p className="t-small c-2">No check-in was saved for this session.</p>
        )}
        {w.status === "completed" && (
          <Link className="btn btn-secondary btn-block" href={`/complete?w=${w.id}&edit=1`} prefetch={false}>{c ? "Edit check-in" : "Add a check-in"}</Link>
        )}
      </section>
    </div>
  );
}
