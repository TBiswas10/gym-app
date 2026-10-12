import { Icon } from "@/components/Icon";

/**
 * How to do the sets of an exercise. Open the first time you do a lift (or a swapped one) and tucked away after
 * that. The rep range is the exercise's own, so a plank reads in seconds and a calf raise in 12-15.
 */
export function SetTip({ range, kind, planned, swapped, first }: { range: [number, number]; kind: "weight" | "timed" | "bodyweight"; planned: number; swapped: boolean; first: boolean }) {
  const [lo, hi] = range;
  const timed = kind === "timed";
  const r = `${lo}-${hi} ${timed ? "seconds" : "reps"}`;
  return (
    <details className="banner banner-info tip" open={first || swapped}>
      <summary><Icon name="info" size={20} />How to do your sets</summary>
      <div className="tip-body">
        {swapped && <p className="t-small">No history for this one. Start light and use the steppers.</p>}
        <p className="t-small">
          {timed
            ? `For holds, the goal is the same for both sets: ${r}, stopping before your form goes.`
            : `For most exercises in your plan, the goal is the same for both sets: ${r}, stopping with about 2 reps left in the tank.`}
        </p>
        <ul className="tip-list">
          <li className="t-small"><strong>Set 1:</strong> aim for {r}. This sets the weight for the session.</li>
          {planned >= 2 && (
            <li className="t-small">
              <strong>Set 2:</strong> aim for {r} again{timed ? "" : ", using the same weight"}. Some drop-off is normal, so if you get {timed ? "a few seconds less" : "1-2 fewer reps"} than set 1, that’s fine.
            </li>
          )}
        </ul>
      </div>
    </details>
  );
}
