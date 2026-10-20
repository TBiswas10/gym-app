// Muscle balance: are you training as much behind you as in front of you? Counted in sets over a recent window,
// by the PRIMARY muscle of each exercise. Pure; the server feeds it.

export interface BalanceSet {
  /** the exercise's muscles, primary first ("Chest", "Upper back", ...) */
  muscles: string[];
}

export type Pattern = "push" | "pull" | "legs" | "core" | "arms";

const PUSH = ["chest", "upper chest", "shoulders", "side shoulders", "front shoulders", "triceps"];
const PULL = ["lats", "upper back", "mid back", "back", "rear shoulders", "rear delts", "biceps", "forearms", "traps"];
const FRONT = ["chest", "upper chest", "shoulders", "side shoulders", "front shoulders", "quads", "core", "obliques", "abs"];
const BACK = ["lats", "upper back", "mid back", "back", "rear shoulders", "rear delts", "glutes", "hamstrings", "lower back", "calves"];
const LOWER = ["quads", "hamstrings", "glutes", "calves", "ankles", "lower back"];
const UPPER = [...PUSH, ...PULL];

const norm = (m: string | undefined): string => (m ?? "").trim().toLowerCase();
const has = (list: string[], m: string): boolean => list.includes(m);

export interface Balance {
  /** total sets counted */
  total: number;
  push: number;
  pull: number;
  front: number;
  back: number;
  upper: number;
  lower: number;
  /** plain sentences about what is out of balance (empty when nothing is) */
  notes: string[];
  /** false when there are too few sets to say anything */
  enough: boolean;
}

export const MIN_SETS = 8;

export function balance(sets: BalanceSet[]): Balance {
  const b: Balance = { total: sets.length, push: 0, pull: 0, front: 0, back: 0, upper: 0, lower: 0, notes: [], enough: sets.length >= MIN_SETS };
  for (const s of sets) {
    const m = norm(s.muscles[0]);
    if (has(PUSH, m)) b.push++;
    if (has(PULL, m)) b.pull++;
    if (has(FRONT, m)) b.front++;
    if (has(BACK, m)) b.back++;
    if (has(UPPER, m)) b.upper++;
    if (has(LOWER, m)) b.lower++;
  }
  if (!b.enough) return b;

  const share = (a: number, c: number): number => (a + c === 0 ? 0.5 : a / (a + c));
  const pushShare = share(b.push, b.pull);
  if (b.push + b.pull >= MIN_SETS) {
    if (pushShare > 0.6) b.notes.push("You push more than you pull. Add a row or pulldown to keep your shoulders happy.");
    else if (pushShare < 0.4) b.notes.push("You pull more than you push. That is fine for posture; keep an eye on chest and shoulders.");
  }
  const frontShare = share(b.front, b.back);
  if (b.front + b.back >= MIN_SETS && frontShare > 0.6) b.notes.push("More front than back. Hamstrings, glutes and rows balance it.");
  const lowerShare = share(b.lower, b.upper);
  if (b.lower + b.upper >= MIN_SETS && lowerShare < 0.3) b.notes.push("Light on legs next to your upper body.");
  return b;
}

/** Share of the first side, 0 to 1 (0.5 when both are 0). */
export const shareOf = (a: number, b: number): number => (a + b === 0 ? 0.5 : a / (a + b));
