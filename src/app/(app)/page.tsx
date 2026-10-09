import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadToday } from "@/lib/server/today-data";
import { TodayView } from "./TodayView";

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) redirect("/login");

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
  return <TodayView data={data} />;
}
