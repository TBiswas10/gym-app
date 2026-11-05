// The body map: how much each muscle has worked this week and how recently, from your logged sets.

export type MapMuscle = "chest" | "abs" | "obliques" | "frontdelt" | "sidedelt" | "biceps" | "forearms" | "quads" | "traps" | "lats" | "midback" | "reardelt" | "triceps" | "glutes" | "hamstrings" | "calves";

export const FRONT: MapMuscle[] = ["chest", "abs", "obliques", "frontdelt", "sidedelt", "biceps", "forearms", "quads"];
export const BACK: MapMuscle[] = ["traps", "lats", "midback", "reardelt", "triceps", "glutes", "hamstrings", "calves"];

export const LABEL: Record<MapMuscle, string> = {
  chest: "Chest", abs: "Abs", obliques: "Obliques", frontdelt: "Front shoulders", sidedelt: "Side shoulders", biceps: "Biceps", forearms: "Forearms", quads: "Quads",
  traps: "Traps", lats: "Lats", midback: "Mid back", reardelt: "Rear shoulders", triceps: "Triceps", glutes: "Glutes", hamstrings: "Hamstrings", calves: "Calves",
};

/** The library's muscle names (exercises.muscles) mapped onto the parts of the map they train. */
const OF: Record<string, MapMuscle[]> = {
  Chest: ["chest"], "Upper chest": ["chest"], "Front shoulders": ["frontdelt"], "Side shoulders": ["sidedelt"], "Rear shoulders": ["reardelt"], Shoulders: ["frontdelt", "sidedelt"],
  Triceps: ["triceps"], Biceps: ["biceps"], Forearms: ["forearms"], Lats: ["lats"], "Mid back": ["midback"], "Upper back": ["midback", "traps"], Traps: ["traps"],
  Quads: ["quads"], Hamstrings: ["hamstrings"], Glutes: ["glutes"], Calves: ["calves"], Abs: ["abs"], Core: ["abs"], Obliques: ["obliques"],
};

export interface LoggedSet {
  date: string; // the session's date, YYYY-MM-DD
  muscles: string[]; // the exercise's muscles, main one first
}

export interface MuscleState {
  sets: number; // weighted sets in the last 7 days (main muscle 1, others half)
  daysAgo: number | null; // days since it was last trained, within the window; null if not
}

export type Recovery = "just" | "recovering" | "fresh" | "untrained";

const DAY = 86_400_000;
const days = (a: string, b: string): number => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY);

/** Per muscle: weighted sets in the last 7 days and days since last trained (looking back 14 days). */
export function muscleLoad(sets: LoggedSet[], today: string): Record<MapMuscle, MuscleState> {
  const out = Object.fromEntries([...FRONT, ...BACK].map((m) => [m, { sets: 0, daysAgo: null as number | null }])) as Record<MapMuscle, MuscleState>;
  for (const s of sets) {
    const ago = days(s.date, today);
    if (ago < 0 || ago > 13) continue;
    s.muscles.forEach((name, i) => {
      for (const m of OF[name] ?? []) {
        if (ago <= 6) out[m].sets += i === 0 ? 1 : 0.5;
        out[m].daysAgo = out[m].daysAgo === null ? ago : Math.min(out[m].daysAgo, ago);
      }
    });
  }
  for (const m of Object.keys(out) as MapMuscle[]) out[m].sets = Math.round(out[m].sets * 10) / 10;
  return out;
}

export function recovery(s: MuscleState): Recovery {
  if (s.daysAgo === null) return "untrained";
  return s.daysAgo <= 1 ? "just" : s.daysAgo === 2 ? "recovering" : "fresh";
}

export const RECOVERY_WORD: Record<Recovery, string> = { just: "Just trained", recovering: "Recovering", fresh: "Fresh", untrained: "Not trained in 2 weeks" };

/** 0 to 1: how strongly to light a muscle (6 weighted sets in a week is full). */
export const intensity = (s: MuscleState): number => Math.min(1, s.sets / 6);
