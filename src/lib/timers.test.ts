import { describe, expect, it } from "vitest";
import { cardioGuard, elapsedSeconds, mmss, restPercent, restRemaining, restSecondsAfter, sessionClock, timerLevel } from "./timers";

const T0 = Date.UTC(2026, 9, 8, 9, 0, 0); // a session start (stored timestamp)
const sec = (n: number) => T0 + n * 1000;

describe("session timer (start timestamp)", () => {
  it("works out elapsed time from the clock, not a counter", () => {
    expect(elapsedSeconds(T0, sec(0))).toBe(0);
    expect(elapsedSeconds(T0, sec(754))).toBe(754);
  });
  it("is right after the phone was locked for ten minutes", () => {
    // no ticks between 5:00 and 15:00, then the app comes back
    expect(elapsedSeconds(T0, sec(900))).toBe(900);
  });
  it("floors partial seconds and never goes negative", () => {
    expect(elapsedSeconds(T0, T0 + 1999)).toBe(1);
    expect(elapsedSeconds(T0, T0 - 5000)).toBe(0);
  });
  it("turns amber at 40:00 and red at 50:00", () => {
    expect(timerLevel(39 * 60 + 59)).toBe("normal");
    expect(timerLevel(40 * 60)).toBe("warn");
    expect(timerLevel(49 * 60 + 59)).toBe("warn");
    expect(timerLevel(50 * 60)).toBe("over");
  });
  it("bundles the clock for the header", () => {
    expect(sessionClock(T0, sec(45 * 60 + 5))).toEqual({ elapsed: 2705, label: "45:05", level: "warn" });
  });
});

describe("mmss", () => {
  it("formats clocks", () => {
    expect(mmss(0)).toBe("0:00");
    expect(mmss(9)).toBe("0:09");
    expect(mmss(90)).toBe("1:30");
    expect(mmss(3600)).toBe("60:00");
    expect(mmss(-4)).toBe("0:00");
  });
});

describe("rest timer (end timestamp)", () => {
  const end = sec(100);
  it("counts down to the stored end time", () => {
    expect(restRemaining(end, sec(10))).toBe(90);
    expect(restRemaining(end, sec(99.2))).toBe(1);
  });
  it("is finished after a lock or background, never negative", () => {
    expect(restRemaining(end, sec(100))).toBe(0);
    expect(restRemaining(end, sec(500))).toBe(0);
  });
  it("gives 90 s after the first set and 60 s after the second", () => {
    expect(restSecondsAfter(1)).toBe(90);
    expect(restSecondsAfter(2)).toBe(60);
  });
  it("reports progress as a percentage", () => {
    expect(restPercent(45, 90)).toBe(50);
    expect(restPercent(0, 90)).toBe(0);
    expect(restPercent(5, 0)).toBe(0);
  });
});

describe("shorten-cardio guard", () => {
  const base = { todoLifts: 0, cardioMinutes: 15, cardioDone: false, dismissed: false };
  it("stays quiet before 45:00", () => {
    expect(cardioGuard({ ...base, elapsedS: 44 * 60 }).show).toBe(false);
  });
  it("offers a shorter cardio block between 45:00 and 50:00", () => {
    const g = cardioGuard({ ...base, elapsedS: 45 * 60 });
    expect(g).toMatchObject({ show: true, fitMinutes: 5, guardMinutes: 5, roomLeft: true });
  });
  it("leaves room for lifts that are still to do", () => {
    const g = cardioGuard({ ...base, elapsedS: 45 * 60, todoLifts: 1 });
    expect(g.fitMinutes).toBe(2);
    expect(g).toMatchObject({ show: true, guardMinutes: 3, roomLeft: false });
  });
  it("hands over to the red banner at 50:00", () => {
    expect(cardioGuard({ ...base, elapsedS: 50 * 60 }).show).toBe(false);
  });
  it("hides once cardio is done, dismissed, or already short enough", () => {
    expect(cardioGuard({ ...base, elapsedS: 46 * 60, cardioDone: true }).show).toBe(false);
    expect(cardioGuard({ ...base, elapsedS: 46 * 60, dismissed: true }).show).toBe(false);
    expect(cardioGuard({ ...base, elapsedS: 46 * 60, cardioMinutes: 3 }).show).toBe(false);
  });
});
