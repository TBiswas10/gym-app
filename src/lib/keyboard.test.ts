import { describe, expect, it } from "vitest";
import { fullScreenHeight, keyboardOpen } from "./keyboard";

describe("keyboardOpen", () => {
  it("is open when the visible area loses a keyboard's worth of height", () => {
    expect(keyboardOpen(844, 500)).toBe(true);
  });
  it("ignores a small change like the browser bar", () => {
    expect(keyboardOpen(844, 800)).toBe(false);
    expect(keyboardOpen(844, 844)).toBe(false);
  });
});

describe("fullScreenHeight", () => {
  it("uses the screen height when the app window is a status bar short", () => {
    expect(fullScreenHeight(true, 797, 844)).toBe(844);
  });
  it("leaves normal windows, browsers and tiny/huge gaps alone", () => {
    expect(fullScreenHeight(true, 844, 844)).toBeNull();
    expect(fullScreenHeight(false, 797, 844)).toBeNull();
    expect(fullScreenHeight(true, 500, 844)).toBeNull();
  });
});
