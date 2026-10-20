"use client";

import { EdgeBack } from "@/components/EdgeBack";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ExerciseMedia } from "@/components/ExerciseMedia";
import { Icon } from "@/components/Icon";
import { LineChart } from "@/components/LineChart";
import { fmtNum } from "@/lib/format";
import type { ExerciseKind } from "@/lib/plan";
import { saveIncrement, saveFormNote, saveMachineNotes } from "./actions";

const TABS = ["Setup", "How to do it", "Mistakes"];

interface Props {
  slug: string;
  name: string;
  kit: string;
  kind: ExerciseKind;
  muscles: string[];
  tabs: string[][];
  series: number[];
  step: number;
  defaultIncrement: number;
  increment: number | null;
  notes: string;
  formNote?: string;
  hasActive: boolean;
}

export function GuideView({ slug, name, kit, kind, muscles, tabs, series, step, defaultIncrement, increment, notes, formNote = "", hasActive }: Props) {
  const [tab, setTab] = useState(0);
  const [note, setNote] = useState(notes);
  const [cue, setCue] = useState(formNote);
  const [jump, setJump] = useState<number | null>(increment);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const unit = kind === "timed" ? "s" : kind === "bodyweight" ? "reps" : "kg";
  const jumpUnit = kind === "timed" ? "s" : "kg";
  const stepSize = kind === "timed" ? 5 : step;
  const effective = jump ?? defaultIncrement;
  const fmt = (v: number) => `${fmtNum(v)} ${unit}`;
  const delta = series.length > 1 ? series[series.length - 1] - series[0] : 0;

  const saveJump = (v: number | null) => {
    setJump(v);
    startTransition(async () => {
      const r = await saveIncrement(slug, v);
      setError(r.ok ? null : r.error);
    });
  };

  return (
    <div className="screen fill">
      <EdgeBack />
      <div className="scroll">
        <div className="topbar">
          <Link className="btn btn-tertiary" href="/library" style={{ paddingLeft: "var(--space-2)" }}>Library</Link>
        </div>
        <ExerciseMedia slug={slug} name={name} />
        <div className="col g2">
          <h1 className="t-title">{name}</h1>
          <div className="chip-row" style={{ flexWrap: "wrap" }}>
            {muscles.map((m) => <span key={m} className="tag tag-accent">{m}</span>)}
            <span className="tag">{kit}</span>
          </div>
        </div>

        <div className="banner banner-warning"><Icon name="triangle-alert" /><span>Sharp or joint pain? Stop and tell someone.</span></div>
        <div className="segmented" role="tablist" aria-label="Guide sections">
          {TABS.map((t, i) => (
            <button key={t} type="button" className="seg" role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>
        <ol className="col g2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {tabs[tab].map((text, i) => (
            <li key={text} className="card" style={{ flexDirection: "row", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)" }}>
              <span className="round round-subtle" style={{ width: 32, height: 32, flex: "none", fontWeight: 800 }}>{i + 1}</span>
              <span className="t-body">{text}</span>
            </li>
          ))}
        </ol>

        <section className="card" aria-label="Progress">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <div className="col">
              <span className="t-eyebrow c-2">Progress</span>
              <span className="num-m">{series.length ? fmt(series[series.length - 1]) : "–"}</span>
            </div>
            {series.length > 1 && <span className="tag tag-accent">{delta >= 0 ? "+" : "−"}{fmtNum(Math.abs(delta))} {unit} overall</span>}
          </div>
          {series.length > 0 ? (
            <>
              <LineChart values={series} format={fmt} ariaLabel={`${name} by session: ${series.map(fmtNum).join(", ")} ${unit}`} />
              <p className="t-small c-2">{kind === "timed" ? "Longest hold" : kind === "bodyweight" ? "Best set" : "Top set"}, last {series.length} sessions. Numbers are session 1 to {series.length}. Tap a point.</p>
            </>
          ) : (
            <p className="t-small c-2">No sessions yet. Your chart starts after your first workout with this exercise.</p>
          )}
        </section>

        <section className="card">
          <h2 className="t-heading">Weight jump</h2>
          <p className="t-small c-2">
            {kind === "timed" ? "How many seconds to add" : "How much weight to add"} when you reach the top of the range on both sets.
          </p>
          <div className="step-row">
            <span className="col"><strong>{jump === null ? "Default" : "Yours"}</strong><span className="t-caption c-2" style={{ fontWeight: 600 }}>{jumpUnit} each time</span></span>
            <span className="row g2">
              <button type="button" className="step-btn" aria-label="Smaller jump" disabled={effective <= stepSize} onClick={() => saveJump(Math.max(stepSize, Math.round((effective - stepSize) * 10) / 10))}><Icon name="minus" /></button>
              <span className="num-m" style={{ minWidth: 56, textAlign: "center" }}>{fmtNum(effective)}</span>
              <button type="button" className="step-btn" aria-label="Bigger jump" onClick={() => saveJump(Math.round((effective + stepSize) * 10) / 10)}><Icon name="plus" /></button>
            </span>
          </div>
          {jump !== null && <button type="button" className="btn btn-tertiary" style={{ alignSelf: "flex-start" }} onClick={() => saveJump(null)}>Back to default ({fmtNum(defaultIncrement)} {jumpUnit})</button>}
          {error && <div className="banner banner-danger" role="alert"><Icon name="circle-alert" /><span>{error}</span></div>}
          {pending && <span className="t-small c-2">Saving…</span>}
        </section>

        <section className="card">
          <label className="t-heading" htmlFor="fnote">My form cue</label>
          <input autoComplete="off"
            id="fnote" className="input" type="text" maxLength={140} value={cue} placeholder="e.g. Elbows in, don’t flare"
            onChange={(e) => setCue(e.target.value)}
            onBlur={() => startTransition(async () => { const r = await saveFormNote(slug, cue); setError(r.ok ? null : r.error); })}
          />
          <span className="t-small c-2">The one thing you keep getting wrong. It shows under this lift in your workout.</span>
        </section>

        <section className="card">
          <label className="t-heading" htmlFor="mnotes">Machine notes</label>
          <input autoComplete="off"
            id="mnotes" className="input" type="text" maxLength={200} value={note} placeholder="Seat height, pad position…"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => startTransition(async () => { const r = await saveMachineNotes(slug, note); setError(r.ok ? null : r.error); })}
          />
          <span className="t-small c-2">Saved to your account. Shows up in your workout.</span>
        </section>
      </div>
      <div className="bottom-bar">
        <Link className="btn btn-primary btn-cta" href={hasActive ? "/workout" : "/library"}>{hasActive ? "Back to workout" : "Back to Library"}</Link>
      </div>
    </div>
  );
}
