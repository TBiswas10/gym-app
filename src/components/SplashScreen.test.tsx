import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SplashScreen } from "./SplashScreen";

describe("SplashScreen", () => {
  it("renders the brand moment on the server so there is no white gap before it", () => {
    const out = renderToStaticMarkup(<SplashScreen />);
    expect(out).toContain("splash");
    expect(out).toContain("Workout");
    expect(out).toContain("Short sessions. Simple tracking.");
    expect(out).toContain('aria-hidden="true"');
  });
});
