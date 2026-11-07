import { flushSync } from "react-dom";

/** Run a state change inside a short cross-fade where the browser supports view transitions; otherwise just run it. */
export function withTransition(update: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}
