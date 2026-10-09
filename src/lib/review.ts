// Week 4, 8 and 12 check-ins: a recommendation from how training has gone.
// Examples from the design: (soreness 2.6, energy 3.8) -> keep building; (3.4, 3.1) -> hold; (3.9, 2.6) -> deload.

export type Rec = "build" | "hold" | "deload";

export interface ReviewInput {
  sessionsDone: number;
  sessionsPlanned: number;
  avgSoreness: number | null;
  avgEnergy: number | null;
}

export const REC_LABEL: Record<Rec, string> = { build: "Keep building", hold: "Hold", deload: "Deload" };

export function recommend(i: ReviewInput): Rec {
  const sore = i.avgSoreness;
  const energy = i.avgEnergy;
  if ((sore !== null && sore >= 3.8) || (energy !== null && energy <= 2.7)) return "deload";
  const adherence = i.sessionsPlanned > 0 ? i.sessionsDone / i.sessionsPlanned : 1;
  if ((sore !== null && sore >= 3.2) || (energy !== null && energy <= 3.2) || adherence < 0.7) return "hold";
  return "build";
}

export function reasonFor(rec: Rec, i: ReviewInput): string {
  const n = `${i.sessionsDone} of ${i.sessionsPlanned} sessions`;
  if (rec === "deload") return "Soreness is high and energy is low. Take an easier week: same exercises and weights, half the sets (1 each). Then start your next block.";
  if (rec === "hold") {
    const adherence = i.sessionsPlanned > 0 ? i.sessionsDone / i.sessionsPlanned : 1;
    if (adherence < 0.7) return `You did ${n}. Keep weights where they are for two weeks and get the routine back first, then check again.`;
    return "Soreness is creeping up and energy is dipping. Keep sets and weights where they are for two weeks, then check again.";
  }
  return `You did ${n} and recovery looks good. Keep adding weight whenever you hit the top of the rep range on both sets.`;
}

/** What each choice means in plain words (shown when you pick a different one). */
export const CHOICE_WHY: Record<Rec, string> = {
  build: "Carry on as planned. Go up whenever you hit the top of the rep range on both sets.",
  hold: "Keep the same weights for two weeks, then check again.",
  deload: "One easier week: same weights, half the sets (1 each).",
};

export const average = (values: (number | null)[]): number | null => {
  const v = values.filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

/** The weeks a choice changes. Hold covers the next two weeks; deload makes the next week an easy one. */
export function effectOf(rec: Rec, week: number): { holdWeeks: number[]; deloadWeeks: number[] } {
  if (rec === "hold") return { holdWeeks: [week + 1, week + 2].filter((w) => w <= 12), deloadWeeks: [] };
  if (rec === "deload") return { holdWeeks: [], deloadWeeks: week < 12 ? [week + 1] : [] };
  return { holdWeeks: [], deloadWeeks: [] };
}

/** Deload suggestion every 6-8 weeks if none has been taken yet (half the sets). */
export const suggestDeload = (week: number, deloadWeeks: number[]): boolean => week >= 6 && week <= 8 && !deloadWeeks.some((d) => d <= week && d >= week - 7);
