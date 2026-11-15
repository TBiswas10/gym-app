import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guards the design tokens against contrast and tap-size regressions. Reads the CSS as text, so no build is needed.

const tokensCss = readFileSync(path.join(import.meta.dirname, "styles", "tokens.css"), "utf8");
const root = tokensCss.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "";
const tokens = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)].map((m) => [m[1], m[2]]));

/** WCAG relative luminance of an sRGB hex colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours, 1 to 21. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_TOKENS = ["text", "text-2", "accent", "success", "warning", "danger", "info"];
const SURFACES = ["bg", "surface", "raised"];

describe("design tokens: contrast", () => {
  it("reads the :root colour tokens", () => {
    expect(Object.keys(tokens)).toEqual(expect.arrayContaining(["bg", "surface", "raised", ...TEXT_TOKENS]));
  });

  for (const fg of TEXT_TOKENS) {
    for (const bg of SURFACES) {
      it(`--${fg} on --${bg} is at least 4.5:1`, () => {
        expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  // --text-3 is only for non-essential hints (placeholders, captions that repeat what is already clear).
  // It is held to 3:1, the WCAG bar for large or non-text content, rather than 4.5:1.
  for (const bg of SURFACES) {
    it(`--text-3 on --${bg} is at least 3:1 (non-essential hints only)`, () => {
      expect(contrast(tokens["text-3"], tokens[bg])).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("design tokens: tap targets", () => {
  // Controls must be at least 44px tall. Only plain px values are checked; var() sizes come from the tokens above.
  const CONTROL = /\.(btn|chip|seg|icon-btn|step-btn|set)(?![\w-])/;
  const SMALL_HEIGHT = /(?<![\w-])(?:min-)?height\s*:\s*(\d+(?:\.\d+)?)px/g;

  it("no control class sets a height or min-height under 44px", () => {
    const dir = path.join(import.meta.dirname, "styles");
    const offenders: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".css"))) {
      const css = readFileSync(path.join(dir, file), "utf8");
      for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        // Pseudo-elements (a spinner drawn on a button) are decoration, not the tap target.
        if (selector.includes("::") || !CONTROL.test(selector)) continue;
        for (const m of body.matchAll(SMALL_HEIGHT)) {
          if (Number(m[1]) < 44) offenders.push(`${file}: ${selector.trim()} { ${m[0]} }`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
