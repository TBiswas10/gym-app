import { ImageResponse } from "next/og";
import { ACCENT, ON_ACCENT } from "./tokens";

// Lime tile with the dumbbell glyph from the design (login logo / Home Screen tile).
// Full-bleed square so iOS applies its own rounding. The glyph stays inside the maskable safe zone.
export function appIcon(size: number) {
  const glyph = Math.round(size * 0.5);
  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: ACCENT,
        }}
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke={ON_ACCENT}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path fill="none" d="M14.4 14.4 9.6 9.6" />
          <path fill="none" d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" />
          <path fill="none" d="m21.5 21.5-1.4-1.4" />
          <path fill="none" d="M3.9 3.9 2.5 2.5" />
          <path fill="none" d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
