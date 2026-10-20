"use client";

import { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { scrubSteps } from "@/lib/scrub";

// The big number between the − and + buttons. Tap it to type (number pad); drag it up or down to scrub it,
// one step per 18 px with a small tick, like turning a dial.
export function NumField({
  value,
  shown,
  label,
  onCommit,
  onScrub,
  decimal = false,
  hero = false,
}: {
  value: number;
  shown?: string;
  label: string;
  onCommit: (v: number) => void;
  /** called once per step while dragging: +1 up, -1 down */
  onScrub?: (dir: 1 | -1) => void;
  decimal?: boolean;
  hero?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const drag = useRef<{ y: number; emitted: number; active: boolean } | null>(null);
  useEffect(() => setText(null), [value]);

  const commit = () => {
    if (text === null) return;
    const n = parseFloat(text.replace(",", "."));
    setText(null);
    if (Number.isFinite(n)) onCommit(n);
  };

  return (
    <input autoComplete="off"
      className={`${hero ? "num-hero" : "num-l"} step-val num-input ${onScrub ? "is-scrubbable" : ""}`}
      aria-label={label}
      inputMode={decimal ? "decimal" : "numeric"}
      enterKeyHint="done"
      value={text ?? shown ?? String(value)}
      onFocus={(e) => {
        setText("");
        e.currentTarget.select();
      }}
      onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 6))}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      onPointerDown={(e) => {
        if (!onScrub || e.pointerType === "mouse") return;
        drag.current = { y: e.clientY, emitted: 0, active: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || !onScrub) return;
        const dy = e.clientY - d.y;
        if (!d.active && Math.abs(dy) < 8) return;
        if (!d.active) {
          d.active = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.blur(); // scrubbing, not typing
        }
        const total = scrubSteps(dy);
        while (d.emitted !== total) {
          const dir = total > d.emitted ? 1 : -1;
          d.emitted += dir;
          onScrub(dir);
          haptic("tap");
        }
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}
