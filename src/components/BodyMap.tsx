"use client";

import { useState } from "react";
import { BACK, FRONT, intensity, LABEL, recovery, RECOVERY_WORD, type MapMuscle, type MuscleState } from "@/lib/bodymap";

/** Front and back figure; each muscle is lit by how much it worked this week. Pick a muscle from the list for its numbers. */
export function BodyMap({ load }: { load: Record<MapMuscle, MuscleState> }) {
  const [view, setView] = useState<"front" | "back">("front");
  const [sel, setSel] = useState<MapMuscle | null>(null);
  const muscles = view === "front" ? FRONT : BACK;
  const ordered = [...muscles].sort((a, b) => load[b].sets - load[a].sets);
  const cur = sel && muscles.includes(sel) ? sel : null;
  const lit = (m: MapMuscle): { color: string; opacity: number } | null => {
    const s = load[m];
    if (s.sets > 0) return { color: "var(--accent)", opacity: cur && cur !== m ? 0.18 : 0.3 + 0.7 * intensity(s) };
    if (s.daysAgo !== null) return { color: "var(--info)", opacity: cur && cur !== m ? 0.1 : 0.28 };
    return null;
  };
  return (
    <section className="card" aria-label="Body map">
      <div className="row between baseline">
        <h2 className="t-heading">Body map</h2>
        <span className="t-small c-2">this week</span>
      </div>
      <div className="chip-row-tight" role="tablist" aria-label="Side">
        {(["front", "back"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className="chip" onClick={() => setView(v)}>
            {v === "front" ? "Front" : "Back"}
          </button>
        ))}
      </div>
      <div className="bodymap" role="img" aria-label={`Body map, ${view}: ${muscles.map((m) => `${LABEL[m]} ${load[m].sets} sets`).join(", ")}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/bodymap/${view}.webp`} width={420} height={780} alt="" decoding="async" draggable={false} />
        {muscles.map((m) => {
          const l = lit(m);
          if (!l) return null;
          const url = `url(/bodymap/${m}.webp)`;
          return <span key={m} className="bm-mask" style={{ background: l.color, opacity: l.opacity, maskImage: url, WebkitMaskImage: url }} />;
        })}
      </div>
      <div className="chip-row-tight" role="listbox" aria-label="Muscles">
        {ordered.map((m) => (
          <button key={m} type="button" className="chip" role="option" aria-selected={cur === m} onClick={() => setSel(cur === m ? null : m)}>
            {LABEL[m]} · {load[m].sets}
          </button>
        ))}
      </div>
      <p className="t-small c-2" role="status">
        {cur
          ? `${LABEL[cur]}: ${load[cur].sets} ${load[cur].sets === 1 ? "set" : "sets"} this week. ${RECOVERY_WORD[recovery(load[cur])]}${load[cur].daysAgo !== null ? ` (${load[cur].daysAgo === 0 ? "today" : load[cur].daysAgo === 1 ? "yesterday" : `${load[cur].daysAgo} days ago`})` : ""}.`
          : "Brighter means more sets. Blue is trained in the last 2 weeks but not this week. Unlit means not trained in 2 weeks."}
      </p>
    </section>
  );
}
