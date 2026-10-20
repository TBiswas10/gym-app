import { describe, expect, it } from "vitest";
import { buildStrip, freeDays, missedCard, remainingSessions, type Override } from "./schedule";

// The design's week 3 example: Thursday 8 October 2026. Mon done, Tue missed, Wed done, Thu today.
const FIVE_DAY = [1, 2, 3, 4, 6];
const MON = "2026-10-05", TUE = "2026-10-06", WED = "2026-10-07", THU = "2026-10-08";
const FRI = "2026-10-09", SUN = "2026-10-11";
const base = { today: THU, startDate: "2026-09-21", liftWeekdays: FIVE_DAY, completed: new Set([MON, WED]), overrides: [] as Override[] };
const statuses = (s: ReturnType<typeof buildStrip>) => s.map((d) => d.status);

describe("week strip", () => {
  it("matches the design's week 3 example", () => {
    const strip = buildStrip(base);
    expect(strip.map((d) => d.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(statuses(strip)).toEqual(["done", "missed", "done", "today", "rest", "next", "rest"]);
  });

  it("shows days before the start date as 'pre' (first run, week 1)", () => {
    const strip = buildStrip({ ...base, startDate: THU, completed: new Set() });
    expect(statuses(strip)).toEqual(["pre", "pre", "pre", "today", "rest", "next", "rest"]);
  });

  it("shows Friday and Sunday as rest days on the 5-day plan", () => {
    const strip = buildStrip(base);
    expect(strip[4].sessionOrigin).toBeNull();
    expect(strip[6].sessionOrigin).toBeNull();
  });

  it("uses Mon / Wed / Sat for the 3-day plan", () => {
    const strip = buildStrip({ ...base, liftWeekdays: [1, 3, 6], completed: new Set([MON, WED]) });
    expect(statuses(strip)).toEqual(["done", "rest", "done", "rest", "rest", "next", "rest"]);
  });

  it("marks today done once its workout is complete", () => {
    const strip = buildStrip({ ...base, completed: new Set([MON, WED, THU]) });
    expect(strip[3].status).toBe("done");
  });

  it("never marks a future day missed", () => {
    const strip = buildStrip({ ...base, today: MON, completed: new Set() });
    expect(statuses(strip)).toEqual(["today", "next", "next", "next", "rest", "next", "rest"]);
  });
});

describe("skipping, moving and going light", () => {
  const ovr = (o: Partial<Override>): Override => ({ plannedDate: TUE, action: "skipped", movedToDate: null, createdOn: THU, ...o });

  it("shows a skipped session as a skipped day", () => {
    const strip = buildStrip({ ...base, overrides: [ovr({ action: "skipped" })] });
    expect(strip[1].status).toBe("skipped");
  });

  it("a skipped day that is done later shows a tick, not a skip", () => {
    const strip = buildStrip({ ...base, completed: new Set([MON, TUE]), overrides: [ovr({ action: "skipped" })] });
    expect(strip[1]).toMatchObject({ status: "done", sessionOrigin: TUE });
  });

  it("a skipped day that is still not done can be started from its own date", () => {
    const strip = buildStrip({ ...base, overrides: [ovr({ action: "skipped" })] });
    expect(strip[1]).toMatchObject({ status: "skipped", skippedOrigin: TUE });
  });

  it("moves a session to a free day and keeps its content", () => {
    const strip = buildStrip({ ...base, overrides: [ovr({ action: "moved", movedToDate: FRI })] });
    expect(strip[1].status).toBe("skipped"); // Tuesday is empty now
    expect(strip[4]).toMatchObject({ status: "next", sessionOrigin: TUE, movedIn: true });
  });

  it("marks the moved session done when its origin date is done", () => {
    const strip = buildStrip({ ...base, completed: new Set([MON, WED, TUE]), overrides: [ovr({ action: "moved", movedToDate: FRI })] });
    expect(strip[4].status).toBe("done");
  });

  it("keeps a light session available after the day has passed", () => {
    const strip = buildStrip({ ...base, overrides: [ovr({ action: "light" })] });
    expect(strip[1]).toMatchObject({ status: "light", light: true, sessionOrigin: TUE });
  });

  it("flags a light day today without changing it to missed", () => {
    const strip = buildStrip({ ...base, overrides: [ovr({ plannedDate: THU, action: "light" })] });
    expect(strip[3]).toMatchObject({ status: "today", light: true });
  });

  it("ignores a move to a date outside the week", () => {
    const strip = buildStrip({ ...base, overrides: [ovr({ action: "moved", movedToDate: "2026-10-14" })] });
    expect(strip[1].status).toBe("missed");
  });
});

describe("free days", () => {
  it("offers Friday and Sunday after a Thursday", () => {
    const strip = buildStrip(base);
    expect(freeDays(strip, THU).map((d) => d.date)).toEqual([FRI, SUN]);
  });
  it("drops a day that already hosts a moved session", () => {
    const strip = buildStrip({ ...base, overrides: [{ plannedDate: TUE, action: "moved", movedToDate: FRI, createdOn: THU }] });
    expect(freeDays(strip, THU).map((d) => d.date)).toEqual([SUN]);
  });
  it("includes today when today is a rest day", () => {
    const strip = buildStrip({ ...base, today: FRI, completed: new Set([MON, WED, THU]) });
    expect(freeDays(strip, FRI).map((d) => d.date)).toEqual([FRI, SUN]);
  });
  it("is empty late on Sunday", () => {
    const strip = buildStrip({ ...base, today: SUN });
    expect(freeDays(strip, SUN).map((d) => d.date)).toEqual([SUN]);
  });
});

describe("missed-day card", () => {
  const completed = base.completed;
  it("asks what to do about an unhandled missed day", () => {
    const strip = buildStrip(base);
    expect(missedCard(strip, [], completed, THU)).toEqual({ state: "ask", origin: TUE });
  });

  it("is hidden when nothing was missed", () => {
    const strip = buildStrip({ ...base, completed: new Set([MON, TUE, WED]) });
    expect(missedCard(strip, [], new Set([MON, TUE, WED]), THU)).toBeNull();
  });

  it("confirms a choice on the day it was made", () => {
    const o: Override[] = [{ plannedDate: TUE, action: "skipped", movedToDate: null, createdOn: THU }];
    const strip = buildStrip({ ...base, overrides: o });
    expect(missedCard(strip, o, completed, THU)).toMatchObject({ state: "skipped", origin: TUE });
  });

  it("stops confirming a skip on later days", () => {
    const o: Override[] = [{ plannedDate: TUE, action: "skipped", movedToDate: null, createdOn: WED }];
    const strip = buildStrip({ ...base, overrides: o });
    expect(missedCard(strip, o, completed, THU)).toBeNull();
  });

  it("keeps showing a light session until it is done", () => {
    const o: Override[] = [{ plannedDate: TUE, action: "light", movedToDate: null, createdOn: WED }];
    const strip = buildStrip({ ...base, overrides: o });
    expect(missedCard(strip, o, completed, THU)).toMatchObject({ state: "light", origin: TUE });
    const done = new Set([MON, WED, TUE]);
    expect(missedCard(buildStrip({ ...base, completed: done, overrides: o }), o, done, THU)).toBeNull();
  });

  it("handles the most recent missed day first", () => {
    const none = new Set([WED]);
    const strip = buildStrip({ ...base, completed: none });
    expect(missedCard(strip, [], none, THU)).toEqual({ state: "ask", origin: TUE });
  });
});

describe("remaining sessions", () => {
  it("lists today and later sessions that are not done", () => {
    const strip = buildStrip(base);
    expect(remainingSessions(strip, THU).map((d) => d.label)).toEqual(["Thu", "Sat"]);
  });
});
