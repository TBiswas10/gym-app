"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { fmtNum } from "@/lib/format";
import { CHOICE_WHY, REC_LABEL, type Rec } from "@/lib/review";
import type { ReviewData } from "@/lib/server/review-data";
import { applyReview } from "./actions";

const STYLE: Record<Rec, { card: string; round: string; icon: IconName }> = {
  build: { card: "card-accent", round: "round-accent", icon: "arrow-up" },
  hold: { card: "card-raised", round: "round-subtle", icon: "equal" },
  deload: { card: "card-warning", round: "round-subtle", icon: "moon" },
};
const OPTIONS: Rec[] = ["build", "hold", "deload"];

export function ReviewView({ data }: { data: ReviewData }) {
  const [pick, setPick] = useState<Rec | null>(null);
  const [appliedText, setAppliedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rec = pick ?? data.applied ?? data.rec;
  const why = pick && pick !== data.rec ? CHOICE_WHY[pick] : data.why;
  const s = STYLE[rec];
  const done = appliedText ?? (data.applied ? `Added to your plan: ${REC_LABEL[data.applied]}` : null);

  const apply = () =>
    startTransition(async () => {
      const r = await applyReview(data.week, rec);
      if (r.ok) {
        setAppliedText(r.text);
        setError(null);
      } else setError(r.error);
    });

  return (
    <div className="screen fill">
      <div className="scroll">
        <div className="topbar">
          <Link className="btn btn-tertiary" href="/progress" style={{ paddingLeft: "var(--space-2)" }}>Progress</Link>
        </div>
        <h1 className="t-title">Week {data.week} check-in</h1>
        <div className="segmented" role="tablist" aria-label="Check-in week">
          {[4, 8, 12].map((n) => (
            <Link key={n} className="seg" role="tab" aria-selected={n === data.week} href={`/review?week=${n}`} replace style={{ textDecoration: "none" }}>Week {n}</Link>
          ))}
        </div>

        {!data.available && (
          <div className="banner banner-info" role="status">
            <Icon name="info" />
            <span>Week {data.week} hasn’t started yet. Here’s how things look so far.</span>
          </div>
        )}

        <div className="grid3">
          <div className="card inset" style={{ alignItems: "center", gap: 0, padding: "var(--space-3) var(--space-1)" }}><span className="num-m">{data.input.sessionsDone}/{data.input.sessionsPlanned}</span><span className="t-caption c-2">SESSIONS</span></div>
          <div className="card inset" style={{ alignItems: "center", gap: 0, padding: "var(--space-3) var(--space-1)" }}><span className="num-m">{data.input.avgSoreness ?? "–"}</span><span className="t-caption c-2">SORENESS</span></div>
          <div className="card inset" style={{ alignItems: "center", gap: 0, padding: "var(--space-3) var(--space-1)" }}><span className="num-m">{data.input.avgEnergy ?? "–"}</span><span className="t-caption c-2">ENERGY</span></div>
        </div>

        <section className="card">
          <h2 className="t-heading">Strength since week 1</h2>
          {data.rows.length > 0 ? (
            <div className="col">
              {data.rows.map((r) => (
                <div key={r.name} className="list-row">
                  <span className="t-body" style={{ flex: 1, fontWeight: 600 }}>{r.name}</span>
                  <span className="t-small c-2" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtNum(r.from)} → {fmtNum(r.to)} kg</span>
                  <span className="t-body c-accent" style={{ fontWeight: 700, minWidth: 64, textAlign: "right" }}>{r.delta >= 0 ? "+" : "−"}{fmtNum(Math.abs(r.delta))}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="t-small c-2">Once you’ve logged a few sessions, your gains show up here.</p>
          )}
        </section>

        <section className={`card anim-pop ${s.card}`}>
          <span className="t-eyebrow c-2">Recommendation</span>
          <div className="row g3">
            <span className={`round ${s.round}`}><Icon name={s.icon} /></span>
            <h2 className="t-title">{REC_LABEL[rec]}</h2>
          </div>
          <p className="t-body c-2">{why}</p>
          <div className="segmented" role="radiogroup" aria-label="Choose a different recommendation">
            {OPTIONS.map((o) => (
              <button key={o} type="button" className="seg" role="radio" aria-checked={o === rec} aria-selected={o === rec} onClick={() => { setPick(o); setAppliedText(null); }}>{REC_LABEL[o]}</button>
            ))}
          </div>
        </section>
      </div>

      <div className="bottom-bar">
        {error && <div className="banner banner-danger" role="alert"><Icon name="circle-alert" /><span>{error}</span></div>}
        {done ? (
          <>
            <div className="banner banner-success anim-pop" role="status"><span>{done}</span></div>
            <Link className="btn btn-primary btn-cta" href="/plan">See my plan</Link>
          </>
        ) : (
          <button type="button" className={`btn btn-primary btn-cta ${pending ? "is-loading" : ""}`} disabled={pending || !data.available} onClick={apply}>
            Apply: {REC_LABEL[rec]}
          </button>
        )}
      </div>
    </div>
  );
}
