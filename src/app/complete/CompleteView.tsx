"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { haptic } from "@/lib/haptics";
import { Icon } from "@/components/Icon";
import { ScalePick } from "@/components/ScalePick";
import { ENERGY_WORDS, SORENESS_WORDS } from "@/lib/checkin-scale";
import { saveCheckin } from "@/app/workout/actions";
import { useSync } from "@/app/workout/useSync";
import { sydneyDate } from "@/lib/dates";

// Fixed confetti pieces from the design (each flies out from the centre).
const CONFETTI = [
  { x: "-70px", y: "-40px", r: "-25deg" }, { x: "-54px", y: "30px", r: "40deg" }, { x: "64px", y: "-46px", r: "30deg" },
  { x: "74px", y: "18px", r: "-35deg" }, { x: "-10px", y: "-72px", r: "15deg" }, { x: "30px", y: "-70px", r: "-20deg" },
  { x: "44px", y: "56px", r: "50deg" }, { x: "-40px", y: "60px", r: "-45deg" },
];

export interface CompleteData {
  name: string;
  line: string;
  sets: number;
  time: string;
  pbs: { name: string; text: string }[];
  cardio: string;
  soreness: number | null; // null until you pick one (no silent defaults)
  energy: number | null;
  notes: string;
  trackBodyweight: boolean;
  bodyweight: string;
}

export function CompleteView({ workoutId, data, problem, initialStage }: { workoutId: string; data: CompleteData; problem: boolean; initialStage?: "tick" | "checkin" }) {
  const [sore, setSore] = useState<number | null>(data.soreness);
  const [energy, setEnergy] = useState<number | null>(data.energy);
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState(false); // saved on the phone because there was no signal
  const [notesText, setNotesText] = useState(data.notes);
  const { enqueue } = useSync();
  // First the whole screen says it is done; then the quick check-in.
  const [stage, setStage] = useState<"tick" | "checkin">(initialStage ?? (problem ? "checkin" : "tick"));
  useEffect(() => {
    if (stage === "tick") haptic("success");
  }, [stage]);

  return (
    <form
      className="screen fill"
      action={saveCheckin}
      onSubmit={(e) => {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          // Nothing to send to: keep it on the phone and let the uploader do it when the signal is back.
          e.preventDefault();
          const raw = new FormData(e.currentTarget).get("bodyweight");
          const bw = raw === null || String(raw).trim() === "" ? null : Number(raw);
          enqueue([
            { t: "finish", workoutId, endedAt: new Date().toISOString() },
            { t: "checkin", workoutId, soreness: sore, energy, notes: notesText.trim().slice(0, 500), bodyweightKg: bw !== null && Number.isFinite(bw) && bw >= 20 && bw <= 400 ? bw : null, checkedOn: sydneyDate(new Date()) },
          ]);
          setLocal(true);
          return;
        }
        setSaving(true);
      }}
    >
      <input type="hidden" name="workoutId" value={workoutId} />
      <input type="hidden" name="soreness" value={sore ?? ""} />
      <input type="hidden" name="energy" value={energy ?? ""} />
      {stage === "tick" ? (
        <Fragment key="tick">
          <div className="scroll done-stage">
            <div className="done-tick-wrap">
              <span className="confetti" aria-hidden="true">
                {CONFETTI.map((c, i) => (
                  <i key={i} style={{ "--x": c.x, "--y": c.y, "--r": c.r } as React.CSSProperties} />
                ))}
              </span>
              <span className="done-tick anim-pop" role="img" aria-label="Workout complete">
                <Icon name="check" size={48} />
              </span>
            </div>
            <h1 className="t-display" style={{ textAlign: "center" }}>Workout complete</h1>
            <p className="t-body c-2" style={{ textAlign: "center" }}>{data.name} · {data.sets} sets · {data.time}</p>
            <p className="t-body c-accent" style={{ fontWeight: 700, textAlign: "center" }}>{data.line}</p>
            {data.pbs.length > 0 && (
              <div className="col g2" style={{ width: "100%" }}>
                {data.pbs.map((p) => (
                  <div key={p.name} className="list-row" style={{ padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sm)", background: "var(--accent-subtle)", textAlign: "left" }}>
                    <span className="badge-pb">PB</span>
                    <span className="t-body" style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
                    <span className="t-body" style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{p.text}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="t-small c-2" style={{ textAlign: "center" }}>Cardio: {data.cardio}</p>
          </div>
          <div className="bottom-bar">
            <button key="continue" type="button" className="btn btn-primary btn-cta" onClick={() => setStage("checkin")}>Continue</button>
          </div>
        </Fragment>
      ) : (
        <Fragment key="checkin">
      <div className="scroll">
        <section className="card" style={{ gap: "var(--space-6)" }}>
          <h2 className="t-heading">How do you feel?</h2>
          <ScalePick label="How sore are you?" hint="1 is not sore at all, 5 is very sore." words={SORENESS_WORDS} value={sore} onChange={setSore} warn />
          <ScalePick label="How much energy do you have?" hint="1 is drained, 5 is buzzing." words={ENERGY_WORDS} value={energy} onChange={setEnergy} />
          {data.trackBodyweight && (
            <div className="field">
              <label className="field-label" htmlFor="bw">Bodyweight (kg), once a week</label>
              <input autoComplete="off" id="bw" name="bodyweight" className="input" type="number" inputMode="decimal" step="0.1" min="20" max="400" defaultValue={data.bodyweight} placeholder="Optional" />
            </div>
          )}
          <div className="field">
            <label className="field-label" htmlFor="cnotes">Notes</label>
            <textarea autoComplete="off" id="cnotes" name="notes" className="input" rows={3} value={notesText} onChange={(e) => setNotesText(e.target.value)} maxLength={500} placeholder="Anything to remember for next time?" />
          </div>
          {local && (
            <div className="banner banner-success" role="status">
              <Icon name="circle-check" />
              <span>Saved on this phone. It uploads on its own when you’re back online.</span>
            </div>
          )}
          {problem && (
            <div className="banner banner-danger" role="alert">
              <Icon name="circle-alert" />
              <span>Couldn’t save that. Check your connection and tap Save and finish again.</span>
            </div>
          )}
        </section>
      </div>
      <div className="bottom-bar">
        <button key="save" type="submit" className={`btn btn-primary btn-cta ${saving ? "is-loading" : ""}`} disabled={saving || sore === null || energy === null}>
          {sore === null || energy === null ? "Pick one for each" : "Save and finish"}
        </button>
        {local ? (
          <Link className="btn btn-primary btn-cta" href="/">Back to Today</Link>
        ) : (
          <button key="skip" type="submit" name="skip" value="1" className="btn btn-tertiary btn-block" disabled={saving}>Skip the check-in</button>
        )}
      </div>
        </Fragment>
      )}
    </form>
  );
}
