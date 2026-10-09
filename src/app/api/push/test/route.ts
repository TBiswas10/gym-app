import { createClient } from "@/lib/supabase/server";
import { createLimiter } from "@/lib/rate-limit";
import { pushConfigured, sendToUser } from "@/lib/server/push";

const limiter = createLimiter(5, 60_000);

/** "Send a test alert" from the Plan screen: proves the whole chain works on this phone. */
export async function POST() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return Response.json({ sent: 0, reason: "signed-out" }, { status: 401 });
  if (!limiter.hit(uid).ok) return Response.json({ sent: 0, reason: "slow-down" }, { status: 429 });
  if (!pushConfigured()) return Response.json({ sent: 0, reason: "not-configured" });
  const r = await sendToUser(supabase, { title: "Rest’s up. This is a test", body: "Notifications are working. Ready when you are.", url: "/plan" });
  const rejected = r.failed[0];
  return Response.json({ sent: r.sent, reason: r.sent ? "ok" : rejected ? "rejected" : "no-device", status: rejected?.status ?? null, removed: r.removed });
}
