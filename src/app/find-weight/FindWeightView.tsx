"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { firstGuess, jumpLabel, nextAttempt, type Try } from "@/lib/find-weight";
import { fmtNum } from "@/lib/format";
import { saveStartWeight } from "@/app/workout/actions";

export interface Candidate {
  slug: string;
  name: string;
  category: "upper" | "lower" | "core";
  step: number;
}

interface Attempt {
  kg: number;
  how: Try;
}

const WORDS: Record<Try, [string, string]> = { easy: ["Easy", "c-accent"], right: ["Just right", "c-text"], hard: ["Too hard", "c-warning"] };

export function FindWeightView({ list, after }: { list: Candidate[]; after: string }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const c = list[i];
  const [kg, setKg] = useState(firstGuess(c.category));
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const last = i === list.length - 1;

  const rate = (how: Try) => {
    const tries = [...attempts, { kg, how }];
    setAttempts(tries);
    if (how !== "right") {
      setKg(nextAttempt(kg, how, c.step));
      return;
    }
    startTransition(async () => {
      const r = await saveStartWeight(c.slug, kg);
      if (r.ok) {
        setSaved(true);
        setError(null);
      } else {
        setAttempts(attempts); // let them tap again
        setError(r.error);
      }
    });
  };

  const goNext = () => {
    if (last) {
      router.push(after);
      return;
    }
    const n = list[i + 1];
    setI(i + 1);
    setKg(firstGuess(n.category));
    setAttempts([]);
    setSaved(false);
  };

  return (
    <div className="screen fill">
      <div className="scroll">
        <div className="topbar">
          <Link className="icon-btn" href={after.startsWith("/workout") ? "/" : after} aria-label="Close and go back to Today"><Icon name="x" /></Link>
          <span className="t-eyebrow c-accent">Weeks 1–2 · Setup{list.length > 1 ? ` · ${i + 1} of ${list.length}` : ""}</span>
        </div>
        <div className="col g2">
          <h1 className="t-title">Find your weight</h1>
          <p className="t-body c-2">Pick a load you can lift cleanly for about 10 reps with 1 or 2 left in the tank. No pressure to progress yet.</p>
        </div>
        <div className="card" style={{ flexDirection: "row", alignItems: "center", padding: "var(--space-3) var(--space-4)" }}>
          <span className="round round-subtle"><Icon name="dumbbell" /></span>
          <span className="col"><strong className="t-heading">{c.name}</strong><span className="t-small c-2">Target: 10 clean reps</span></span>
        </div>

        {error && (
          <div className="banner banner-danger" role="alert"><Icon name="circle-alert" /><span>{error}</span></div>
        )}

        {!saved ? (
          <section className="card" style={{ alignItems: "center", gap: "var(--space-4)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)" }}>
            <span className="t-eyebrow c-2">Try {attempts.length + 1}</span>
            <div className="stepper" style={{ width: "100%" }}>
              <button type="button" className="step-btn" aria-label={`Decrease by ${fmtNum(c.step)} kg`} onClick={() => setKg(Math.max(c.step, Math.round((kg - c.step) * 100) / 100))}><Icon name="minus" /></button>
              <span className="step-val row" style={{ justifyContent: "center", alignItems: "baseline", gap: "var(--space-1)" }}>
                <span className="num-xl">{fmtNum(kg)}</span><span className="t-heading c-2">kg</span>
              </span>
              <button type="button" className="step-btn" aria-label={`Increase by ${fmtNum(c.step)} kg`} onClick={() => setKg(Math.round((kg + c.step) * 100) / 100)}><Icon name="plus" /></button>
            </div>
            <p className="t-body c-2" style={{ textAlign: "center" }}>Do 10 slow reps, then tell us how it felt.</p>
            <div className="col g2" style={{ width: "100%" }}>
              <button type="button" className="choice" disabled={pending} onClick={() => rate("easy")}>
                <span className="col"><strong>Easy</strong><span className="t-small c-2">3 or more reps left</span></span>
                <span className="t-small c-accent" style={{ fontWeight: 700 }}>{jumpLabel("easy", c.step)}</span>
              </button>
              <button type="button" className="choice choice-primary" disabled={pending} onClick={() => rate("right")}>
                <span className="col"><strong>Just right</strong><span className="t-small">1 or 2 reps left, clean form</span></span>
                <span className="t-small" style={{ fontWeight: 800 }}>Save</span>
              </button>
              <button type="button" className="choice" disabled={pending} onClick={() => rate("hard")}>
                <span className="col"><strong>Too hard</strong><span className="t-small c-2">Missed 10 or form broke</span></span>
                <span className="t-small c-warning" style={{ fontWeight: 700 }}>{jumpLabel("hard", c.step)}</span>
              </button>
            </div>
          </section>
        ) : (
          <section className="card card-accent anim-pop" style={{ alignItems: "center", textAlign: "center", padding: "var(--space-6)", borderRadius: "var(--radius-lg)" }}>
            <span className="round round-accent" style={{ width: 64, height: 64 }}><Icon name="check" size={32} /></span>
            <span className="t-body c-accent" style={{ fontWeight: 700 }}>Starting weight saved</span>
            <span className="num-xl">{fmtNum(kg)} kg</span>
            <p className="t-body c-2">Stay here for two weeks and focus on smooth reps. We’ll tell you when to go up.</p>
            <button type="button" className="btn btn-secondary" onClick={() => { setSaved(false); setAttempts([]); }}>Try again</button>
          </section>
        )}

        {attempts.length > 0 && (
          <section className="col g2">
            <h2 className="t-eyebrow c-2" style={{ marginLeft: "var(--space-1)" }}>Tries</h2>
            {attempts.map((a, n) => (
              <div key={n} className="card" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: "var(--size-tap)", padding: "0 var(--space-4)" }}>
                <span className="t-body" style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtNum(a.kg)} kg × 10</span>
                <span className={`t-body ${WORDS[a.how][1]}`} style={{ fontWeight: 700 }}>{WORDS[a.how][0]}</span>
              </div>
            ))}
          </section>
        )}
      </div>

      <div className="bottom-bar">
        {saved ? (
          <button type="button" className="btn btn-primary btn-cta" onClick={goNext}>{last ? (after.startsWith("/workout") ? "Start workout" : "Done") : "Next exercise"}</button>
        ) : (
          <p className="t-small c-2" style={{ textAlign: "center", minHeight: "var(--size-cta)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            Most people find their weight in 2 or 3 tries.
          </p>
        )}
      </div>
    </div>
  );
}
