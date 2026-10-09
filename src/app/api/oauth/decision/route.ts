import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Approve or deny a connector. Needs your signed-in session, and the request must come from this site. */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const from = request.headers.get("origin");
  if (from && from !== origin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const form = await request.formData();
  const id = String(form.get("authorization_id") ?? "");
  const decision = form.get("decision");
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(id) || (decision !== "approve" && decision !== "deny")) {
    return NextResponse.redirect(`${origin}/oauth/consent`, 303);
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return NextResponse.redirect(`${origin}/login`, 303);

  const { data, error } = decision === "approve" ? await supabase.auth.oauth.approveAuthorization(id) : await supabase.auth.oauth.denyAuthorization(id);
  if (error || !data?.redirect_url) return NextResponse.redirect(`${origin}/oauth/consent?authorization_id=${encodeURIComponent(id)}`, 303);
  return NextResponse.redirect(data.redirect_url, 303);
}
