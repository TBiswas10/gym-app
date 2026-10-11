import { describe, expect, it } from "vitest";
import { cardioLine, cardioSettings } from "./format";

describe("cardio formatting for the connector", () => {
  it("names the numbers you set on a machine, with units, and leaves time to `minutes`", () => {
    expect(cardioSettings("bike", { res: 6, rpm: 70, min: 10 })).toEqual({ Resistance: "6 level", Cadence: "70 rpm" });
    expect(cardioSettings("treadmill", { speed: 5.5, incline: 3, min: 12 })).toEqual({ Speed: "5.5 km/h", Incline: "3 %" });
  });
  it("gives one readable line, with feel", () => {
    expect(cardioLine({ kind: "bike", minutes: 10, feel: "moderate", params: { res: 5, rpm: 70, min: 10 } })).toBe("10 min bike · Resistance 5 level, Cadence 70 rpm (moderate)");
  });
  it("walks and stretches have no machine numbers", () => {
    expect(cardioLine({ kind: "walk", minutes: 20, params: {} })).toBe("20 min walk");
    expect(cardioSettings("walk", { speed: 5 })).toEqual({});
  });
});
