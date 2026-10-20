// Colour themes. The palettes live in tokens.css ([data-theme="..."]); this file is only the list and the switch.
// The choice is kept on this phone (localStorage) and applied before the first paint (see the script in the root layout).

export type ThemeId = "lime" | "teal" | "amber" | "amethyst" | "stealth";

export const THEMES: { id: ThemeId; name: string; note: string }[] = [
  { id: "lime", name: "Lime", note: "The original" },
  { id: "teal", name: "Arctic Teal", note: "Clinical focus" },
  { id: "amber", name: "Liquid Amber", note: "Warm luxury" },
  { id: "amethyst", name: "Amethyst", note: "Deep focus" },
  { id: "stealth", name: "Stealth", note: "Pure black and platinum" },
];

export const THEME_KEY = "wt.theme";

export const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

/** The theme saved on this phone (the default when none, or when storage is blocked). */
export function savedTheme(): ThemeId {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : "lime";
  } catch {
    return "lime";
  }
}

/** Switch theme now and remember it. The page background is a token, so everything follows. */
export function applyTheme(id: ThemeId): void {
  const root = document.documentElement;
  if (id === "lime") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", id);
  try {
    window.localStorage.setItem(THEME_KEY, id);
  } catch {
    /* kept for this visit only */
  }
  // The browser UI colour follows the page background.
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute("content", bg);
}

/** Runs before first paint so there is no flash of the wrong palette. Kept tiny and dependency free. */
export const EARLY_THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(/^(teal|amber|amethyst|stealth)$/.test(t))document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
