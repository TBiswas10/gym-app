import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShareView } from "./ShareView";

export const dynamic = "force-dynamic";

export default async function SharePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");
  const { data } = await supabase.from("share_links").select("id, token, label, created_at, expires_at, revoked_at").order("created_at", { ascending: false }).limit(10);
  const now = Date.now();
  const links = (data ?? []).map((l) => ({
    id: l.id,
    token: l.token,
    label: l.label,
    expiresAt: l.expires_at,
    live: !l.revoked_at && Date.parse(l.expires_at) > now,
  }));
  return <ShareView links={links} />;
}
