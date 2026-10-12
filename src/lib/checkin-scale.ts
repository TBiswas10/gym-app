// The two 1-5 scales of the check-in, in plain words. One place, so the check-in screen and Progress say the same thing.

export const SORENESS_WORDS = ["None", "A little", "Moderate", "Quite sore", "Very sore"] as const;
export const ENERGY_WORDS = ["Drained", "Low", "Okay", "Good", "Buzzing"] as const;

export const wordFor = (kind: "soreness" | "energy", v: number): string => {
  const list = kind === "soreness" ? SORENESS_WORDS : ENERGY_WORDS;
  return list[Math.min(5, Math.max(1, Math.round(v))) - 1];
};

/** "Easing", "Steady" or "Rising" for a series, oldest first (compares the older half with the newer half). */
export function direction(values: number[]): "down" | "flat" | "up" {
  if (values.length < 2) return "flat";
  const half = Math.max(1, Math.floor(values.length / 2));
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const d = avg(values.slice(-half)) - avg(values.slice(0, half));
  return d <= -0.5 ? "down" : d >= 0.5 ? "up" : "flat";
}
