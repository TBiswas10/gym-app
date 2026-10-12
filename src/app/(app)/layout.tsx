import Link from "next/link";
import { GestureTour } from "@/components/GestureTour";
import { Icon } from "@/components/Icon";
import { OnlineBanner } from "@/components/OnlineBanner";
import { SwipeTabs } from "@/components/SwipeTabs";
import { SyncKeeper } from "@/components/SyncKeeper";
import { TabBar } from "@/components/TabBar";
import { createClient } from "@/lib/supabase/server";

// Screens with the bottom tab bar. Each page renders its own .scroll area and optional .bottom-bar.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Test mode is shown on every tab, so it can't be left on by accident.
  let testMode = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("program_state").select("test_mode").maybeSingle();
    testMode = !!data?.test_mode;
  } catch {
    /* no bar if it can't be read */
  }
  return (
    <div className="screen fill">
      <OnlineBanner />
      {testMode && (
        <Link className="test-bar" href="/plan" aria-label="Test mode is on. Open Plan to turn it off.">
          <Icon name="triangle-alert" size={16} />
          <span><b>Test mode is on.</b> Sessions you do now are deleted when you exit.</span>
          <Icon name="chevron-right" size={16} />
        </Link>
      )}
      <SyncKeeper />
      <SwipeTabs>{children}</SwipeTabs>
      <TabBar />
      <GestureTour />
    </div>
  );
}
