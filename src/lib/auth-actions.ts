"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sydneyToday } from "@/lib/dates";

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * End of onboarding (install guide, then notifications). Starts the programme on first run only,
 * so visiting these screens again later never resets your start date. The 5-day plan is the default;
 * switching plans lives in the Plan editor.
 */
export async function completeOnboarding(formData: FormData) {
  const restAlerts = formData.get("restAlerts") === "true";
  const supabase = await createClient();

  const { data: existing } = await supabase.from("program_state").select("user_id").maybeSingle();
  if (!existing) {
    const { error } = await supabase.rpc("start_program", { p_plan_type: "5day", p_start_date: sydneyToday() });
    if (error) redirect("/notifications?problem=save");
  }
  await supabase.from("program_state").update({ rest_alerts: restAlerts }).not("user_id", "is", null);
  redirect("/");
}
