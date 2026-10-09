"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExerciseMedia } from "@/components/ExerciseMedia";
import { Icon } from "@/components/Icon";

export interface LibItem {
  slug: string;
  name: string;
  group: string;
  kit: string;
  muscles: string[];
  setup: string[];
  cues: string[];
  mistakes: string[];
}

const GROUPS = ["All", "Chest", "Back", "Shoulders", "Arms", "Legs", "Core"];
const TABS = ["Setup", "How to do it", "Mistakes"];

export function LibraryView({ items }: { items: LibItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState<LibItem | null>(null);
  const [tab, setTab] = useState(0);
  const rows = items.filter((e) => filter === "All" || e.group === filter);
  const list = open ? [open.setup, open.cues, open.mistakes][tab] : [];

  return (
    <>
      <div className="scroll">
        <div className="col g1">
          <h1 className="t-title">Library</h1>
          <p className="t-body c-2">{items.length} exercises. Tap one for a quick guide.</p>
        </div>
        <div className="chip-row" role="tablist" aria-label="Filter by group">
          {GROUPS.map((g) => (
            <button key={g} type="button" className="chip" role="tab" aria-selected={filter === g} onClick={() => setFilter(g)}>{g}</button>
          ))}
        </div>
        <div className="col g2">
          {rows.map((e) => (
            <button
              key={e.slug}
              type="button"
              className="card"
              style={{ flexDirection: "row", alignItems: "center", gap: "var(--space-3)", textAlign: "left", color: "var(--text)", minHeight: 72, padding: "var(--space-3) var(--space-4)" }}
              aria-label={`Open guide for ${e.name}`}
              onPointerDown={() => router.prefetch(`/library/${e.slug}`)}
              onClick={() => { setOpen(e); setTab(0); }}
            >
              <ExerciseMedia slug={e.slug} name={e.name} thumb />
              <span className="col" style={{ flex: 1, minWidth: 0 }}>
                <strong className="t-heading">{e.name}</strong>
                <span className="t-small c-2">{e.group} · {e.kit}</span>
              </span>
              <span className="c-2"><Icon name="chevron-right" /></span>
            </button>
          ))}
        </div>
        {rows.length === 0 && <div className="empty"><p className="t-body">Nothing here yet.</p></div>}
      </div>

      {open && (
        <>
          <div className="scrim" onClick={() => setOpen(null)} />
          <div className="sheet-wrap">
            <div className="sheet" role="dialog" aria-label="Exercise guide" style={{ maxHeight: 700, overflowY: "auto" }}>
              <span className="sheet-grab" />
              <div className="row between g3 start">
                <h2 className="t-title">{open.name}</h2>
                <button type="button" className="icon-btn" aria-label="Close guide" onClick={() => setOpen(null)}><Icon name="x" /></button>
              </div>
              <ExerciseMedia slug={open.slug} name={open.name} />
              <div className="row g2 wrap">
                {open.muscles.map((m) => <span key={m} className="tag tag-accent">{m}</span>)}
                <span className="tag">{open.kit}</span>
              </div>
              <div className="segmented" role="tablist">
                {TABS.map((t, i) => (
                  <button key={t} type="button" className="seg" role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>{t}</button>
                ))}
              </div>
              <ol className="col g2" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {list.map((text, i) => (
                  <li key={text} className="row g3 start">
                    <span className="round round-subtle" style={{ width: 32, height: 32, flex: "none", font: "800 .875rem var(--font-display)" }}>{i + 1}</span>
                    <span className="t-body">{text}</span>
                  </li>
                ))}
              </ol>
              <div className="banner banner-warning"><Icon name="triangle-alert" /><span>Sharp or joint pain? Stop and tell someone.</span></div>
              <Link className="btn btn-secondary btn-block" prefetch href={`/library/${open.slug}`}>Open full guide and progress</Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
