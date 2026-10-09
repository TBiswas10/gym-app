import { createClient } from "@/lib/supabase/server";

/** Rest skipped or undone: don't send the alert. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return Response.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof body?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return Response.json({ ok: false }, { status: 400 });
  await supabase.from("rest_timers").update({ status: "cancelled" }).eq("id", body.id).eq("status", "pending");
  return Response.json({ ok: true });
}
