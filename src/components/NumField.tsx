"use client";

import { useEffect, useState } from "react";

// The big number between the − and + buttons, tappable: opens the number pad so you can type 37.5 directly.
export function NumField({ value, shown, label, onCommit, decimal = false }: { value: number; shown?: string; label: string; onCommit: (v: number) => void; decimal?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => setText(null), [value]);
  const commit = () => {
    if (text === null) return;
    const n = parseFloat(text.replace(",", "."));
    setText(null);
    if (Number.isFinite(n)) onCommit(n);
  };
  return (
    <input
      className="num-l step-val num-input"
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
    />
  );
}
