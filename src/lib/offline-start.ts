// Starting a workout with no signal. While you are online the Today screen keeps the workout screen's data for the session you could start
// (`savePreview`). With no signal, "Start" opens that saved copy under a fresh session id and queues a "start" operation, which the
// phone sends first when it is back online. A cookie tells the server a start is still waiting, so it never creates a second session.

import type { Op } from "./ops";
import type { WorkoutPage } from "./server/workout-data";

export const PREVIEW_KEY = "wt.preview";
const STARTED_KEY = "wt.started";
const COOKIE = "wt_pending_start";
const MAX_AGE_MS = 36 * 3600_000;

interface Saved {
  date: string;
  savedAt: number;
  page: WorkoutPage;
}

export function savePreview(date: string, page: WorkoutPage, now = Date.now()): void {
  try {
    window.localStorage.setItem(PREVIEW_KEY, JSON.stringify({ date, savedAt: now, page } satisfies Saved));
  } catch {
    /* storage full or blocked: starting offline just won't be offered */
  }
}

export function loadPreview(date: string, now = Date.now()): WorkoutPage | null {
  try {
    const s = JSON.parse(window.localStorage.getItem(PREVIEW_KEY) ?? "null") as Saved | null;
    if (!s || s.date !== date || now - s.savedAt > MAX_AGE_MS || !s.page?.meta?.start) return null;
    return s.page;
  } catch {
    return null;
  }
}

/** The page for a session started now: the saved copy with its start time set to this moment. */
export function startedNow(page: WorkoutPage, now: Date): WorkoutPage {
  return { ...page, meta: { ...page.meta, startedAt: now.toISOString() } };
}

/** The operation that creates the session on the server. */
export function startOp(page: WorkoutPage): Op | null {
  const s = page.meta.start;
  if (!s) return null;
  return { t: "start", workoutId: page.meta.workoutId, plannedDate: s.plannedDate, weekday: s.weekday, week: s.week, planType: s.planType, dayName: page.meta.sessionName, light: s.light, startedAt: page.meta.startedAt };
}

/** True when the queue holds a start that has not reached the server yet. */
export const hasPendingStart = (queue: Op[]): boolean => queue.some((o) => o.t === "start");

export function setPendingCookie(on: boolean): void {
  document.cookie = `${COOKIE}=${on ? "1" : ""}; path=/; max-age=${on ? 2 * 86400 : 0}; samesite=lax`;
}

/** The session started with no signal, kept so the screen can be reopened until the server has it. */
export function saveStarted(page: WorkoutPage): void {
  try {
    window.localStorage.setItem(STARTED_KEY, JSON.stringify(page));
  } catch {
    /* ignore */
  }
}

export function loadStarted(): WorkoutPage | null {
  try {
    const p = JSON.parse(window.localStorage.getItem(STARTED_KEY) ?? "null") as WorkoutPage | null;
    return p?.meta?.workoutId ? p : null;
  } catch {
    return null;
  }
}

export function clearStarted(): void {
  try {
    window.localStorage.removeItem(STARTED_KEY);
  } catch {
    /* ignore */
  }
}
