import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { counts, missingRows, parseBackup, type RestoreRows } from "@/lib/restore";

export const dynamic = "force-dynamic";

const FRIENDLY = "That didn’t work. Try again in a moment.";
const TABLES: (keyof RestoreRows)[] = ["workouts", "sets", "cardio_entries", "checkins"];

/**
 * POST the backup JSON. `?apply=1` adds what is missing; without it, only says what WOULD be added. Adds only (existing rows are
 * never changed or deleted), as the signed-in user (row-level security applies).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return NextResponse.json({ ok: false, error: "Please log in first." }, { status: 401 });
  const text = await req.text();
  if (text.length > 4_000_000) return NextResponse.json({ ok: false, error: "That file is too big to restore here (over 4 MB)." }, { status: 413 });
  const parsed = parseBackup(text);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  const have = { workouts: new Set<string>(), sets: new Set<string>(), cardio_entries: new Set<string>(), checkins: new Set<string>() };
  for (const t of TABLES) {
    // The database returns at most 1000 rows a call, so read the ids page by page.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(t).select("id").order("id").range(from, from + 999);
      if (error) return NextResponse.json({ ok: false, error: FRIENDLY }, { status: 500 });
      for (const r of data ?? []) have[t].add(r.id);
      if ((data?.length ?? 0) < 1000) break;
    }
  }
  const add = missingRows(parsed.rows, have);
  const apply = new URL(req.url).searchParams.get("apply") === "1";
  if (!apply) return NextResponse.json({ ok: true, applied: false, would_add: counts(add), skipped: parsed.skipped });

  for (const t of TABLES) {
    for (let i = 0; i < add[t].length; i += 500) {
      const { error } = await supabase.from(t).upsert(add[t].slice(i, i + 500) as never, { onConflict: "id", ignoreDuplicates: true });
      if (error) return NextResponse.json({ ok: false, error: "Part of the restore failed, so it stopped. Nothing already in your account was changed. Try again." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, applied: true, added: counts(add), skipped: parsed.skipped });
}
