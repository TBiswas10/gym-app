import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

// The public, read-only week. Anyone with a live token can open it; the database function returns only totals.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "A week of training", robots: { index: false, follow: false } };

interface Summary {
  label: string;
  week_start: string;
  expires_at: string;
  programme_week: number | null;
  sessions: { date: string; name: string }[];
  sets: number;
  cardio_minutes: number;
  total_sessions: number;
}

const LONG = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const dayOf = (iso: string) => LONG.format(new Date(`${iso}T00:00:00Z`));

export default async function SharedWeek({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = /^[A-Za-z0-9_-]{24,64}$/.test(token) ? await supabase.rpc("share_summary", { p_token: token }) : { data: null };
  const s = data as unknown as Summary | null;

  if (!s) {
    return (
      <div className="screen fill">
        <div className="scroll">
          <div className="empty">
            <h1 className="t-title">This link has ended</h1>
            <p className="t-body c-2">It has expired or was turned off. Ask for a new one.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen fill">
      <div className="scroll">
        <div className="col g1">
          <span className="t-small c-2">Week of {dayOf(s.week_start)}{s.programme_week ? ` · Week ${s.programme_week} of 12` : ""}</span>
          <h1 className="t-title">{s.label || "A week of training"}</h1>
        </div>
        <div className="grid3">
          <div className="card inset" style={{ alignItems: "center", gap: 0, padding: "var(--space-3) var(--space-1)" }}><span className="num-m">{s.sessions.length}</span><span className="t-caption c-2">SESSIONS</span></div>
          <div className="card inset" style={{ alignItems: "center", gap: 0, padding: "var(--space-3) var(--space-1)" }}><span className="num-m">{s.sets}</span><span className="t-caption c-2">SETS</span></div>
          <div className="card inset" style={{ alignItems: "center", gap: 0, padding: "var(--space-3) var(--space-1)" }}><span className="num-m">{s.cardio_minutes}</span><span className="t-caption c-2">CARDIO MIN</span></div>
        </div>
        <section className="card">
          <h2 className="t-heading">Done this week</h2>
          {s.sessions.length === 0 ? (
            <p className="t-small c-2">Nothing logged yet this week.</p>
          ) : (
            <div className="col g2">
              {s.sessions.map((x) => (
                <div key={x.date} className="row between g3">
                  <span className="t-body" style={{ fontWeight: 700 }}>{x.name}</span>
                  <span className="t-small c-2">{dayOf(x.date)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <p className="t-small c-2">{s.total_sessions} sessions in total so far. This page is read-only and updates as the week goes.</p>
      </div>
    </div>
  );
}
