/** Limits match the checks on public.sets (weight_kg 0 to 400, reps 0 to 100, seconds 0 to 3600). */
export const MAX_KG = 400;
export const MAX_REPS = 100;
export const MAX_SECS = 3600;

export interface SetInput {
  kg: number | null;
  reps: number | null;
  secs: number | null;
}

export interface SetValues {
  weight_kg: number | null;
  reps: number | null;
  seconds: number | null;
}

export type SetCheck = { ok: true; values: SetValues } | { ok: false; error: string };

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);
const twoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

/**
 * Checks an edited set for its exercise kind and returns the values to store. A timed hold stores seconds only;
 * weight and bodyweight sets store kg (0 is bodyweight, as the workout screen logs it) and reps.
 */
export function checkSetInput(kind: string, input: SetInput): SetCheck {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Check the numbers and try again." };
  if (kind === "timed") {
    if (!isInt(input.secs) || input.secs < 0 || input.secs > MAX_SECS) return { ok: false, error: `Enter whole seconds from 0 to ${MAX_SECS}.` };
    return { ok: true, values: { weight_kg: null, reps: null, seconds: input.secs } };
  }
  if (typeof input.kg !== "number" || !Number.isFinite(input.kg) || input.kg < 0 || input.kg > MAX_KG || !twoDecimals(input.kg)) {
    return { ok: false, error: `Enter a weight from 0 to ${MAX_KG} kg, with up to 2 decimals.` };
  }
  if (!isInt(input.reps) || input.reps < 0 || input.reps > MAX_REPS) return { ok: false, error: `Enter whole reps from 0 to ${MAX_REPS}.` };
  return { ok: true, values: { weight_kg: Math.round(input.kg * 100) / 100, reps: input.reps, seconds: null } };
}
