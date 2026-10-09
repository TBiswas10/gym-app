import { protectedResourceMetadata } from "@/lib/server/mcp/metadata";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return Response.json(protectedResourceMetadata(new URL(req.url).origin), { headers: { "Cache-Control": "public, max-age=300" } });
}
