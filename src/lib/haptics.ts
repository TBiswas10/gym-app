"use client";

// iPhone web apps have no vibrate API, but Safari 17.4+ taps the haptic engine when a "switch" checkbox is toggled.
// We toggle a hidden one. If the phone doesn't support it, nothing happens (never an error).
let label: HTMLLabelElement | null = null;

function ensure(): HTMLLabelElement | null {
  if (typeof document === "undefined") return null;
  if (label && document.body.contains(label)) return label;
  const l = document.createElement("label");
  l.setAttribute("aria-hidden", "true");
  l.style.cssText = "position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  l.appendChild(input);
  document.body.appendChild(l);
  label = l;
  return l;
}

export function haptic(kind: "tap" | "success" = "tap"): void {
  try {
    ensure()?.click();
    if (kind === "success") window.setTimeout(() => ensure()?.click(), 90);
    navigator.vibrate?.(kind === "success" ? [20, 60, 20] : 10);
  } catch {
    /* no haptics here */
  }
}
