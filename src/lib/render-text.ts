// Words for the exercise viewer: which muscles are lit and the rep tempo, from the render metadata.
const NAMES: Record<string, string> = {
  chest: "Chest", lats: "Lats", midback: "Mid back", traps: "Traps", abs: "Abs", obliques: "Obliques", glutes: "Glutes",
  frontdelt: "Front shoulders", sidedelt: "Side shoulders", reardelt: "Rear shoulders", biceps: "Biceps", triceps: "Triceps",
  forearms: "Forearms", quads: "Quads", hamstrings: "Hamstrings", calves: "Calves",
};

export const muscleLabel = (list: string[]): string => list.map((m) => NAMES[m] ?? m).join(", ") || "Whole body";

const secs = (n: number): string => `${Math.round(n * 10) / 10}`;

/** "Tempo: lift in 1 s, squeeze 0.5 s, lower over 2.2 s" from [lift, hold, lower, rest]. */
export function tempoHint(t: [number, number, number, number]): string {
  return `Tempo: lift in ${secs(t[0])} s, squeeze ${secs(t[1])} s, lower over ${secs(t[2])} s.`;
}
