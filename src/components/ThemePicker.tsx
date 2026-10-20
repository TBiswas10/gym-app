"use client";

import { useEffect, useState } from "react";
import { applyTheme, savedTheme, THEMES, type ThemeId } from "@/lib/themes";

/** Five colour themes. Each swatch previews its own palette by carrying data-theme itself. */
export function ThemePicker() {
  const [active, setActive] = useState<ThemeId>("lime");
  useEffect(() => setActive(savedTheme()), []);
  const pick = (id: ThemeId) => {
    setActive(id);
    applyTheme(id);
  };
  return (
    <div className="col g2" role="radiogroup" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={active === t.id} className="theme-row" onClick={() => pick(t.id)}>
          <span className="theme-swatch" data-theme={t.id === "lime" ? undefined : t.id} aria-hidden="true">
            <i />
          </span>
          <span className="col" style={{ flex: 1, minWidth: 0 }}>
            <strong className="t-body">{t.name}</strong>
            <span className="t-small c-2">{t.note}</span>
          </span>
          <span className="theme-check" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
