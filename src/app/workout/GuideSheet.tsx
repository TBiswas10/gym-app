"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { Guide } from "@/lib/server/workout-data";

const TABS = ["Setup", "Form cues", "Mistakes"] as const;

/** Bottom sheet with a quick form guide for the exercise on screen. */
export function GuideSheet({ guide, slug, onClose: done }: { guide: Guide; slug: string; onClose: () => void }) {
  const [tab, setTab] = useState(0);
  // Leave the way it arrived: play the exit, then unmount (a second tap while leaving is ignored).
  const [leaving, setLeaving] = useState(false);
  const onClose = () => setLeaving(true);
  const items = [guide.setup, guide.cues, guide.mistakes][tab];
  return (
    <>
      <div className={`scrim ${leaving ? "anim-out" : "anim-fade"}`} onClick={onClose} />
      <div className={`sheet-wrap ${leaving ? "anim-out" : ""}`} onAnimationEnd={() => leaving && done()}>
        <div className="sheet" role="dialog" aria-label="Form guide" style={{ maxHeight: 640, overflowY: "auto" }}>
          <span className="sheet-grab" />
          <div className="row between g3 start">
            <h2 className="t-title">{guide.name}</h2>
            <button type="button" className="icon-btn" aria-label="Close guide" onClick={onClose}>
              <Icon name="x" />
            </button>
          </div>
          <div className="row g2 wrap">
            {guide.muscles.map((m, i) => (
              <span key={m} className={`tag ${i === 0 ? "tag-accent" : ""}`}>{m}</span>
            ))}
          </div>
          <div className="segmented" role="tablist">
            {TABS.map((t, i) => (
              <button key={t} type="button" className="seg" role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>
                {t}
              </button>
            ))}
          </div>
          <ol className="col g2" style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {items.map((text, i) => (
              <li key={text} className="row g3 start">
                <span className="round round-subtle" style={{ width: 32, height: 32, font: "800 .875rem var(--font-display)" }}>{i + 1}</span>
                <span className="t-body" style={{ paddingTop: 2 }}>{text}</span>
              </li>
            ))}
          </ol>
          <div className="banner banner-warning">
            <Icon name="triangle-alert" />
            <span>Sharp or joint pain? Stop and tell someone.</span>
          </div>
          <Link className="btn btn-secondary btn-block" href={`/library/${slug}`}>Open full guide</Link>
        </div>
      </div>
    </>
  );
}
