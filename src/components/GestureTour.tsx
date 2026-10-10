"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";

const CARDS: { icon: IconName; title: string; text: string }[] = [
  { icon: "chevron-right", title: "Swipe between tabs", text: "Swipe left or right anywhere on Today, Progress, Library or Plan to flip between them." },
  { icon: "arrow-up", title: "Drag the numbers", text: "In a workout, drag the weight or reps up and down to change them. Tap the number to type." },
  { icon: "chevron-left", title: "Back from the edge", text: "On guides and reviews, drag from the left edge to go back, like any iPhone app." },
  { icon: "rotate-ccw", title: "Pull to refresh", text: "At the top of any tab, pull down to refresh." },
];

// Shown once, on the first launch of the Home Screen app. Skippable; never shown again.
export function GestureTour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => {
    try {
      if (!window.localStorage.getItem("wt.tourSeen")) setOpen(true);
    } catch {
      /* storage blocked: skip the tour */
    }
  }, []);
  if (!open) return null;
  const close = () => {
    setOpen(false);
    try {
      window.localStorage.setItem("wt.tourSeen", "1");
    } catch {
      /* ignore */
    }
  };
  const c = CARDS[i];
  const last = i === CARDS.length - 1;
  return (
    <>
      <div className="scrim anim-fade" onClick={close} />
      <div className="sheet-wrap">
        <div className="sheet" role="dialog" aria-label="Quick tour" style={{ alignItems: "center", textAlign: "center" }}>
          <span className="sheet-grab" />
          <span className="done-mini" style={{ width: "var(--space-12)", height: "var(--space-12)" }}><Icon name={c.icon} /></span>
          <h2 className="t-title">{c.title}</h2>
          <p className="t-body c-2">{c.text}</p>
          <div className="dots" aria-hidden="true">
            {CARDS.map((_, k) => <i key={k} className={k === i ? "on" : ""} />)}
          </div>
          <div className="grid2" style={{ width: "100%" }}>
            <button type="button" className="btn btn-tertiary" onClick={close}>Skip</button>
            <button type="button" className="btn btn-primary" onClick={() => (last ? close() : setI(i + 1))}>{last ? "Got it" : "Next"}</button>
          </div>
        </div>
      </div>
    </>
  );
}
