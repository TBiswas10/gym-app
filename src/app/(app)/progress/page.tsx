import { createClient } from "@/lib/supabase/server";
import { loadProgress } from "@/lib/server/progress-data";
import { ProgressView } from "./ProgressView";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const supabase = await createClient();
  try {
    return <ProgressView data={await loadProgress(supabase)} />;
  } catch {
    return (
      <div className="scroll">
        <div className="empty" style={{ paddingTop: "var(--space-12)" }}>
          <h1 className="t-title">Can’t load your progress</h1>
          <p className="t-body c-2">Check your connection and try again.</p>
        </div>
      </div>
    );
  }
}
