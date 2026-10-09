import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateRestRequest, waitMs } from "@/lib/push";
import { createLimiter } from "@/lib/rate-limit";
import { pushConfigured, sendToUser } from "@/lib/server/push";

// The server waits out the rest, then sends the alert. Fluid Compute allows this; rests are 10-300 s.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const limiter = createLimiter(40, 60_000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The phone says "rest started"; the server sends the notification when it ends, unless cancelled. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return Response.json({ id: null, reason: "signed-out" }, { status: 401 });
  if (!limiter.hit(uid).ok) return Response.json({ id: null, reason: "slow-down" }, { status: 429 });

  const input = validateRestRequest(await req.json().catch(() => null));
  if (!input) return Response.json({ id: null, reason: "bad-request" }, { status: 400 });
  if (!pushConfigured()) return Response.json({ id: null, reason: "not-configured" });

  const [{ data: state }, { count }] = await Promise.all([
    supabase.from("program_state").select("rest_alerts").maybeSingle(),
    supabase.from("push_subscriptions").select("id", { count: "exact", head: true }),
  ]);
  if (!state?.rest_alerts) return Response.json({ id: null, reason: "alerts-off" });
  if (!count) return Response.json({ id: null, reason: "no-device" });

  // Only one rest at a time: a new one replaces any that is still waiting.
  await supabase.from("rest_timers").update({ status: "cancelled" }).eq("status", "pending");
  const endsAtMs = Date.now() + input.seconds * 1000;
  const { data: timer, error } = await supabase.from("rest_timers").insert({ ends_at: new Date(endsAtMs).toISOString(), title: input.title, body: input.body }).select("id").single();
  if (error || !timer) return Response.json({ id: null, reason: "error" }, { status: 500 });

  after(async () => {
    await sleep(waitMs(endsAtMs, Date.now()));
    // Claim it: only the request that flips pending -> sent actually sends.
    const { data: claimed } = await supabase.from("rest_timers").update({ status: "sent" }).eq("id", timer.id).eq("status", "pending").select("id");
    if (!claimed?.length) return;
    await sendToUser(supabase, { title: input.title, body: input.body });
    if (Math.random() < 0.05) await supabase.from("rest_timers").delete().lt("created_at", new Date(Date.now() - 86_400_000).toISOString());
  });
  return Response.json({ id: timer.id });
}
