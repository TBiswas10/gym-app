// Timer calculations. iOS freezes web apps in the background, so a running counter can't be trusted:
// the session stores its START time and the rest timer stores its END time, and both work out the
// time from the clock on every tick and when the app comes back (visibilitychange).

export const AMBER_AT = 40 * 60; // seconds: "40 min in. Aim to wrap up by 50:00."
export const RED_AT = 50 * 60; // seconds: "50 min. Time to wrap up."
export const FIRST_REST_S = 90;
export const SECOND_REST_S = 60;

/** Whole seconds since the session started. Never negative (clock skew). */
export const elapsedSeconds = (startMs: number, nowMs: number): number => Math.max(0, Math.floor((nowMs - startMs) / 1000));

export type TimerLevel = "normal" | "warn" | "over";
export const timerLevel = (elapsedS: number): TimerLevel => (elapsedS >= RED_AT ? "over" : elapsedS >= AMBER_AT ? "warn" : "normal");

/** "12:05" clock format (design: "0:45" on clocks, "45 min" in sentences). */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

/** Seconds of rest left. 0 once the end time has passed, including after a lock or background. */
export const restRemaining = (endMs: number, nowMs: number): number => Math.max(0, Math.ceil((endMs - nowMs) / 1000));

export const restPercent = (remaining: number, total: number): number => (total <= 0 ? 0 : Math.round((remaining / total) * 100));

/** Rest after the first set is 90 s; after the second (end of the exercise) it is 60 s. */
export const restSecondsAfter = (setsLogged: number): number => (setsLogged >= 2 ? SECOND_REST_S : FIRST_REST_S);

const SAT_GUARD_START = 45 * 60;
const LIFT_ESTIMATE_S = 3 * 60; // a remaining lift takes about 3 min once you are this late

export interface CardioGuard {
  show: boolean;
  fitMinutes: number;
  guardMinutes: number; // what cardio could be shortened to
  roomLeft: boolean; // false means "do 3 easy minutes and wrap up"
}

/**
 * If 45:00 passes before cardio is done, offer to shorten cardio to what still fits before 50:00.
 * Shown from 45:00 until 50:00 (the red banner takes over then).
 */
export function cardioGuard(input: { elapsedS: number; todoLifts: number; cardioMinutes: number; cardioDone: boolean; dismissed: boolean }): CardioGuard {
  const fit = Math.max(0, Math.floor((RED_AT - input.elapsedS - input.todoLifts * LIFT_ESTIMATE_S) / 60));
  const guardMinutes = Math.max(3, Math.min(fit, 15));
  const show = input.elapsedS >= SAT_GUARD_START && input.elapsedS < RED_AT && !input.cardioDone && !input.dismissed && input.cardioMinutes > guardMinutes;
  return { show, fitMinutes: fit, guardMinutes, roomLeft: fit >= 3 };
}

/** Everything the session header needs for one tick. */
export function sessionClock(startMs: number, nowMs: number) {
  const elapsed = elapsedSeconds(startMs, nowMs);
  return { elapsed, label: mmss(elapsed), level: timerLevel(elapsed) };
}

export interface Rest {
  end: number;
  total: number;
}

/** Add (or take off) seconds on a running rest. It never goes below 0 s left or beyond 5 minutes in total. */
export function extendRest(rest: Rest, seconds: number, nowMs: number): Rest {
  const left = Math.max(0, (rest.end - nowMs) / 1000);
  const next = Math.min(300, Math.max(0, left + seconds));
  return { end: nowMs + next * 1000, total: Math.max(rest.total, Math.min(300, rest.total + Math.max(0, seconds))) };
}
