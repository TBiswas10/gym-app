import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listChanges } from "@/lib/server/change-log";
import { ChangesView } from "./ChangesView";

export const dynamic = "force-dynamic";

export default async function ChangesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");
  const rows = await listChanges(supabase, 60);
  return <ChangesView rows={rows} />;
}
