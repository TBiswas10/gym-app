import { handleMcp } from "@/lib/server/mcp/handler";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Stateless MCP over streamable HTTP: one JSON request in, one JSON response out.
export async function POST(req: Request) {
  return handleMcp(req);
}

const notAllowed = () =>
  new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { Allow: "POST", "Content-Type": "application/json" } });
export const GET = notAllowed;
export const DELETE = notAllowed;
