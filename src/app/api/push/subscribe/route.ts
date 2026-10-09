import { createClient } from "@/lib/supabase/server";
import { validateSubscription } from "@/lib/push";
import { createLimiter } from "@/lib/rate-limit";

const limiter = createLimiter(20, 60_000);

/** Save this phone's push address (after you allowed notifications in the installed app). */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return Response.json({ ok: false }, { status: 401 });
  if (!limiter.hit(uid).ok) return Response.json({ ok: false }, { status: 429 });

  const sub = validateSubscription(await req.json().catch(() => null));
  if (!sub) return Response.json({ ok: false }, { status: 400 });
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, user_agent: (req.headers.get("user-agent") ?? "").slice(0, 200) }, { onConflict: "endpoint" });
  return error ? Response.json({ ok: false }, { status: 500 }) : Response.json({ ok: true });
}

/** Forget this phone (alerts turned off). */
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return Response.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string" || body.endpoint.length > 600) return Response.json({ ok: false }, { status: 400 });
  await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  return Response.json({ ok: true });
}
