"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { LineChart } from "@/components/LineChart";
import { GoalsCard, ReviewCard } from "@/components/V2Cards";
import { direction, wordFor } from "@/lib/checkin-scale";
import { fmtNum } from "@/lib/format";
import type { ProgressData } from "@/lib/server/progress-data";

const CELL_CLASS = { done: "wk-done", now: "wk-now", check: "wk-check", todo: "" } as const;
const SHOWN = 3;

export function ProgressView({ data }: { data: ProgressData }) {
  // Every lift with a number, biggest gain first. The one you tap gets the full chart underneath.
  const rows = data.chips.map((c, i) => {
    const first = c.values[0];
    const last = c.values[c.values.length - 1];
    return { c, i, last, delta: last - first, pct: first ? (last - first) / first : 0, moved: c.values.length > 1 };
  });
  const ordered = [...rows].sort((a, b) => b.pct - a.pct);
  const withChange = rows.filter((r) => r.moved);
  const up = withChange.filter((r) => r.delta > 0).length;
  const best = ordered.find((r) => r.moved && r.delta > 0) ?? null;

  const [tab, setTab] = useState<"strength" | "week" | "plan">("strength");
  const [sel, setSel] = useState(best ? best.i : 0);
  const [all, setAll] = useState(false);
  const chip = data.chips[sel];
  const unit = chip?.unit ?? "kg";
  const fmt = (v: number) => `${fmtNum(v)} ${unit}`;
  const delta = chip && chip.values.length > 1 ? chip.values[chip.values.length - 1] - chip.values[0] : 0;
  const shown = all ? ordered : ordered.slice(0, SHOWN);

  // One line that says where you are, before any chart.
  const streak = data.consistency.streak;
  const story = data.empty
    ? "Finish your first workout and this page fills in."
    : [
        `Week ${data.week} of 12.`,
        withChange.length > 0 ? `${up} of ${withChange.length} lifts are up.` : "",
        streak > 0 ? `${streak} full ${streak === 1 ? "week" : "weeks"} in a row.` : "",
      ].filter(Boolean).join(" ");

  // Tapping a record opens that lift's chart at the top.
  const strengthRef = useRef<HTMLElement | null>(null);
  const openLift = (name: string) => {
    const r = rows.find((x) => x.c.name === name);
    if (!r) return;
    setSel(r.i);
    setAll(true);
    strengthRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const energy = data.trend.map((t) => t.energy);
  const soreness = data.trend.map((t) => t.soreness);

  return (
    <>
      <div className="scroll stagger">
        <div className="row between">
          <h1 className="t-title">Progress</h1>
          <Link className="btn btn-tertiary" href="/progress/history">History</Link>
        </div>
        <p className="t-body" style={{ fontWeight: 700 }}>{story}</p>

        <div className="segmented" role="tablist" aria-label="Progress sections">
          {([["strength", "Strength"], ["week", "This week"], ["plan", "12 weeks"]] as const).map(([id, label]) => (
            <button key={id} type="button" className="seg" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        <div hidden={tab !== "strength"} className="col g4" role="tabpanel">
        <section className="card" aria-label="Strength" ref={strengthRef}>
          {chip ? (
            <>
              <div className="col g1">
                <span className="t-caption c-2">STRENGTH</span>
                {withChange.length > 0 ? (
                  <>
                    <span className="row g2" style={{ alignItems: "baseline" }}>
                      <span className="num-m">{up} of {withChange.length}</span>
                      <span className="t-body c-2">lifts are up</span>
                    </span>
                    {best && <p className="t-small c-2">Biggest jump: <strong className="c-text">{best.c.name}</strong>, +{fmtNum(best.delta)} {best.c.unit}</p>}
                  </>
                ) : (
                  <p className="t-body">Your first numbers are in. Do each lift once more and the trends start.</p>
                )}
              </div>

              <div className="col g1" role="group" aria-label="Your lifts, biggest gain first">
                {shown.map((r) => {
                  const dir = !r.moved ? "" : r.delta > 0 ? "srow-up" : r.delta < 0 ? "srow-down" : "c-2";
                  return (
                    <button key={r.c.slug} type="button" className="srow" aria-pressed={r.i === sel} onClick={() => setSel(r.i)}>
                      <span className="srow-name">{r.c.name}</span>
                      <Spark values={r.c.values} />
                      <span className="srow-val">
                        <b>{fmtNum(r.last)} {r.c.unit}</b>
                        <span className={`t-caption ${dir}`} style={{ textTransform: "none", letterSpacing: 0 }}>
                          {!r.moved ? "first session" : r.delta === 0 ? "no change" : `${r.delta > 0 ? "+" : "−"}${fmtNum(Math.abs(r.delta))} ${r.c.unit}`}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {ordered.length > SHOWN && (
                  <button type="button" className="btn btn-tertiary" onClick={() => setAll((v) => !v)}>
                    {all ? "Show fewer" : `Show all ${ordered.length} lifts`}
                  </button>
                )}
              </div>

              <div className="col g2">
                <div className="row between" style={{ alignItems: "flex-end" }}>
                  <span className="col" style={{ minWidth: 0 }}>
                    <span className="t-caption c-2">{chip.name.toUpperCase()}</span>
                    <span className="num-m">{fmt(chip.values[chip.values.length - 1])}</span>
                  </span>
                  {chip.values.length > 1 && <span className="tag tag-accent">{delta >= 0 ? "+" : "−"}{fmtNum(Math.abs(delta))} {unit} over {chip.values.length} sessions</span>}
                </div>
                <LineChart
                  key={chip.slug}
                  values={chip.values}
                  format={fmt}
                  ariaLabel={`${chip.name} ${chip.kind === "timed" ? "longest hold" : chip.kind === "bodyweight" ? "best set" : "top set"} by session: ${chip.values.map(fmtNum).join(", ")} ${unit}`}
                />
                <p className="t-small c-2">{chip.kind === "timed" ? "Longest hold" : chip.kind === "bodyweight" ? "Best set" : "Top set"}, last {chip.values.length} sessions. Tap a point.</p>
              </div>
            </>
          ) : (
            <div className="empty">
              <span className="round round-subtle"><Icon name="chart" /></span>
              <h2 className="t-heading">Your first session shows up here</h2>
              <p className="t-small c-2">Finish a workout and your strength chart starts.</p>
            </div>
          )}
        </section>

        <GoalsCard goals={data.goals ?? []} choices={data.chips.map((c) => ({ slug: c.slug, name: c.name, unit: c.unit }))} />

        {data.records.length > 0 && (
          <details className="card fold" aria-label="Records">
            <summary><h2 className="t-heading">Records</h2><span className="t-small c-2">{data.records.length}</span></summary>
            <div className="col g2">
              {data.records.map((r) => (
                <button key={r.name} type="button" className="rec-row" onClick={() => openLift(r.name)} aria-label={`${r.name}, best ${r.text}. Show its chart.`}>
                  <span className="t-body">{r.name}</span>
                  <span className="row g2">
                    <span className="t-body" style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.text}</span>
                    <span className="c-2"><Icon name="chevron-right" size={16} /></span>
                  </span>
                </button>
              ))}
            </div>
          </details>
        )}

        <ReviewCard reviews={data.reviews ?? []} />
        </div>

        <div hidden={tab !== "week"} className="col g4" role="tabpanel">
        {data.volume && data.volume.some((v) => v.kg > 0) && <VolumeCard weeks={data.volume} point={data.volumeNow} />}
        <section className="card">
          <h2 className="t-heading">This week</h2>
          <div className="grid3">
            <div className="card inset" style={{ alignItems: "center", gap: 0, padding: "var(--space-3) var(--space-1)" }}><span className="num-m">{data.thisWeek.sessions}/{data.thisWeek.planned}</span><span className="t-caption c-2">SESSIONS</span></div>
            <div className="card inset" style={{ alignItems: "center", gap: 0, padding: "var(--space-3) var(--space-1)" }}><span className="num-m">{data.thisWeek.sets}</span><span className="t-caption c-2">SETS</span></div>
            <div className="card inset" style={{ alignItems: "center", gap: 0, padding: "var(--space-3) var(--space-1)" }}><span className={`num-m ${data.thisWeek.pbs.length ? "c-accent" : ""}`}>{data.thisWeek.pbs.length}</span><span className="t-caption c-2">NEW PBS</span></div>
          </div>
          <details className="fold-in">
            <summary>Sets per muscle group</summary>
            <div className="col g3" style={{ paddingTop: "var(--space-2)" }}>
              {data.thisWeek.groups.map(([name, n]) => (
                <div key={name} className="row g3">
                  <span className="t-small" style={{ width: 84, fontWeight: 600 }}>{name}</span>
                  <div className="bar" style={{ flex: 1 }}><i style={{ transform: `scaleX(${Math.min(100, Math.round((n / 10) * 100)) / 100})` }} /></div>
                  <span className="t-small" style={{ width: 56, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n} sets</span>
                </div>
              ))}
            </div>
          </details>
          {data.thisWeek.pbs.length > 0 && (
            <div className="col g2">
              {data.thisWeek.pbs.map((p) => (
                <div key={p.name} className="list-row" style={{ padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sm)", background: "var(--accent-subtle)", border: "1px solid var(--accent-edge)" }}>
                  <span className="badge-pb">PB</span>
                  <span className="t-body" style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
                  <span className="t-body" style={{ fontWeight: 700 }}>{p.text}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" aria-label="How you have felt">
          <h2 className="t-heading">How you’ve felt</h2>
          {data.trend.length > 0 ? (
            <>
              <Trend5 label="Energy" kind="energy" values={energy} tone="var(--accent)" />
              <Trend5 label="Soreness" kind="soreness" values={soreness} tone="var(--warning)" />
              <p className="t-small c-2">From your check-in after each session, last {data.trend.length}. Energy 1 is drained, 5 is buzzing. Soreness 1 is none, 5 is very sore.</p>
            </>
          ) : (
            <p className="t-small c-2">After each session you’ll rate soreness and energy. They show up here.</p>
          )}
        </section>

        </div>

        <div hidden={tab !== "plan"} className="col g4" role="tabpanel">
        <section className="card" aria-label="Consistency">
          <div className="row between baseline">
            <h2 className="t-heading">Consistency</h2>
            <span className="t-small c-2">{data.consistency.streak > 0 ? `${data.consistency.streak} ${data.consistency.streak === 1 ? "full week" : "full weeks"} in a row` : "Finish every planned session to start a run"}</span>
          </div>
          <div className="consistency" role="img" aria-label="Sessions finished each week against the plan">
            {data.consistency.weeks.map((w) => (
              <span key={w.week} className={`consistency-col ${w.week === data.week ? "is-now" : ""}`}>
                <span className="consistency-track"><i style={{ height: `${Math.min(100, Math.round((w.done / Math.max(1, w.planned)) * 100))}%` }} className={w.done >= w.planned ? "is-full" : ""} /></span>
                <span className="t-caption c-2">{w.week}</span>
              </span>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="t-heading">12-week program</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: "var(--space-2)" }}>
            {data.cells.map((c) => (
              <div key={c.week} className={`week ${CELL_CLASS[c.cell]}`}><span>{c.week}</span></div>
            ))}
          </div>
          {data.next && (
            <Link className="verdict verdict-up" href={`/review?week=${data.due ?? data.next}`} style={{ textDecoration: "none", color: "var(--text)" }}>
              <span className="round round-accent"><Icon name="calendar" /></span>
              <span className="col" style={{ flex: 1 }}>
                <strong>{data.due ? `Week ${data.due} check-in is ready` : `Week ${data.next} check-in next`}</strong>
                <span className="t-small c-2">Review weeks 4, 8 and 12</span>
              </span>
              <span className="c-accent"><Icon name="chevron-right" /></span>
            </Link>
          )}
          <details className="fold-in">
            <summary>How the 12 weeks work</summary>
            <div className="col g1 t-small c-2" style={{ paddingTop: "var(--space-2)" }}>
              <span><strong className="c-text">Every week:</strong> Mon Push, Tue Pull, Wed Legs + Core, Thu Upper (light), Sat Lower + Core + Cardio. Fri and Sun rest.</span>
              <span>Weeks 1 and 2: find your weight. Weeks 3 to 12: build.</span>
            </div>
          </details>
        </section>
        </div>
      </div>
    </>
  );
}

/** A tiny line for one lift: oldest to newest, with the latest point filled. */
function Spark({ values }: { values: number[] }) {
  const W = 64;
  const H = 24;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i: number) => (values.length === 1 ? W / 2 : (i * W) / (values.length - 1));
  const y = (v: number) => (hi === lo ? H / 2 : H - 3 - ((v - lo) / (hi - lo)) * (H - 6));
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {values.length > 1 && <path d={d} />}
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} />
    </svg>
  );
}

/** One 1-5 series as a line, with the latest answer in words and which way is better written out. */
function Trend5({ label, kind, values, tone }: { label: string; kind: "soreness" | "energy"; values: number[]; tone: string }) {
  const W = 300;
  const H = 72;
  const px = 12;
  const py = 10;
  const n = values.length;
  const x = (i: number) => (n === 1 ? W / 2 : px + (i * (W - 2 * px)) / (n - 1));
  const y = (v: number) => py + ((5 - v) * (H - 2 * py)) / 4;
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = values[n - 1];
  const dir = direction(values);
  const phrase = dir === "flat" ? "Steady" : kind === "energy" ? (dir === "up" ? "Rising" : "Dipping") : dir === "down" ? "Easing" : "Creeping up";
  return (
    <div className="t5" style={{ "--tone": tone } as CSSProperties}>
      <div className="t5-head">
        <strong className="t-body">{label}</strong>
        <span className="t-body" style={{ color: tone, fontWeight: 800 }}>{wordFor(kind, last)} · {last} of 5</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}, 1 to 5, last ${n} sessions: ${values.join(", ")}`}>
        {[1, 2, 3, 4, 5].map((v) => (
          <line key={v} className="t5-grid" x1={px} x2={W - px} y1={y(v)} y2={y(v)} />
        ))}
        {n > 1 && <path className="t5-line" d={d} />}
        {values.map((v, i) => (
          <circle key={i} className={i === n - 1 ? "t5-now" : "t5-dot"} cx={x(i)} cy={y(v)} r={i === n - 1 ? 6 : 4} />
        ))}
      </svg>
      <div className="row between t-small c-2">
        <span>{kind === "energy" ? "Higher is better" : "Lower is better"}</span>
        <span>{phrase}</span>
      </div>
    </div>
  );
}

/** Total kg lifted per week: the plainest measure of progressive overload. More over time is the point. */
function VolumeCard({ weeks, point }: { weeks: { weekStart: string; kg: number }[]; point?: { now: number; lastSame: number; lastWeek: number } }) {
  const now = point?.now ?? weeks[weeks.length - 1].kg;
  const max = Math.max(1, ...weeks.map((w) => w.kg));
  // Like with like: this week so far against the same point of last week, never against a whole finished week.
  const pct = point && point.lastSame > 0 ? Math.round(((now - point.lastSame) / point.lastSame) * 100) : null;
  const day = (iso: string) => String(Number(iso.slice(8, 10)));
  const kg = (n: number) => `${n.toLocaleString("en-AU")} kg`;
  const from = weeks[0].weekStart;
  const to = weeks[weeks.length - 1].weekStart;
  const long = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { timeZone: "UTC", day: "numeric", month: "short" });
  return (
    <section className="card" aria-label="Training volume">
      <div className="row between baseline g2">
        <h2 className="t-heading">Training volume</h2>
        {pct !== null && <span className={`tag ${pct >= 0 ? "tag-accent" : ""}`}>{pct >= 0 ? "+" : "−"}{Math.abs(pct)}% vs same point last week</span>}
      </div>
      <div className="col g1">
        <span className="num-m">{kg(now)}</span>
        <span className="t-small c-2">weight × reps so far this week{point ? `. Last week in full: ${kg(point.lastWeek)}.` : "."}</span>
      </div>
      <div className="consistency" role="img" aria-label={`Kilograms lifted per week, weeks starting ${weeks.map((w) => `${long(w.weekStart)} ${w.kg}`).join(", ")}`}>
        {weeks.map((w, i) => (
          <span key={w.weekStart} className={`consistency-col ${i === weeks.length - 1 ? "is-now" : ""}`}>
            <span className="consistency-track"><i style={{ height: `${Math.round((w.kg / max) * 100)}%` }} className={i === weeks.length - 1 ? "is-full" : ""} /></span>
            <span className="t-caption c-2 vol-day">{day(w.weekStart)}</span>
          </span>
        ))}
      </div>
      <p className="t-small c-2">Weeks start on Monday ({long(from)} to {long(to)}). Progressive overload is doing a little more over time: more weight, or more reps at the same weight. The bars are the total of both.</p>
    </section>
  );
}
