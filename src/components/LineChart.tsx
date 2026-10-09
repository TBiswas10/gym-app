"use client";

import { useState } from "react";
import { chartGeometry, CHART_X, H, W } from "@/lib/chart";

/** Line chart from the design: SVG for the line, HTML for labels, tooltip and 48px tap targets. */
export function LineChart({ values, format, ariaLabel }: { values: number[]; format: (v: number) => string; ariaLabel: string }) {
  const [picked, setPicked] = useState(-1);
  if (values.length === 0) return null;
  const sel = picked >= 0 && picked < values.length ? picked : values.length - 1;
  const g = chartGeometry(values, sel);

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        {g.grid.map((l, i) => (
          <line key={i} className="ch-grid" x1={CHART_X.x0} x2={CHART_X.x1} y1={l.y} y2={l.y} />
        ))}
        {values.length > 1 && <path className="ch-line" d={g.path} />}
        {g.dots.map((d) => (
          <circle key={d.i} className={d.i === sel ? "ch-dot-hi" : "ch-dot"} cx={d.x} cy={d.y} r={5} />
        ))}
      </svg>
      {g.grid.map((l, i) => (
        <span key={i} className="ch-lbl ch-lbl-y" style={{ left: l.left, top: l.top }}>{l.label}</span>
      ))}
      {g.dots.map((d) => (
        <span key={d.i} className="ch-lbl" style={{ left: d.left, top: "95%" }}>{d.i + 1}</span>
      ))}
      <span className="ch-tipbox" style={{ left: g.tip.left, top: g.tip.top }}>{format(values[sel])}</span>
      {g.dots.map((d) => (
        <button key={d.i} type="button" className="ch-pt" style={{ left: d.left }} onClick={() => setPicked(d.i)} aria-label={`Session ${d.i + 1}: ${format(values[d.i])}`} />
      ))}
    </div>
  );
}
