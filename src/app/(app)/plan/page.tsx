import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadPlan } from "@/lib/server/plan-data";
import { PlanView } from "./PlanView";

export const dynamic = "force-dynamic";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ problem?: string }> }) {
  const { problem } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) redirect("/login");

  let data;
  try {
    data = await loadPlan(supabase, uid, String(auth?.claims?.email ?? ""));
  } catch {
    return (
      <div className="scroll">
        <div className="empty" style={{ paddingTop: "var(--space-12)" }}>
          <h1 className="t-title">Can’t load your plan</h1>
          <p className="t-body c-2">Check your connection and try again.</p>
        </div>
      </div>
    );
  }
  if (!data) redirect("/install");
  return <PlanView key={data.planType} data={data} deleteProblem={problem === "delete"} />;
}
