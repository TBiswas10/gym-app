import { describe, expect, it } from "vitest";
import { classifySwipe, neighbourTab, rubberband, tabIndex } from "./tabs";

describe("tabs", () => {
  it("finds the tab, including sub-pages", () => {
    expect(tabIndex("/")).toBe(0);
    expect(tabIndex("/progress")).toBe(1);
    expect(tabIndex("/plan/anything")).toBe(3);
    expect(tabIndex("/workout")).toBe(-1);
  });
  it("swiping left goes next, right goes previous, none past the ends", () => {
    expect(neighbourTab("/", 1)).toBe("/progress");
    expect(neighbourTab("/library", -1)).toBe("/progress");
    expect(neighbourTab("/", -1)).toBeNull();
    expect(neighbourTab("/plan", 1)).toBeNull();
    expect(neighbourTab("/workout", 1)).toBeNull();
  });
  it("only the tab screens swipe between tabs, not their sub-pages", () => {
    expect(neighbourTab("/library/chest", 1)).toBeNull();
    expect(neighbourTab("/progress/history", 1)).toBeNull();
    expect(neighbourTab("/plan/changes", -1)).toBeNull();
    expect(neighbourTab("/progress/", 1)).toBe("/library");
  });
  it("classifies drags", () => {
    expect(classifySwipe(-120, 10, 0, false)).toBe("next");
    expect(classifySwipe(120, -10, 0, false)).toBe("prev");
    expect(classifySwipe(-40, 5, 0.8, false)).toBe("next"); // a short flick
    expect(classifySwipe(-40, 5, 0.1, false)).toBe("none"); // a slow short drag
    expect(classifySwipe(-120, 100, 0, false)).toBe("none"); // mostly vertical
    expect(classifySwipe(5, 120, 0, true)).toBe("refresh");
    expect(classifySwipe(5, 120, 0, false)).toBe("none");
  });
  it("rubber band resists", () => {
    expect(rubberband(0)).toBe(0);
    expect(rubberband(100)).toBeLessThan(100);
    expect(rubberband(400)).toBeLessThan(390);
  });
});
