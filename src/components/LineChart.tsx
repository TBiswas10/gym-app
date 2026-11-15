"use client";

import { useState } from "react";
import { chartGeometry, CHART_X, H, nearestIndex, W } from "@/lib/chart";

const MANY = 12;

/** Which points get a label under the axis: all of a short series, else the ends and two between (never a crowd). */
function labelled(n: number): number[] {
  if (n <= 5) return Array.from({ length: n }, (_, i) => i);
  return [...new Set([0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1])];
}

/**
 * Line chart from the design: SVG for the line, HTML for labels, tooltip and 48px tap targets.
 * `labels` (one per point, e.g. dates) replace the session numbers under the axis. A series with many points has
 * no per-point button: a tap anywhere picks the nearest point.
 */
export function LineChart({ values, format, ariaLabel, labels }: { values: number[]; format: (v: number) => string; ariaLabel: string; labels?: string[] }) {
  const [picked, setPicked] = useState(-1);
  if (values.length === 0) return null;
  const n = values.length;
  const sel = picked >= 0 && picked < n ? picked : n - 1;
  const g = chartGeometry(values, sel);
  const many = n > MANY;
  const under = labels && labels.length === n ? labelled(n) : n <= MANY ? values.map((_, i) => i) : [0, n - 1];

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        {g.grid.map((l, i) => (
          <line key={i} className="ch-grid" x1={CHART_X.x0} x2={CHART_X.x1} y1={l.y} y2={l.y} />
        ))}
        {n > 1 && <path className="ch-line" d={g.path} />}
        {g.dots.map((d) => (
          <circle key={d.i} className={d.i === sel ? "ch-dot-hi" : "ch-dot"} cx={d.x} cy={d.y} r={many && d.i !== sel ? 3 : 5} />
        ))}
      </svg>
      {g.grid.map((l, i) => (
        <span key={i} className="ch-lbl ch-lbl-y" style={{ left: l.left, top: l.top }}>{l.label}</span>
      ))}
      {under.map((i) => (
        <span key={i} className="ch-lbl" style={{ left: g.dots[i].left, top: "95%" }}>{labels && labels.length === n ? labels[i] : i + 1}</span>
      ))}
      <span className="ch-tipbox" style={{ left: g.tip.left, top: g.tip.top }}>{format(values[sel])}{labels && labels.length === n ? ` · ${labels[sel]}` : ""}</span>
      {many ? (
        <div
          className="ch-hit-all"
          aria-hidden="true"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setPicked(nearestIndex(((e.clientX - r.left) / r.width) * W, n));
          }}
        />
      ) : (
        g.dots.map((d) => (
          <button key={d.i} type="button" className="ch-pt" style={{ left: d.left }} onClick={() => setPicked(d.i)} aria-label={`Session ${d.i + 1}: ${format(values[d.i])}`} />
        ))
      )}
    </div>
  );
}
