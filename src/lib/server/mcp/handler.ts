import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Database } from "../../database.types";
import type { ServerClient } from "../../supabase/server";
import { createLimiter, isWriteTool, LIMITS, overLimit } from "../../rate-limit";
import { registerTools, type McpContext } from "./tools";

const MAX_BODY = 100_000;
const failedAuth = createLimiter(LIMITS.ipPerMinute, 60_000); // best effort: per serverless instance

const clientIp = (req: Request): string => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });

/** Where clients find out how to sign in (RFC 9728). Served by /.well-known/oauth-protected-resource. */
export const metadataUrl = (origin: string): string => `${origin}/.well-known/oauth-protected-resource`;

function unauthorized(origin: string, why: string): Response {
  return json(401, { error: "unauthorized", error_description: why }, { "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl(origin)}"` });
}

/**
 * Check the bearer token. It must be a Supabase OAuth access token (it carries a client_id), so your normal
 * app session can never be used here. The Supabase client built from it acts as YOU, so row-level security applies;
 * the service-role key is never used.
 */
async function authenticate(req: Request): Promise<McpContext | null> {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+([A-Za-z0-9._~+/=-]{20,4096})$/);
  if (!m) return null;
  const token = m[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabase = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  const c = data?.claims as Record<string, unknown> | undefined;
  if (error || !c) return null;
  if (typeof c.sub !== "string" || typeof c.client_id !== "string" || c.aud !== "authenticated") return null;
  if (typeof c.iss === "string" && new URL(c.iss).host !== new URL(url).host) return null;
  return { supabase: supabase as unknown as ServerClient, uid: c.sub, clientId: c.client_id };
}

interface Rpc {
  method?: unknown;
  params?: { name?: unknown };
}
function describe(body: unknown): { method: string; tool: string | null } {
  const first = (Array.isArray(body) ? body[0] : body) as Rpc | undefined;
  const method = typeof first?.method === "string" ? first.method.slice(0, 60) : "unknown";
  const tool = method === "tools/call" && typeof first?.params?.name === "string" ? first.params.name.slice(0, 60) : null;
  return { method, tool };
}

export async function handleMcp(req: Request): Promise<Response> {
  const started = Date.now();
  const origin = new URL(req.url).origin;
  const ip = clientIp(req);

  // Any problem while checking the token is simply "not signed in", never a crash.
  const ctx = await authenticate(req).catch(() => null);
  if (!ctx) {
    const gate = failedAuth.hit(ip);
    if (!gate.ok) return json(429, { error: "rate_limited", error_description: "Too many sign-in attempts. Wait a minute." }, { "Retry-After": String(gate.retryAfterS) });
    console.log(JSON.stringify({ evt: "mcp", status: 401, ip: ip.slice(0, 20) }));
    return unauthorized(origin, "Sign in to connect.");
  }

  // Read the body once (size capped) so we know which tool is being called.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY) return json(413, { error: "too_large" });
  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { error: "too_large" });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
  const { method, tool } = describe(body);

  // Per-user limits from the request log (authoritative).
  const since = new Date(Date.now() - 60_000).toISOString();
  const [{ count: total }, { count: writes }] = await Promise.all([
    ctx.supabase.from("mcp_requests").select("id", { count: "exact", head: true }).gte("created_at", since),
    ctx.supabase.from("mcp_requests").select("id", { count: "exact", head: true }).gte("created_at", since).in("tool", ["log_sets", "log_cardio", "log_checkin"]),
  ]);
  const limit = overLimit({ total: total ?? 0, writes: writes ?? 0 }, isWriteTool(tool));
  const log = (status: number, ok: boolean) =>
    after(async () => {
      const ms = Date.now() - started;
      console.log(JSON.stringify({ evt: "mcp", method, tool, status, ok, ms, client: ctx.clientId.slice(0, 8), user: ctx.uid.slice(0, 8) }));
      try {
        await ctx.supabase.from("mcp_requests").insert({ client_id: ctx.clientId, method, tool, ok, status, ms });
        if (Math.random() < 0.02) await ctx.supabase.from("mcp_requests").delete().lt("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString());
      } catch {
        /* logging must never break a request */
      }
    });
  if (limit.over) {
    log(429, false);
    return json(429, { jsonrpc: "2.0", id: null, error: { code: -32000, message: limit.reason } }, { "Retry-After": "30" });
  }

  const server = new McpServer({ name: "workout-tracker", version: "1.0.0" }, { instructions: "Reads and writes Tito's workout tracker. Dates are Australia/Sydney; weights are kilograms. Write tools only add or correct sets, cardio and check-ins in today's session and never delete. Check the returned summary and tell the user exactly what changed." });
  registerTools(server, ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    const res = await transport.handleRequest(req, { parsedBody: body, authInfo: { token: "", clientId: ctx.clientId, scopes: [] } });
    log(res.status, res.ok);
    return res;
  } catch {
    log(500, false);
    return json(500, { jsonrpc: "2.0", id: null, error: { code: -32603, message: "Something went wrong. Try again." } });
  } finally {
    after(() => server.close());
  }
}
