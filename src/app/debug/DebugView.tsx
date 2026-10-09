"use client";

import { useEffect, useState } from "react";

// Temporary: shows how big the window really is, and outlines it.
export function DebugView() {
  const [info, setInfo] = useState<Record<string, string>>({});
  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;visibility:hidden";
    document.body.appendChild(probe);
    const vv = window.visualViewport;
    const read = () =>
      setInfo({
        standalone: String((navigator as unknown as { standalone?: boolean }).standalone ?? matchMedia("(display-mode: standalone)").matches),
        innerHeight: String(window.innerHeight),
        outerHeight: String(window.outerHeight),
        screenHeight: String(screen.height),
        visualViewportHeight: String(vv?.height),
        fixedInsetZeroHeight: String(probe.getBoundingClientRect().height),
        dvh100: String(CSS.supports("height", "100dvh")),
        build: "fixed-inset-v1",
      });
    read();
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("resize", read);
      probe.remove();
    };
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, border: "4px solid var(--accent)", padding: "var(--safe-top) var(--space-4) var(--space-4)", background: "var(--bg)", color: "var(--text)", overflow: "auto" }}>
      <h1 className="t-title">Screen check</h1>
      {Object.entries(info).map(([k, v]) => (
        <p key={k} className="t-body">{k}: <b>{v}</b></p>
      ))}
      <p className="t-small c-2">The green outline is the edge of the area the app can draw in.</p>
    </div>
  );
}
