import { cleanReport } from "@/lib/error-report";
import { createClient } from "@/lib/supabase/server";

// Errors the phone hit. Only a signed-in user can write, only their own rows, and no more than 40 an hour.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const report = cleanReport(body);
  if (!report) return new Response(null, { status: 204 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return new Response(null, { status: 204 });

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase.from("client_errors").select("id", { count: "exact", head: true }).gte("created_at", since);
  if ((count ?? 0) >= 40) return new Response(null, { status: 204 });

  await supabase.from("client_errors").insert(report);
  return new Response(null, { status: 204 });
}
