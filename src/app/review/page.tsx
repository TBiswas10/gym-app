import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadReview } from "@/lib/server/review-data";
import { ReviewView } from "./ReviewView";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const n = [4, 8, 12].includes(Number(week)) ? Number(week) : 4;
  const supabase = await createClient();
  let data;
  try {
    data = await loadReview(supabase, n);
  } catch {
    return (
      <div className="screen fill">
        <div className="scroll"><div className="empty" style={{ paddingTop: "var(--space-12)" }}><h1 className="t-title">Can’t load your check-in</h1><p className="t-body c-2">Check your connection and try again.</p></div></div>
        <div className="bottom-bar"><Link className="btn btn-primary btn-cta" href="/progress">Back to Progress</Link></div>
      </div>
    );
  }
  if (!data) redirect("/install");
  return <ReviewView data={data} />;
}
