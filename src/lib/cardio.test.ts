import { describe, expect, it } from "vitest";
import { adjustParam, cardioSuggestion, cleanParams, defaultMachine, initialParams, MACHINES, machineLabel } from "./cardio";

describe("cardio machines", () => {
  it("has the five machines from the design", () => {
    expect(MACHINES.map((m) => m.id)).toEqual(["bike", "treadmill", "stair", "rower", "xtrainer"]);
  });

  it("picks the starting machine from the plan's cardio line", () => {
    expect(defaultMachine("Bike or cross-trainer")).toBe("bike");
    expect(defaultMachine("Rower or bike")).toBe("rower");
    expect(defaultMachine("Easy treadmill walk")).toBe("treadmill");
    expect(defaultMachine("Bike or treadmill")).toBe("bike");
    expect(defaultMachine("Incline treadmill walk or stair machine")).toBe("treadmill");
  });

  it("starts on the design's defaults", () => {
    expect(initialParams("bike")).toEqual({ res: 5, rpm: 70, min: 10 });
    expect(initialParams("treadmill")).toEqual({ speed: 5.5, incline: 3, min: 10 });
    expect(initialParams("stair")).toEqual({ level: 4, min: 8 });
    expect(initialParams("rower")).toEqual({ damper: 4, spm: 22, min: 8 });
  });

  it("uses the planned minutes (Saturday treadmill is 15)", () => {
    expect(initialParams("treadmill", { plannedMinutes: 15 }).min).toBe(15);
  });

  it("prefers last time's numbers, but the plan sets the time", () => {
    expect(initialParams("treadmill", { last: { speed: 6, incline: 4, min: 12 }, plannedMinutes: 15 })).toEqual({ speed: 6, incline: 4, min: 15 });
  });

  it("'same as last time' brings back last time's minutes too", () => {
    expect(initialParams("treadmill", { last: { speed: 6, incline: 4, min: 12 } })).toEqual({ speed: 6, incline: 4, min: 12 });
  });

  it("keeps steppers inside the machine's range", () => {
    let p = initialParams("treadmill");
    p = adjustParam("treadmill", p, "speed", 1);
    expect(p.speed).toBe(6);
    expect(adjustParam("treadmill", { speed: 12, incline: 3, min: 10 }, "speed", 1).speed).toBe(12);
    expect(adjustParam("bike", { res: 1, rpm: 70, min: 10 }, "res", -1).res).toBe(1);
    expect(adjustParam("bike", { res: 5, rpm: 70, min: 10 }, "rpm", 1).rpm).toBe(75);
  });

  it("stores only the fields a machine has", () => {
    expect(cleanParams("bike", { res: 5, rpm: 70, min: 10, speed: 9 })).toEqual({ res: 5, rpm: 70, min: 10 });
  });

  it("suggests the next step from how it felt", () => {
    expect(cardioSuggestion(null, null)).toContain("First time");
    expect(cardioSuggestion(9, "easy")).toBe("Try 1 more minute next time. Last time: 9 min.");
    expect(cardioSuggestion(9, "hard")).toBe("That was tough. Keep it at 9 min next time.");
    expect(cardioSuggestion(9, null)).toBe("Try 1 more minute this week. Last time: 9 min.");
  });

  it("labels the stair machine like the design", () => {
    expect(machineLabel("stair")).toBe("Stair machine");
    expect(machineLabel("xtrainer")).toBe("Cross-trainer");
  });
});
