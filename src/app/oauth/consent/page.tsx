import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConsentView } from "./ConsentView";

export const dynamic = "force-dynamic";

/** Where Supabase sends you to approve (or refuse) a connector such as Claude. */
export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ authorization_id?: string }> }) {
  const { authorization_id: id } = await searchParams;
  if (!id || !/^[A-Za-z0-9_-]{8,200}$/.test(id)) return <ConsentView state="bad" />;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (error || !data) return <ConsentView state="bad" />;
  // Already approved before: carry on straight back to the app that asked.
  if (!("authorization_id" in data)) redirect((data as { redirect_url: string }).redirect_url);

  let host = "";
  try {
    host = new URL(data.redirect_uri).host;
  } catch {
    host = "";
  }
  return <ConsentView state="ask" id={id} client={data.client.name || "An app"} host={host} />;
}
