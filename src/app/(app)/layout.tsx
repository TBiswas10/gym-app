import { GestureTour } from "@/components/GestureTour";
import { OnlineBanner } from "@/components/OnlineBanner";
import { SwipeTabs } from "@/components/SwipeTabs";
import { TabBar } from "@/components/TabBar";

// Screens with the bottom tab bar. Each page renders its own .scroll area and optional .bottom-bar.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="screen fill">
      <OnlineBanner />
      <SwipeTabs>{children}</SwipeTabs>
      <TabBar />
      <GestureTour />
    </div>
  );
}
