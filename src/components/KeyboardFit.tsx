"use client";

import { useEffect } from "react";
import { keyboardOpen } from "@/lib/keyboard";

// iPhone keeps the page the same size when the keyboard opens and covers its bottom. This shrinks the screen to
// the visible area so the bottom bar and the field you're typing in stay above the keyboard, and drops the extra
// home-indicator padding while the keyboard is up (it would be applied twice otherwise).
//
// Safari does not always tell us when the keyboard goes away (backgrounding with it open, a field that disappears,
// a rotation). A stuck "keyboard is open" layout hides the bottom bar, so the rule is: that layout is only ever
// valid while a text field is actually focused, and it is re-checked on every event that could end it.
const FIELD = "input, textarea, select, [contenteditable='true']";
const isFieldFocused = () => {
  const a = document.activeElement;
  return !!a && a !== document.body && a.matches(FIELD);
};

export function KeyboardFit() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    let timer: number | null = null;

    const close = () => {
      const was = root.hasAttribute("data-keyboard");
      root.style.removeProperty("--app-h");
      root.removeAttribute("data-keyboard");
      // The page may still be panned up by the keyboard: put it back.
      if (was || (vv && vv.offsetTop !== 0) || window.scrollY !== 0) window.scrollTo(0, 0);
    };
    const update = () => {
      if (!vv) return;
      const open = isFieldFocused() && keyboardOpen(window.innerHeight, vv.height);
      if (open) {
        root.style.setProperty("--app-h", `${vv.height}px`);
        root.setAttribute("data-keyboard", "");
        window.scrollTo(0, 0);
      } else close();
    };
    // After the keyboard animation, once more: some devices send no event at the end of it.
    const settle = () => {
      update();
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(update, 350);
    };

    const onFocusOut = () => window.setTimeout(settle, 60);
    const onShow = () => {
      if (document.visibilityState === "visible") settle();
    };
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    document.addEventListener("focusin", settle);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pageshow", settle);
    window.addEventListener("orientationchange", settle);
    window.addEventListener("resize", settle);
    // A safety net: while the layout says "keyboard", make sure that is still true.
    const guard = window.setInterval(() => {
      if (root.hasAttribute("data-keyboard") && !isFieldFocused()) close();
    }, 800);
    close(); // start clean

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      document.removeEventListener("focusin", settle);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pageshow", settle);
      window.removeEventListener("orientationchange", settle);
      window.removeEventListener("resize", settle);
      window.clearInterval(guard);
      if (timer !== null) window.clearTimeout(timer);
      close();
    };
  }, []);
  return null;
}
