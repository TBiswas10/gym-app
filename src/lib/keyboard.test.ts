import { describe, expect, it } from "vitest";
import { keyboardOpen } from "./keyboard";

describe("keyboardOpen", () => {
  it("is open when the visible area loses a keyboard's worth of height", () => {
    expect(keyboardOpen(844, 500)).toBe(true);
  });
  it("ignores a small change like the browser bar", () => {
    expect(keyboardOpen(844, 800)).toBe(false);
    expect(keyboardOpen(844, 844)).toBe(false);
  });
});
