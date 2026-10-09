import { ImageResponse } from "next/og";
import { parseSplash } from "@/lib/splash";
import { ACCENT, BG, ON_ACCENT } from "@/lib/tokens";

// Dark launch screen with the app tile in the middle (no text, so no font to load).
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const s = parseSplash((await ctx.params).size);
  if (!s) return new Response("Not found", { status: 404 });
  const width = s.w * s.r;
  const height = s.h * s.r;
  const tile = Math.round(width * 0.24);
  const glyph = Math.round(tile * 0.5);
  const res = new ImageResponse(
    (
      <div style={{ width, height, display: "flex", alignItems: "center", justifyContent: "center", background: BG }}>
        <div style={{ width: tile, height: tile, borderRadius: Math.round(tile * 0.22), display: "flex", alignItems: "center", justifyContent: "center", background: ACCENT }}>
          <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke={ON_ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path fill="none" d="M14.4 14.4 9.6 9.6" />
            <path fill="none" d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" />
            <path fill="none" d="m21.5 21.5-1.4-1.4" />
            <path fill="none" d="M3.9 3.9 2.5 2.5" />
            <path fill="none" d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" />
          </svg>
        </div>
      </div>
    ),
    { width, height },
  );
  res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return res;
}
