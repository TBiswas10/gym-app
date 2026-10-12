import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadToday } from "@/lib/server/today-data";
import { loadV2Today, startV2Today, type V2Today } from "@/lib/server/v2-data";
import { TodayView } from "./TodayView";

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) redirect("/login");

  const pre = startV2Today(supabase); // runs while Today's own data loads
  let data;
  try {
    data = await loadToday(supabase, uid);
  } catch {
    return (
      <div className="scroll">
        <div className="empty">
          <h1 className="t-title">Can’t load your week</h1>
          <p className="t-body c-2">Check your connection, then pull down to try again.</p>
        </div>
      </div>
    );
  }
  if (!data) redirect("/install"); // first run: install guide, then notifications, then the programme starts
  // The briefing, nudges and review are extras: if they fail, Today still works.
  let v2: V2Today | undefined;
  try {
    v2 = await loadV2Today(supabase, data, pre);
  } catch {
    v2 = undefined;
  }
  return <TodayView data={data} v2={v2} />;
}
