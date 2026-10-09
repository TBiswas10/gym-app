// "Find your weight" (weeks 1-2): try a weight for about 10 clean reps, say how it felt, adjust, repeat.

export type Try = "easy" | "right" | "hard";

/** A sensible first guess when there is nothing to go on. */
export const firstGuess = (category: "upper" | "lower" | "core"): number => (category === "lower" ? 40 : 20);

/** Easy: jump two steps up. Too hard: one step down. Never below one step. "Just right" stays put. */
export function nextAttempt(kg: number, how: Try, step: number): number {
  if (how === "right") return kg;
  const raw = how === "easy" ? kg + 2 * step : kg - step;
  return Math.max(step, Math.round(raw * 100) / 100);
}

/** The label on the Easy / Too hard buttons: "+5 kg" and "−2.5 kg". */
export const jumpLabel = (how: "easy" | "hard", step: number): string => (how === "easy" ? `+${2 * step} kg` : `−${step} kg`);
