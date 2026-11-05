import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadWorkout } from "@/lib/server/workout-data";

export const dynamic = "force-dynamic";

// The workout screen's data for a session that is NOT started yet, so the phone can keep it and start the session with no signal.
// Nothing is written here: the session is created later by a "start" operation.
export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const loaded = await loadWorkout(supabase, uid, date, new Date(), null, true);
    if ("redirect" in loaded) return NextResponse.json({ ok: false, reason: "none" });
    return NextResponse.json({ ok: true, date, page: loaded.page }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
