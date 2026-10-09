"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/** A calm heads-up when the phone has no signal. Logged sets are kept on the phone and sent later. */
export function OnlineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  if (online) return null;
  return (
    <div className="banner banner-warning" role="status" style={{ margin: "var(--safe-top) var(--space-4) 0" }}>
      <Icon name="wifi-off" />
      <span><b>Offline.</b> You can keep logging. Changes are saved on this phone and sent when you’re back online.</span>
    </div>
  );
}
