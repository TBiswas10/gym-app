"use client";

import { useState } from "react";
import { ExerciseMedia } from "@/components/ExerciseMedia";
import { Icon } from "@/components/Icon";
import type { Guide } from "@/lib/server/workout-data";

/**
 * Form help where you are looking: the two photos of the movement swapping back and forth (start and finish), the
 * three cues that matter most, and the mistakes to avoid. Collapsed until you tap it; the single most important cue
 * is always visible under the exercise name (see `KeyCue`).
 */
export function FormCheck({ guide, slug, showPhotos = true, onFullGuide, note = "", onSaveNote }: { guide: Guide; slug: string; showPhotos?: boolean; onFullGuide: () => void; note?: string; onSaveNote?: (text: string) => void }) {
  const [text, setText] = useState(note);
  const cues = guide.cues.slice(0, 3);
  const mistakes = guide.mistakes.slice(0, 2);
  return (
    <details className="banner banner-info tip">
      <summary><Icon name="book" size={20} />Form check</summary>
      <div className="tip-body">
        {showPhotos && <ExerciseMedia slug={slug} name={guide.name} />}
        {cues.length > 0 && (
          <div className="col g1">
            <span className="t-caption c-2">DO THIS</span>
            <ol className="tip-list" style={{ listStyle: "decimal" }}>
              {cues.map((c) => (
                <li key={c} className="t-small">{c}</li>
              ))}
            </ol>
          </div>
        )}
        {mistakes.length > 0 && (
          <div className="col g1">
            <span className="t-caption c-2">AVOID</span>
            <ul className="tip-list">
              {mistakes.map((m) => (
                <li key={m} className="t-small">{m}</li>
              ))}
            </ul>
          </div>
        )}
        {onSaveNote && (
          <div className="col g1">
            <label className="t-caption c-2" htmlFor={`cue-${slug}`}>MY CUE FOR THIS LIFT</label>
            <input id={`cue-${slug}`} className="input" type="text" maxLength={140} value={text} placeholder="The one thing you keep getting wrong" onChange={(e) => setText(e.target.value)} onBlur={() => onSaveNote(text)} />
          </div>
        )}
        <button type="button" className="btn btn-secondary btn-block" onClick={onFullGuide}>Full guide, setup and all cues</button>
      </div>
    </details>
  );
}

/** The cues to hold in your head for this set, always visible: your own first (what you keep getting wrong), then the lift's main one. */
export function KeyCue({ guide, mine = "" }: { guide: Guide; mine?: string }) {
  const cue = guide.cues[0];
  if (!cue && !mine) return null;
  return (
    <>
      {mine && (
        <p className="t-small key-cue key-cue-mine">
          <strong>My cue:</strong> {mine}
        </p>
      )}
      {cue && (
        <p className="t-small key-cue">
          <strong>Cue:</strong> {cue}
        </p>
      )}
    </>
  );
}
