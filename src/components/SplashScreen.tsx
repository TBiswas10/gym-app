"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

const KEY = "wt.splashSeen";
const HOLD_MS = 900;
const FADE_MS = 300;

// A short brand moment when the app is opened (once per launch, never on in-app navigation). It continues the iPhone
// launch image: same dark screen, same lime tile. It never blocks taps and gets out of the way after under a second.
export function SplashScreen() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(KEY) === "1";
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      /* storage blocked: show it once per page load */
    }
    if (seen) {
      setPhase("gone");
      return;
    }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t1 = window.setTimeout(() => setPhase("fade"), reduce ? 350 : HOLD_MS);
    const t2 = window.setTimeout(() => setPhase("gone"), (reduce ? 350 : HOLD_MS) + FADE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (phase === "gone") return null;
  return (
    <div className={`splash ${phase === "fade" ? "is-fading" : ""}`} aria-hidden="true">
      <span className="splash-tile">
        <Icon name="dumbbell" size={48} />
      </span>
      <span className="splash-name">Workout</span>
      <span className="splash-tag">Short sessions. Simple tracking.</span>
    </div>
  );
}
