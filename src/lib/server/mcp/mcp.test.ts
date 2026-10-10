import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

vi.mock("next/server", () => ({ after: () => {} }));
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { registerTools, TOOL_NAMES, type McpContext } from "./tools";
import { handleMcp } from "./handler";

// A database that blows up if touched: validation must reject bad input BEFORE any data access.
const explode = new Proxy({}, { get: () => { throw new Error("database was touched"); } });
const ctx = { supabase: explode as unknown as McpContext["supabase"], uid: "11111111-1111-4111-8111-111111111111", clientId: "claude" } satisfies McpContext;

async function connect() {
  const server = new McpServer({ name: "test", version: "1" });
  registerTools(server, ctx);
  const client = new Client({ name: "t", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const call = async (name: string, args: Record<string, unknown>) => {
  const c = await connect();
  try {
    const r = (await c.callTool({ name, arguments: args })) as { isError?: boolean; content: { type: string; text: string }[] };
    return { isError: !!r.isError, text: r.content.map((x) => x.text).join("\n") };
  } catch (e) {
    return { isError: true, text: String(e) };
  }
};

describe("tool list", () => {
  it("exposes exactly the listed tools", async () => {
    const c = await connect();
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
    expect(tools).toHaveLength(24);
  });
  it("marks read tools read-only and write tools as non-destructive", async () => {
    const { tools } = await (await connect()).listTools();
    const by = Object.fromEntries(tools.map((t) => [t.name, t.annotations]));
    for (const n of ["get_today_workout", "get_history", "get_progress", "suggest_next_weights", "get_review"]) expect(by[n]).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    for (const n of ["get_plan", "list_exercises", "get_schedule", "get_settings"]) expect(by[n]).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    for (const n of ["log_sets", "log_cardio", "log_checkin", "start_workout", "finish_workout", "edit_logged_sets"]) expect(by[n]).toMatchObject({ readOnlyHint: false, destructiveHint: false });
  });
  it("has no tool for the account or restarting the programme, and every delete is marked destructive", async () => {
    const { tools } = await (await connect()).listTools();
    expect(tools.some((t) => /account|restart|reset|program_state|switch_plan/i.test(t.name))).toBe(false);
    for (const t of tools.filter((x) => /^delete_/.test(x.name))) {
      expect(t.annotations).toMatchObject({ destructiveHint: true, readOnlyHint: false });
      expect(JSON.stringify(t.inputSchema)).toContain("confirm");
    }
  });
  it("describes log_sets with bounded inputs", async () => {
    const { tools } = await (await connect()).listTools();
    const schema = JSON.stringify(tools.find((t) => t.name === "log_sets")!.inputSchema);
    expect(schema).toContain('"maxItems":2');
    expect(schema).toContain('"maximum":400');
  });
});

describe("destructive tools refuse without an explicit confirmation", () => {
  it("delete_workout needs confirm: true and a matching confirm_date", async () => {
    const noConfirm = await call("delete_workout", { date: "2026-10-08", confirm_date: "2026-10-08" });
    expect(noConfirm.isError).toBe(true);
    const falseConfirm = await call("delete_workout", { date: "2026-10-08", confirm_date: "2026-10-08", confirm: false });
    expect(falseConfirm.isError).toBe(true);
  });
  it("delete_logged_sets and delete_cardio_entry need confirm: true", async () => {
    expect((await call("delete_logged_sets", { exercise: "chest press" })).isError).toBe(true);
    expect((await call("delete_cardio_entry", { date: "2026-10-08", machine: "bike" })).isError).toBe(true);
  });
  it("edit_plan_day rejects 3 sets and an empty list", async () => {
    expect((await call("edit_plan_day", { weekday: 1, exercises: [{ exercise: "chest press", sets: 3, rep_lo: 8, rep_hi: 12 }] })).isError).toBe(true);
    expect((await call("edit_plan_day", { weekday: 1, exercises: [] })).isError).toBe(true);
  });
});

describe("preview and undo", () => {
  it("every delete and the plan edit can be previewed with dry_run", async () => {
    const { tools } = await (await connect()).listTools();
    for (const n of ["delete_logged_sets", "delete_workout", "delete_cardio_entry", "edit_plan_day"]) {
      expect(JSON.stringify(tools.find((t) => t.name === n)!.inputSchema)).toContain("dry_run");
    }
  });
  it("exposes the change log and undo, and undo only takes a real id", async () => {
    const { tools } = await (await connect()).listTools();
    expect(tools.find((t) => t.name === "get_change_log")!.annotations).toMatchObject({ readOnlyHint: true });
    expect(JSON.stringify(tools.find((t) => t.name === "undo_change")!.inputSchema)).toContain("uuid");
    expect((await call("undo_change", { id: "not-an-id" })).isError).toBe(true);
  });
  it("a delete with neither confirm nor dry_run changes nothing and says how to proceed", async () => {
    const r = await call("delete_workout", { date: "2026-10-08", confirm_date: "2026-10-08" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("dry_run");
  });
});

describe("narrow, validated writes (rejected before touching the database)", () => {
  const ok = { exercise: "chest press", sets: [{ weight_kg: 30, reps: 12 }] };
  it("log_sets rejects too many sets, bad numbers and missing fields", async () => {
    for (const bad of [
      { ...ok, sets: [{ weight_kg: 30, reps: 12 }, { weight_kg: 30, reps: 12 }, { weight_kg: 30, reps: 12 }] },
      { ...ok, sets: [] },
      { ...ok, sets: [{ weight_kg: -1, reps: 12 }] },
      { ...ok, sets: [{ weight_kg: 401, reps: 12 }] },
      { ...ok, sets: [{ weight_kg: 30, reps: 0 }] },
      { ...ok, sets: [{ weight_kg: 30, reps: 12.5 }] },
      { ...ok, sets: [{ weight_kg: 30, seconds: 99999 }] },
      { exercise: "x", sets: ok.sets },
      { exercise: "a".repeat(61), sets: ok.sets },
      { sets: ok.sets },
      { exercise: "chest press" },
    ]) {
      const r = await call("log_sets", bad);
      expect(r.isError, JSON.stringify(bad)).toBe(true);
      expect(r.text).not.toContain("database was touched");
    }
  });
  it("log_cardio rejects unknown machines, bad minutes and feels", async () => {
    for (const bad of [{ machine: "jetski", minutes: 10 }, { machine: "bike", minutes: 0 }, { machine: "bike", minutes: 181 }, { machine: "bike", minutes: 10, feel: "awful" }, { machine: "bike", minutes: 10, settings: { res: "5" } }, { minutes: 10 }]) {
      const r = await call("log_cardio", bad);
      expect(r.isError, JSON.stringify(bad)).toBe(true);
      expect(r.text).not.toContain("database was touched");
    }
  });
  it("log_checkin rejects out-of-range values", async () => {
    for (const bad of [{ soreness: 0 }, { soreness: 6 }, { energy: 2.5 }, { bodyweight_kg: 5 }, { bodyweight_kg: 999 }, { notes: "x".repeat(501) }]) {
      const r = await call("log_checkin", bad);
      expect(r.isError, JSON.stringify(bad)).toBe(true);
      expect(r.text).not.toContain("database was touched");
    }
  });
  it("read tools reject bad arguments too", async () => {
    expect((await call("get_history", { days: 0 })).isError).toBe(true);
    expect((await call("get_history", { days: 1000 })).isError).toBe(true);
    expect((await call("get_review", { week: 5 })).isError).toBe(true);
  });
  it("unknown tools are refused", async () => {
    expect((await call("delete_everything", {})).isError).toBe(true);
  });
});

const req = (headers: Record<string, string> = {}, body = '{"jsonrpc":"2.0","id":1,"method":"tools/list"}') =>
  new Request("https://app.example/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers }, body });

describe("endpoint authentication", () => {
  it("answers 401 with sign-in discovery when there is no token", async () => {
    const r = await handleMcp(req({ "x-forwarded-for": "9.9.9.1" }));
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toBe('Bearer resource_metadata="https://app.example/.well-known/oauth-protected-resource"');
  });
  it("rejects malformed and junk tokens without touching the database", async () => {
    for (const h of ["Bearer", "Bearer short", "Basic abcdefghijklmnopqrstuvwxyz", "Bearer ../../etc/passwd/................", `Bearer ${"a".repeat(5000)}`]) {
      const r = await handleMcp(req({ authorization: h, "x-forwarded-for": "9.9.9.2" }));
      expect(r.status).toBe(401);
    }
  });
  it("rate limits repeated failed attempts from one address", async () => {
    let last = 0;
    for (let i = 0; i < 40; i++) last = (await handleMcp(req({ "x-forwarded-for": "9.9.9.3" }))).status;
    expect(last).toBe(429);
  });
});
