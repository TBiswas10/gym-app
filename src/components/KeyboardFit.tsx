"use client";

import { useEffect } from "react";
import { fullScreenHeight, keyboardOpen } from "@/lib/keyboard";

// iPhone keeps the page the same size when the keyboard opens and covers its bottom. This shrinks the screen to
// the visible area so the bottom bar and the field you're typing in stay above the keyboard, and drops the extra
// home-indicator padding while the keyboard is up (it would be applied twice otherwise).
export function KeyboardFit() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const open = keyboardOpen(window.innerHeight, vv.height);
      const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
      const full = open ? null : fullScreenHeight(standalone, window.innerHeight, screen.height);
      root.style.setProperty("--app-h", open ? `${vv.height}px` : full ? `${full}px` : "");
      if (open) {
        root.setAttribute("data-keyboard", "");
        window.scrollTo(0, 0);
      } else root.removeAttribute("data-keyboard");
      if (full) root.setAttribute("data-fit", "");
      else root.removeAttribute("data-fit");
    };
    update();
    window.addEventListener("orientationchange", update);
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("orientationchange", update);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--app-h");
      root.removeAttribute("data-keyboard");
      root.removeAttribute("data-fit");
    };
  }, []);
  return null;
}
