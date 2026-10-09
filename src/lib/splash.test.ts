import { describe, expect, it } from "vitest";
import { parseSplash, SPLASH_SIZES, splashKey, splashMedia } from "./splash";

describe("launch screens", () => {
  it("names sizes in pixels and finds them again", () => {
    expect(splashKey({ w: 390, h: 844, r: 3 })).toBe("1170x2532");
    expect(parseSplash("1170x2532")).toEqual({ w: 390, h: 844, r: 3 });
  });
  it("only serves known sizes", () => {
    expect(parseSplash("9999x9999")).toBeNull();
    expect(parseSplash("1170x2532; drop")).toBeNull();
  });
  it("every size has a unique key and a media query", () => {
    const keys = SPLASH_SIZES.map(splashKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(splashMedia(SPLASH_SIZES[0])).toContain("device-width: 440px");
  });
});
