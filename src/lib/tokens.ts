// Single source of truth for token values used outside CSS (image and manifest routes).
// Reads the exported Tailwind config so nothing is hard-coded twice.
import tw from "../../tailwind.config.js";

type Colors = { bg: string; accent: { DEFAULT: string; on: string } };
const colors = (tw as unknown as { theme: { extend: { colors: Colors } } }).theme.extend.colors;

export const ACCENT = colors.accent.DEFAULT;
export const ON_ACCENT = colors.accent.on;
export const BG = colors.bg;
