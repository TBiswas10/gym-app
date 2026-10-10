"use client";

import { useEffect, useState } from "react";
import { circumference, ringFraction } from "@/lib/rings";

export interface RingValue {
  label: string;
  done: number;
  planned: number;
  unit?: string;
  /** a design token, e.g. "var(--accent)" */
  color: string;
}

const R = [52, 40, 28];
const STROKE = 9;

// Three concentric rings, like Apple's Activity rings: they draw in on arrival and close as the week fills.
export function Rings({ values }: { values: RingValue[] }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = window.requestAnimationFrame(() => setOn(true));
    return () => window.cancelAnimationFrame(t);
  }, []);
  return (
    <div className="rings-wrap">
      <svg className="rings" viewBox="0 0 120 120" role="img" aria-label={values.map((v) => `${v.label} ${v.done} of ${v.planned}`).join(", ")}>
        {values.slice(0, 3).map((v, i) => {
          const c = circumference(R[i]);
          const f = ringFraction(v.done, v.planned);
          return (
            <g key={v.label}>
              <circle cx="60" cy="60" r={R[i]} className="ring-track" strokeWidth={STROKE} />
              <circle
                cx="60"
                cy="60"
                r={R[i]}
                className="ring-bar"
                strokeWidth={STROKE}
                stroke={v.color}
                strokeDasharray={c}
                strokeDashoffset={on ? c * (1 - f) : c}
                style={{ transitionDelay: `${i * 90}ms` }}
              />
            </g>
          );
        })}
      </svg>
      <ul className="rings-legend">
        {values.map((v) => (
          <li key={v.label}>
            <i style={{ background: v.color }} />
            <span className="t-small c-2">{v.label}</span>
            <strong className="t-body tnum">
              {v.done}
              {v.planned > 0 ? <span className="c-2" style={{ fontWeight: 600 }}> / {v.planned}{v.unit ?? ""}</span> : v.unit ? <span className="c-2" style={{ fontWeight: 600 }}>{v.unit}</span> : null}
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
