import { describe, expect, it } from "vitest";
import { scrubSteps } from "./scrub";

describe("scrubSteps", () => {
  it("up is more, down is less, one step per 18 px", () => {
    expect(scrubSteps(-18)).toBe(1);
    expect(scrubSteps(-40)).toBe(2);
    expect(scrubSteps(36)).toBe(-2);
  });
  it("needs a full step before it counts", () => {
    expect(scrubSteps(-17)).toBe(0);
    expect(scrubSteps(0)).toBe(0);
  });
});
