"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { cardioSuggestion, machineById, machineLabel, MACHINES, sameAsLastLabel, type Feel, type MachineId, type Params } from "@/lib/cardio";
import { fmtNum } from "@/lib/format";
import type { CardioState } from "@/lib/workout-state";

const FEELS: { id: Feel; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "moderate", label: "Moderate" },
  { id: "hard", label: "Hard" },
];

interface Props {
  cardio: CardioState;
  planLabel: string; // "15 min"
  planName: string; // "Incline treadmill walk or stair machine"
  last: Partial<Record<MachineId, { params: Params; min: number }>>;
  onMachine: (m: MachineId) => void;
  onAdjust: (key: string, dir: 1 | -1) => void;
  onSame: (last: Params) => void;
  onFeel: (f: Feel) => void;
}

/** The cardio step: pick a machine, set the numbers, or repeat last time. */
export function CardioCard({ cardio, planLabel, planName, last, onMachine, onAdjust, onSame, onFeel }: Props) {
  const [picking, setPicking] = useState(false);
  const m = machineById(cardio.machine);
  const params = cardio.params[cardio.machine];
  const prev = last[cardio.machine];

  return (
    <section className="card anim-in">
      <div className="col g1">
        <span className="t-eyebrow c-accent">Cardio · {planLabel}</span>
        <h1 className="t-title">{planName}</h1>
      </div>

      {!picking ? (
        <div className="row between g3 inset" style={{ flexDirection: "row", alignItems: "center", padding: "var(--space-2) var(--space-2) var(--space-2) var(--space-4)" }}>
          <span className="row g3"><Icon name={m.id} /><strong>{machineLabel(m.id)}</strong></span>
          <button type="button" className="btn btn-tertiary" onClick={() => setPicking(true)}>Change</button>
        </div>
      ) : (
        <div className="col g2" role="radiogroup" aria-label="Machine">
          {[MACHINES.slice(0, 3), MACHINES.slice(3)].map((row, i) => (
            <div key={i} className="row g2">
              {row.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  className="msel"
                  role="radio"
                  aria-checked={x.id === cardio.machine}
                  onClick={() => { onMachine(x.id); setPicking(false); }}
                >
                  <Icon name={x.id} />
                  {x.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="col g2">
        {m.params.map((p) => (
          <div key={p.k} className="step-row">
            <span className="col">
              <strong>{p.label}</strong>
              <span className="t-caption c-2" style={{ fontWeight: 600 }}>{p.unit}</span>
            </span>
            <span className="row g2">
              <button type="button" className="step-btn" aria-label={`Decrease ${p.label}`} onClick={() => onAdjust(p.k, -1)}><Icon name="minus" /></button>
              <span className="num-m" style={{ minWidth: 56, textAlign: "center" }}>{fmtNum(params[p.k])}</span>
              <button type="button" className="step-btn" aria-label={`Increase ${p.label}`} onClick={() => onAdjust(p.k, 1)}><Icon name="plus" /></button>
            </span>
          </div>
        ))}
      </div>

      {prev && (
        <button type="button" className="btn btn-secondary btn-block" onClick={() => onSame(prev.params)}>
          <Icon name="rotate-ccw" />
          {sameAsLastLabel(prev.min)}
        </button>
      )}

      {m.tip && (
        <div className="banner banner-info">
          <Icon name="info" />
          <span><b>Form tip.</b> {m.tip}</span>
        </div>
      )}
      <div className="banner banner-success">
        <Icon name="message-circle" />
        <span><b>Talk test.</b> You should be able to speak in full sentences.</span>
      </div>

      <div className="col g2">
        <span className="t-small bold">How did it feel?</span>
        <div className="grid3">
          {FEELS.map((f) => (
            <button key={f.id} type="button" className="chip" aria-pressed={cardio.feel === f.id} onClick={() => onFeel(f.id)}>{f.label}</button>
          ))}
        </div>
      </div>
      <p className="t-small c-accent bold">{cardioSuggestion(prev?.min ?? null, cardio.feel)}</p>
    </section>
  );
}
