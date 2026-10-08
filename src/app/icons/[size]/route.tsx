import { appIcon } from "@/lib/app-icon";

const SIZES = new Set([180, 192, 512]);

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const res = appIcon(size);
  res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return res;
}
