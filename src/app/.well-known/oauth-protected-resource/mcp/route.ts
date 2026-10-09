import { protectedResourceMetadata } from "@/lib/server/mcp/metadata";

export const dynamic = "force-dynamic";

// Some clients look for the metadata at a path that mirrors the resource URL.
export function GET(req: Request) {
  return Response.json(protectedResourceMetadata(new URL(req.url).origin), { headers: { "Cache-Control": "public, max-age=300" } });
}
