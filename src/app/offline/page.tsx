import { Icon } from "@/components/Icon";
import { RetryButton } from "@/components/RetryButton";

// Shown by the service worker when a screen can't be loaded. Static, so it works with no signal.
export default function OfflinePage() {
  return (
    <div className="screen fill">
      <div className="scroll">
        <div className="empty" style={{ paddingTop: "var(--space-12)" }}>
          <span className="round round-warning"><Icon name="wifi-off" /></span>
          <h1 className="t-title">You’re offline</h1>
          <p className="t-body c-2">This screen needs a connection. Anything you already logged is safe on this phone and will sync when you’re back online.</p>
        </div>
      </div>
      <div className="bottom-bar"><RetryButton /></div>
    </div>
  );
}
