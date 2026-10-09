import { describe, expect, it } from "vitest";
import { encouragement } from "./encourage";

const base = { totalSessions: 5, doneThisWeek: 2, plannedThisWeek: 5, streakWeeks: 0, pbs: 0 };
describe("encouragement", () => {
  it("celebrates the first session", () => {
    expect(encouragement({ ...base, totalSessions: 1 })).toContain("First session done");
  });
  it("celebrates a full week, with the run if there is one", () => {
    expect(encouragement({ ...base, doneThisWeek: 5 })).toBe("That’s every session this week. Well done.");
    expect(encouragement({ ...base, doneThisWeek: 5, streakWeeks: 3 })).toContain("3 full weeks in a row");
  });
  it("mentions new bests, singular and plural", () => {
    expect(encouragement({ ...base, pbs: 1 })).toContain("A new best");
    expect(encouragement({ ...base, pbs: 3 })).toContain("3 new bests");
  });
  it("otherwise says how many are left", () => {
    expect(encouragement(base)).toBe("2 of 5 sessions this week. 3 to go.");
  });
});
