"use client";

import { useEffect, useState } from "react";

// Temporary: prints the real window and tab bar sizes at the bottom of the screen.
export function DebugBadge() {
  const [t, setT] = useState("");
  useEffect(() => {
    const read = () => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;left:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden";
      document.body.appendChild(probe);
      const safe = parseFloat(getComputedStyle(probe).paddingBottom);
      probe.remove();
      const bar = document.querySelector(".tabbar")?.getBoundingClientRect();
      const scr = document.querySelector(".screen.fill")?.getBoundingClientRect();
      const css = getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom");
      setT(`inner ${innerHeight} screen ${screen.height} envBottom ${safe} --safe-bottom ${css.trim()} tabbar h${bar?.height.toFixed(0)} bottom${bar?.bottom.toFixed(0)} screenEl h${scr?.height.toFixed(0)} standalone ${String((navigator as unknown as { standalone?: boolean }).standalone)} v6 fit${document.documentElement.hasAttribute("data-fit")}`);
    };
    read();
    const id = setInterval(read, 1500);
    return () => clearInterval(id);
  }, []);
  return <div style={{ position: "fixed", left: 8, right: 8, bottom: 4, zIndex: 99, font: "600 11px/14px var(--font-body)", color: "var(--accent)", pointerEvents: "none" }}>{t}</div>;
}
