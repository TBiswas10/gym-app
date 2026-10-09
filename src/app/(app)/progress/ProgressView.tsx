"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { LineChart } from "@/components/LineChart";
import { fmtNum } from "@/lib/format";
import type { ProgressData } from "@/lib/server/progress-data";

const CELL_CLASS = { done: "wk-done", now: "wk-now", check: "wk-check", todo: "" } as const;

export function ProgressView({ data }: { data: ProgressData }) {
  const [sel, setSel] = useState(0);
  const chip = data.chips[sel];
  const unit = chip?.unit ?? "kg";
  const fmt = (v: number) => `${fmtNum(v)} ${unit}`;
  const delta = chip && chip.values.length > 1 ? chip.values[chip.values.length - 1] - chip.values[0] : 0;

  return (
    <>
      <div className="scroll">
        <div className="row between">
          <h1 className="t-title">Progress</h1>
          <span className="tag">Week {data.week} of 12</span>
        </div>

        <section className="card" aria-label="Strength">
          {chip ? (
            <>
              <div className="chip-row" role="tablist" aria-label="Exercise">
                {data.chips.map((c, i) => (
                  <button key={c.slug} type="button" className="chip" role="tab" aria-selected={i === sel} onClick={() => setSel(i)}>{c.name}</button>
                ))}
              </div>
              <div className="row between" style={{ alignItems: "flex-end" }}>
                <span className="num-m">{fmt(chip.values[chip.values.length - 1])}</span>
                {chip.values.length > 1 && <span className="tag tag-accent">{delta >= 0 ? "+" : "−"}{fmtNum(Math.abs(delta))} {unit} overall</span>}
              </div>
              <LineChart
                key={chip.slug}
                values={chip.values}
                format={fmt}
                ariaLabel={`${chip.name} ${chip.kind === "timed" ? "longest hold" : chip.kind === "bodyweight" ? "best set" : "top set"} by session: ${chip.values.map(fmtNum).join(", ")} ${unit}`}
              />
              <p className="t-small c-2">{chip.kind === "timed" ? "Longest hold" : chip.kind === "bodyweight" ? "Best set" : "Top set"}, last {chip.values.length} sessions. Tap a point.</p>
            </>
          ) : (
            <div className="empty">
              <span className="round round-subtle"><Icon name="chart" /></span>
              <h2 className="t-heading">Your first session shows up here</h2>
              <p className="t-small c-2">Finish a workout and your strength chart starts.</p>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="t-heading">This week</h2>
          <div className="grid3">
            <div className="card inset" style={{ alignItems: "center", gap: 0, padding: "var(--space-3) var(--space-1)" }}><span className="num-m">{data.thisWeek.sessions}/{data.thisWeek.planned}</span><span className="t-caption c-2">SESSIONS</span></div>
            <div className="card inset" style={{ alignItems: "center", gap: 0, padding: "var(--space-3) var(--space-1)" }}><span className="num-m">{data.thisWeek.sets}</span><span className="t-caption c-2">SETS</span></div>
            <div className="card inset" style={{ alignItems: "center", gap: 0, padding: "var(--space-3) var(--space-1)" }}><span className={`num-m ${data.thisWeek.pbs.length ? "c-accent" : ""}`}>{data.thisWeek.pbs.length}</span><span className="t-caption c-2">NEW PBS</span></div>
          </div>
          <div className="col g3">
            {data.thisWeek.groups.map(([name, n]) => (
              <div key={name} className="row g3">
                <span className="t-small" style={{ width: 84, fontWeight: 600 }}>{name}</span>
                <div className="bar" style={{ flex: 1 }}><i style={{ width: `${Math.min(100, Math.round((n / 10) * 100))}%` }} /></div>
                <span className="t-small" style={{ width: 56, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n} sets</span>
              </div>
            ))}
          </div>
          {data.thisWeek.pbs.length > 0 && (
            <div className="col g2">
              {data.thisWeek.pbs.map((p) => (
                <div key={p.name} className="list-row" style={{ padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sm)", background: "var(--accent-subtle)", border: "1px solid rgba(198,244,50,.35)" }}>
                  <span className="badge-pb">PB</span>
                  <span className="t-body" style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
                  <span className="t-body" style={{ fontWeight: 700 }}>{p.text}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="row between">
            <h2 className="t-heading">Soreness and energy</h2>
            <span className="row g3 t-small c-2">
              <span className="row g1"><i className="legend" style={{ background: "var(--accent)" }} />Energy</span>
              <span className="row g1"><i className="legend" style={{ background: "var(--warning)" }} />Soreness</span>
            </span>
          </div>
          {data.trend.length > 0 ? (
            <>
              <div role="img" aria-label={`Last ${data.trend.length} sessions, 1 to 5 scale. Energy ${data.trend.map((t) => t.energy).join(", ")}. Soreness ${data.trend.map((t) => t.soreness).join(", ")}.`} className="row" style={{ gap: "var(--space-2)", alignItems: "flex-end", height: 96 }}>
                {data.trend.map((t, i) => (
                  <div key={i} className="row" style={{ flex: 1, gap: 3, alignItems: "flex-end", height: "100%" }}>
                    <span style={{ flex: 1, height: t.energy * 18, background: "var(--accent)", borderRadius: 3 }} />
                    <span style={{ flex: 1, height: t.soreness * 18, background: "var(--warning)", borderRadius: 3 }} />
                  </div>
                ))}
              </div>
              <p className="t-small c-2">{trendLine(data.trend)}</p>
            </>
          ) : (
            <p className="t-small c-2">After each session you’ll rate soreness and energy. They show up here.</p>
          )}
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
          <div className="col g1 t-small c-2">
            <span><strong className="c-text">Every week:</strong> Mon Push, Tue Pull, Wed Legs + Core, Thu Upper (light), Sat Lower + Core + Cardio. Fri and Sun rest.</span>
            <span>Weeks 1 and 2: find your weight. Weeks 3 to 12: build.</span>
          </div>
        </section>
      </div>
    </>
  );
}

function trendLine(t: { soreness: number; energy: number }[]): string {
  if (t.length < 2) return "Keep logging to see the trend.";
  const half = Math.max(1, Math.floor(t.length / 2));
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const s = avg(t.slice(-half).map((x) => x.soreness)) - avg(t.slice(0, half).map((x) => x.soreness));
  const e = avg(t.slice(-half).map((x) => x.energy)) - avg(t.slice(0, half).map((x) => x.energy));
  const sPart = s <= -0.5 ? "Soreness is easing as your body adapts." : s >= 0.5 ? "Soreness is creeping up." : "Soreness is steady.";
  const ePart = e >= 0.5 ? "Energy is trending up." : e <= -0.5 ? "Energy is dipping." : "Energy is steady.";
  return `${sPart} ${ePart}`;
}
