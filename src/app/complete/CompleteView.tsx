"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { saveCheckin } from "@/app/workout/actions";

const SORE = ["None", "A little", "Moderate", "Quite sore", "Very sore"];
const ENERGY = ["Drained", "Low", "Okay", "Good", "Buzzing"];

// Fixed confetti pieces from the design (each flies out from the centre).
const CONFETTI = [
  { x: "-70px", y: "-40px", r: "-25deg" }, { x: "-54px", y: "30px", r: "40deg" }, { x: "64px", y: "-46px", r: "30deg" },
  { x: "74px", y: "18px", r: "-35deg" }, { x: "-10px", y: "-72px", r: "15deg" }, { x: "30px", y: "-70px", r: "-20deg" },
  { x: "44px", y: "56px", r: "50deg" }, { x: "-40px", y: "60px", r: "-45deg" },
];

export interface CompleteData {
  name: string;
  sets: number;
  time: string;
  pbs: { name: string; text: string }[];
  cardio: string;
  soreness: number;
  energy: number;
  notes: string;
}

export function CompleteView({ workoutId, data, problem }: { workoutId: string; data: CompleteData; problem: boolean }) {
  const [sore, setSore] = useState(data.soreness);
  const [energy, setEnergy] = useState(data.energy);
  const [saving, setSaving] = useState(false);

  return (
    <form className="screen fill" action={saveCheckin} onSubmit={() => setSaving(true)}>
      <input type="hidden" name="workoutId" value={workoutId} />
      <input type="hidden" name="soreness" value={sore} />
      <input type="hidden" name="energy" value={energy} />
      <div className="scroll">
        <section className="card card-raised" style={{ position: "relative", overflow: "hidden", alignItems: "center", textAlign: "center", padding: "var(--space-6) var(--space-4)", borderRadius: "var(--radius-lg)", gap: "var(--space-3)" }}>
          <div style={{ position: "relative", width: 96, height: 96 }}>
            <span className="confetti" aria-hidden="true">
              {CONFETTI.map((c, i) => (
                <i key={i} style={{ "--x": c.x, "--y": c.y, "--r": c.r } as React.CSSProperties} />
              ))}
            </span>
            <span className="round round-accent anim-pop" style={{ position: "absolute", inset: 0, width: 96, height: 96 }}>
              <Icon name="check" size={48} />
            </span>
          </div>
          <h1 className="t-display">Nice work.</h1>
          <p className="t-body c-2">{data.name} · {data.sets} sets done</p>
          <div className="grid3" style={{ width: "100%" }}>
            {[
              { v: data.sets, l: "SETS", cls: "" },
              { v: data.time, l: "TIME", cls: "" },
              { v: data.pbs.length, l: "NEW PBS", cls: data.pbs.length ? "c-accent" : "" },
            ].map((x) => (
              <div key={x.l} className="card inset" style={{ alignItems: "center", padding: "var(--space-3) var(--space-1)", gap: 0 }}>
                <span className={`num-m ${x.cls}`}>{x.v}</span>
                <span className="t-caption c-2">{x.l}</span>
              </div>
            ))}
          </div>
          {data.pbs.length > 0 && (
            <div className="col g2" style={{ width: "100%" }}>
              {data.pbs.map((p) => (
                <div key={p.name} className="list-row" style={{ padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sm)", background: "var(--accent-subtle)", borderColor: "rgba(198,244,50,.35)", textAlign: "left" }}>
                  <span className="badge-pb">PB</span>
                  <span className="t-body" style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
                  <span className="t-body" style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{p.text}</span>
                </div>
              ))}
            </div>
          )}
          <p className="t-small c-2">Cardio: {data.cardio}</p>
        </section>

        <section className="card" style={{ gap: "var(--space-6)" }}>
          <h2 className="t-heading">How do you feel?</h2>
          <div className="col g1">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <label className="t-body" style={{ fontWeight: 700 }} htmlFor="sore">Soreness</label>
              <span className="t-body c-accent" style={{ fontWeight: 700 }}>{sore} · {SORE[sore - 1]}</span>
            </div>
            <input id="sore" className="slider" type="range" min={1} max={5} step={1} value={sore} style={{ "--pct": `${(sore - 1) * 25}%` } as React.CSSProperties} onChange={(e) => setSore(Number(e.target.value))} aria-valuetext={`${sore}, ${SORE[sore - 1]}`} />
            <div className="row t-caption c-2" style={{ justifyContent: "space-between", textTransform: "none", letterSpacing: 0 }}><span>1 None</span><span>5 Very sore</span></div>
          </div>
          <div className="col g1">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <label className="t-body" style={{ fontWeight: 700 }} htmlFor="energy">Energy</label>
              <span className="t-body c-accent" style={{ fontWeight: 700 }}>{energy} · {ENERGY[energy - 1]}</span>
            </div>
            <input id="energy" className="slider" type="range" min={1} max={5} step={1} value={energy} style={{ "--pct": `${(energy - 1) * 25}%` } as React.CSSProperties} onChange={(e) => setEnergy(Number(e.target.value))} aria-valuetext={`${energy}, ${ENERGY[energy - 1]}`} />
            <div className="row t-caption c-2" style={{ justifyContent: "space-between", textTransform: "none", letterSpacing: 0 }}><span>1 Drained</span><span>5 Buzzing</span></div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="cnotes">Notes</label>
            <textarea id="cnotes" name="notes" className="input" rows={3} defaultValue={data.notes} maxLength={500} placeholder="Anything to remember for next time?" />
          </div>
          {problem && (
            <div className="banner banner-danger" role="alert">
              <Icon name="circle-alert" />
              <span>Couldn’t save that. Check your connection and tap Save and finish again.</span>
            </div>
          )}
        </section>
      </div>
      <div className="bottom-bar">
        <button type="submit" className={`btn btn-primary btn-cta ${saving ? "is-loading" : ""}`} disabled={saving}>Save and finish</button>
      </div>
    </form>
  );
}
