import { describe, expect, it } from "vitest";
import { intensity, muscleLoad, recovery } from "./bodymap";

const today = "2026-10-22";

describe("body map", () => {
  it("counts the main muscle fully and the others by half, over the last 7 days", () => {
    const l = muscleLoad(
      [
        { date: "2026-10-22", muscles: ["Chest", "Triceps"] },
        { date: "2026-10-22", muscles: ["Chest", "Triceps"] },
        { date: "2026-10-18", muscles: ["Shoulders", "Triceps"] },
        { date: "2026-10-05", muscles: ["Chest"] }, // too old for the week
      ],
      today,
    );
    expect(l.chest.sets).toBe(2);
    expect(l.triceps.sets).toBe(1.5);
    expect(l.frontdelt.sets).toBe(1);
    expect(l.sidedelt.sets).toBe(1);
  });
  it("says how recently each muscle was trained", () => {
    const l = muscleLoad([{ date: "2026-10-21", muscles: ["Quads"] }, { date: "2026-10-20", muscles: ["Lats"] }, { date: "2026-10-15", muscles: ["Biceps"] }], today);
    expect(recovery(l.quads)).toBe("just");
    expect(recovery(l.lats)).toBe("recovering");
    expect(recovery(l.biceps)).toBe("fresh");
    expect(recovery(l.calves)).toBe("untrained");
    expect(l.biceps.sets).toBe(0); // 7 days ago is outside the week
  });
  it("lights a muscle fully at 6 weighted sets and ignores unknown names", () => {
    expect(intensity({ sets: 3, daysAgo: 0 })).toBe(0.5);
    expect(intensity({ sets: 9, daysAgo: 0 })).toBe(1);
    expect(muscleLoad([{ date: today, muscles: ["Inner thighs"] }], today).quads.sets).toBe(0);
  });
});
