// Small checks on a set against what you did before. Pure.

export interface LastSets {
  kg: number | null;
  reps: number[];
  secs: number[];
}

/** A weight far above last time (more than double and at least 10 kg more) is almost always a slipped digit. */
export function looksLikeTypo(kg: number | null, lastKg: number | null | undefined): boolean {
  if (!kg || !lastKg) return false;
  return kg > lastKg * 2 && kg - lastKg >= 10;
}

/** Set `i` against the same set last time: weight first, then reps (or seconds for a hold). null when there is nothing to compare with. */
export function againstLast(kind: "weight" | "bodyweight" | "timed", last: LastSets | null | undefined, i: number, v: { kg: number | null; reps: number | null; secs: number | null }): "up" | "same" | "down" | null {
  if (!last) return null;
  if (kind === "timed") {
    const l = last.secs[i];
    if (l == null || v.secs == null) return null;
    return v.secs > l ? "up" : v.secs < l ? "down" : "same";
  }
  const lr = last.reps[i];
  if (lr == null || v.reps == null) return null;
  const lk = last.kg ?? 0;
  const k = v.kg ?? 0;
  if (k !== lk) return k > lk ? "up" : "down";
  return v.reps > lr ? "up" : v.reps < lr ? "down" : "same";
}
