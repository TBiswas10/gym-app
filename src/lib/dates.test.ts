import { describe, expect, it } from "vitest";
import {
  addDays, diffDays, formatLongDate, formatSydneyTime, isSetupWeek, programmeComplete, programmeWeek,
  startOfWeek, sydneyDate, sydneyToday, weekDates, weekdayOf,
} from "./dates";

describe("sydneyDate", () => {
  it("uses the Sydney calendar date, not UTC (AEDT, UTC+11)", () => {
    // 14:30 UTC on 8 Oct is 01:30 on 9 Oct in Sydney
    expect(sydneyDate(new Date("2026-10-08T14:30:00Z"))).toBe("2026-10-09");
    expect(sydneyDate(new Date("2026-10-08T12:59:00Z"))).toBe("2026-10-08");
  });

  it("handles standard time (AEST, UTC+10) in winter", () => {
    expect(sydneyDate(new Date("2026-07-01T13:59:00Z"))).toBe("2026-07-01");
    expect(sydneyDate(new Date("2026-07-01T14:00:00Z"))).toBe("2026-07-02");
  });

  it("switches offset on the daylight saving change (first Sunday of October)", () => {
    // DST starts 2am Sun 4 Oct 2026: before it the offset is +10, after it +11
    expect(sydneyDate(new Date("2026-10-03T13:59:00Z"))).toBe("2026-10-03"); // 23:59 AEST
    expect(sydneyDate(new Date("2026-10-03T14:00:00Z"))).toBe("2026-10-04"); // 00:00 AEST
    expect(sydneyDate(new Date("2026-10-04T12:59:00Z"))).toBe("2026-10-04"); // 23:59 AEDT
    expect(sydneyDate(new Date("2026-10-04T13:00:00Z"))).toBe("2026-10-05"); // 00:00 AEDT
  });

  it("accepts stored ISO timestamps", () => {
    expect(sydneyDate("2026-10-08T14:30:00+00:00")).toBe("2026-10-09");
  });

  it("sydneyToday defaults to now and matches sydneyDate", () => {
    const now = new Date("2026-10-08T03:00:00Z");
    expect(sydneyToday(now)).toBe("2026-10-08");
  });
});

describe("day arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("is not thrown by daylight saving (calendar days, not 24h blocks)", () => {
    expect(addDays("2026-10-03", 1)).toBe("2026-10-04");
    expect(diffDays("2026-10-03", "2026-10-05")).toBe(2);
    expect(diffDays("2026-04-04", "2026-04-06")).toBe(2);
  });

  it("numbers weekdays Monday = 1 to Sunday = 7", () => {
    expect(weekdayOf("2026-10-05")).toBe(1); // Monday
    expect(weekdayOf("2026-10-08")).toBe(4); // Thursday
    expect(weekdayOf("2026-10-10")).toBe(6); // Saturday
    expect(weekdayOf("2026-10-11")).toBe(7); // Sunday
  });

  it("finds Monday-to-Sunday for any day of the week", () => {
    expect(startOfWeek("2026-10-08")).toBe("2026-10-05");
    expect(startOfWeek("2026-10-11")).toBe("2026-10-05"); // Sunday belongs to the week before Monday 12th
    expect(startOfWeek("2026-10-05")).toBe("2026-10-05");
    expect(weekDates("2026-10-08")).toEqual([
      "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
    ]);
  });
});

describe("programme week", () => {
  const start = "2026-10-08";
  it("starts at week 1 on the start date and rolls over every 7 days", () => {
    expect(programmeWeek(start, "2026-10-08")).toBe(1);
    expect(programmeWeek(start, "2026-10-14")).toBe(1);
    expect(programmeWeek(start, "2026-10-15")).toBe(2);
    expect(programmeWeek(start, "2026-10-22")).toBe(3);
  });
  it("stays at week 1 before the start date and caps at 12", () => {
    expect(programmeWeek(start, "2026-10-05")).toBe(1);
    expect(programmeWeek(start, "2027-06-01")).toBe(12);
  });
  it("hits week 4, 8 and 12 on the right days", () => {
    expect(programmeWeek(start, "2026-10-29")).toBe(4);
    expect(programmeWeek(start, "2026-11-26")).toBe(8);
    expect(programmeWeek(start, "2026-12-24")).toBe(12);
  });
  it("is complete after 84 days", () => {
    expect(programmeComplete(start, "2026-12-30")).toBe(false); // day 83
    expect(programmeComplete(start, "2026-12-31")).toBe(true); // day 84
  });
  it("treats weeks 1 and 2 as setup", () => {
    expect(isSetupWeek(1)).toBe(true);
    expect(isSetupWeek(2)).toBe(true);
    expect(isSetupWeek(3)).toBe(false);
  });
});

describe("formatting", () => {
  it("formats a long date like the design", () => {
    expect(formatLongDate("2026-10-08")).toBe("Thursday 8 October");
    expect(formatLongDate("2026-01-01")).toBe("Thursday 1 January");
  });
  it("shows stored UTC timestamps in Sydney time", () => {
    // 09:05 UTC is 8:05 pm AEDT
    expect(formatSydneyTime("2026-10-08T09:05:00Z").toLowerCase()).toBe("8:05 pm");
  });
});
