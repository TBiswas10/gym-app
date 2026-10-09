// Week strip and missed-day logic. Pure functions: no clock, no database.
//
// Model: each lifting weekday in the plan is a "session" identified by its ORIGIN date (the planned day).
// A session normally sits on its origin date. Moving it puts it on another date (the "slot") in the same week.
// Workouts are recorded against the origin date, so a moved session is done when its origin date is done.

import { shortDay, weekDates, weekdayOf } from "./dates";

export type DayStatus = "pre" | "done" | "today" | "missed" | "rest" | "skipped" | "light" | "next";
export type OverrideAction = "skipped" | "moved" | "light";

export interface Override {
  plannedDate: string; // origin date
  action: OverrideAction;
  movedToDate: string | null;
  createdOn: string; // Sydney date it was chosen
}

export interface StripDay {
  date: string;
  weekday: number;
  label: string; // Mon, Tue ...
  status: DayStatus;
  /** Origin date of the session shown on this day, or null on a rest day. */
  sessionOrigin: string | null;
  movedIn: boolean;
  light: boolean;
}

export interface StripInput {
  today: string;
  startDate: string;
  /** Weekdays (1-7) that have a lifting session in the plan. */
  liftWeekdays: number[];
  /** Origin dates of completed workouts. */
  completed: Set<string>;
  overrides: Override[];
}

export function buildStrip({ today, startDate, liftWeekdays, completed, overrides }: StripInput): StripDay[] {
  const dates = weekDates(today);
  const lifts = new Set(liftWeekdays);
  const byOrigin = new Map(overrides.map((o) => [o.plannedDate, o]));

  // Slot each session onto a date.
  const slotOf = new Map<string, string>(); // slot date -> origin date
  const awayOrigins = new Set<string>(); // origins that were moved off their own date or skipped
  for (const origin of dates) {
    if (!lifts.has(weekdayOf(origin)) || origin < startDate) continue;
    const o = byOrigin.get(origin);
    if (o?.action === "skipped") {
      awayOrigins.add(origin);
      continue;
    }
    if (o?.action === "moved" && o.movedToDate && dates.includes(o.movedToDate)) {
      awayOrigins.add(origin);
      slotOf.set(o.movedToDate, origin);
      continue;
    }
    slotOf.set(origin, origin);
  }

  return dates.map((date) => {
    const weekday = weekdayOf(date);
    const base = { date, weekday, label: shortDay(weekday), movedIn: false, light: false };
    if (date < startDate) return { ...base, status: "pre" as const, sessionOrigin: null };

    const origin = slotOf.get(date);
    if (!origin) {
      // Nothing sits here: a rest day, or the origin of a skipped / moved-away session.
      return { ...base, status: awayOrigins.has(date) ? ("skipped" as const) : ("rest" as const), sessionOrigin: null };
    }

    const o = byOrigin.get(origin);
    const light = o?.action === "light";
    const movedIn = origin !== date;
    let status: DayStatus;
    if (completed.has(origin)) status = "done";
    else if (date === today) status = "today";
    else if (date < today) status = light ? "light" : "missed";
    else status = "next";
    return { ...base, status, sessionOrigin: origin, movedIn, light };
  });
}

/** Rest days still ahead this week (including today) where a missed session could move to. */
export function freeDays(strip: StripDay[], today: string): StripDay[] {
  return strip.filter((d) => d.status === "rest" && d.date >= today);
}

export type MissedCard =
  | { state: "ask"; origin: string }
  | { state: "skipped" | "moved" | "light"; origin: string; movedTo: string | null };

/**
 * The card on Today for a session that did not happen.
 * - An unhandled missed day asks what to do (the most recent one first).
 * - After a choice, the confirmation (with Undo) shows on the day it was chosen;
 *   a light session keeps showing until it is done, because it carries the Start button.
 */
export function missedCard(strip: StripDay[], overrides: Override[], completed: Set<string>, today: string): MissedCard | null {
  const week = new Set(strip.map((d) => d.date));
  const candidates: { origin: string; card: MissedCard }[] = [];

  for (const d of strip) {
    if (d.status === "missed" && d.sessionOrigin) candidates.push({ origin: d.sessionOrigin, card: { state: "ask", origin: d.sessionOrigin } });
  }
  for (const o of overrides) {
    if (!week.has(o.plannedDate) || completed.has(o.plannedDate)) continue;
    const showsToday = o.createdOn === today || o.action === "light";
    if (!showsToday) continue;
    candidates.push({ origin: o.plannedDate, card: { state: o.action, origin: o.plannedDate, movedTo: o.movedToDate } });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (a.origin < b.origin ? 1 : -1));
  return candidates[0].card;
}

/** Remaining lifting days this week, for "Thursday and Saturday to go." */
export function remainingSessions(strip: StripDay[], today: string): StripDay[] {
  return strip.filter((d) => d.sessionOrigin && d.date >= today && d.status !== "done");
}
