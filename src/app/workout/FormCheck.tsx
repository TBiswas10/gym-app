import { ExerciseMedia } from "@/components/ExerciseMedia";
import { Icon } from "@/components/Icon";
import type { Guide } from "@/lib/server/workout-data";

/**
 * Form help where you are looking: the two photos of the movement swapping back and forth (start and finish), the
 * three cues that matter most, and the mistakes to avoid. Collapsed until you tap it; the single most important cue
 * is always visible under the exercise name (see `KeyCue`).
 */
export function FormCheck({ guide, slug, showPhotos = true, onFullGuide }: { guide: Guide; slug: string; showPhotos?: boolean; onFullGuide: () => void }) {
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
        <button type="button" className="btn btn-secondary btn-block" onClick={onFullGuide}>Full guide, setup and all cues</button>
      </div>
    </details>
  );
}

/** The one cue to hold in your head for this set, always visible. */
export function KeyCue({ guide }: { guide: Guide }) {
  const cue = guide.cues[0];
  if (!cue) return null;
  return (
    <p className="t-small key-cue">
      <strong>Cue:</strong> {cue}
    </p>
  );
}
