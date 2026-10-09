// Date logic. All app dates are Australia/Sydney calendar dates as "YYYY-MM-DD" strings.
// Timestamps are stored in UTC; only these helpers turn them into Sydney dates.

export const TZ = "Australia/Sydney";
const DAY_MS = 86_400_000;

const sydneyParts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const longDate = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const sydneyClock = new Intl.DateTimeFormat("en-AU", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });

/** The Sydney calendar date for an instant (a Date or an ISO timestamp). */
export function sydneyDate(at: Date | string = new Date()): string {
  return sydneyParts.format(typeof at === "string" ? new Date(at) : at);
}

/** Today in Sydney. "Today's workout" is always based on this. */
export const sydneyToday = (now: Date = new Date()): string => sydneyDate(now);

const toUtc = (d: string): number => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};
const fromUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const addDays = (d: string, n: number): string => fromUtc(toUtc(d) + n * DAY_MS);

/** Whole days from a to b (b - a). */
export const diffDays = (a: string, b: string): number => Math.round((toUtc(b) - toUtc(a)) / DAY_MS);

/** 1 = Monday ... 7 = Sunday. */
export function weekdayOf(d: string): number {
  const js = new Date(toUtc(d)).getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const shortDay = (weekday: number): string => WEEKDAY_SHORT[weekday - 1];
export const longDay = (weekday: number): string => WEEKDAY_LONG[weekday - 1];

/** The Monday of the week containing d. */
export const startOfWeek = (d: string): string => addDays(d, 1 - weekdayOf(d));

/** Monday to Sunday of the week containing d. */
export function weekDates(d: string): string[] {
  const mon = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

/** Programme week 1-12 (7-day blocks counted from start_date). Mirrors program_state_view.current_week. */
export function programmeWeek(startDate: string, today: string): number {
  const week = Math.floor(diffDays(startDate, today) / 7) + 1;
  return Math.min(12, Math.max(1, week));
}

/** True once 12 full weeks have passed. Mirrors program_state_view.programme_complete. */
export const programmeComplete = (startDate: string, today: string): boolean => diffDays(startDate, today) >= 84;

/** Weeks 1 and 2 are for finding your weights. */
export const isSetupWeek = (week: number): boolean => week <= 2;

/** "Thursday 8 October" */
export const formatLongDate = (d: string): string => longDate.format(new Date(toUtc(d))).replace(",", "");

/** "7:05 pm" in Sydney time, from a stored UTC timestamp. */
export const formatSydneyTime = (iso: string): string => sydneyClock.format(new Date(iso));
