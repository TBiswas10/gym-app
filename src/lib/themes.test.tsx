import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemePicker } from "@/components/ThemePicker";
import { THEMES, isTheme } from "./themes";

const css = readFileSync("src/styles/tokens.css", "utf8");

/** The variables of one palette: the :root block for lime, the [data-theme] block for the others. */
function palette(id: string): Record<string, string> {
  const root = css.match(/:root\{([^}]*)\}/)![1];
  const block = id === "lime" ? root : css.match(new RegExp(String.raw`\[data-theme="${id}"\]\{([^}]*)\}`))![1];
  const out: Record<string, string> = {};
  for (const m of (id === "lime" ? block : root + block).matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("colour themes", () => {
  for (const t of THEMES) {
    const p = palette(t.id);
    it(`${t.name} meets contrast: text, secondary text, accent and button text`, () => {
      expect(ratio(p.text, p.bg)).toBeGreaterThanOrEqual(7);
      expect(ratio(p["text-2"], p.surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p["text-2"], p.raised)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p.accent, p.surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p["on-accent"], p.accent)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p["on-accent"], p["accent-pressed"])).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p["border-strong"], p.bg)).toBeGreaterThanOrEqual(3);
    });
  }
  it("has five themes and recognises only them", () => {
    expect(THEMES.map((t) => t.id)).toEqual(["lime", "teal", "amber", "amethyst", "stealth"]);
    expect(isTheme("amber")).toBe(true);
    expect(isTheme("red")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
  it("the picker shows every theme as a radio, each swatch scoped to its own palette", () => {
    const out = renderToStaticMarkup(<ThemePicker />);
    for (const t of THEMES) expect(out).toContain(t.name);
    expect(out.match(/role="radio"/g)).toHaveLength(5);
    for (const id of ["teal", "amber", "amethyst", "stealth"]) expect(out).toContain(`data-theme="${id}"`);
  });
});
