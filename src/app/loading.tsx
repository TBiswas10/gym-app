import { Icon } from "@/components/Icon";

// What shows the instant the app opens, before a screen's own data has arrived: the same dark screen and lime tile
// as the launch image, so opening the app is one continuous picture instead of white, then the app.
export default function Loading() {
  return (
    <div className="screen fill" aria-busy="true" aria-label="Loading" style={{ alignItems: "center", justifyContent: "center" }}>
      <span className="round round-accent anim-fade" style={{ width: 56, height: 56, borderRadius: "var(--radius-md)" }}>
        <Icon name="dumbbell" size={32} />
      </span>
    </div>
  );
}
