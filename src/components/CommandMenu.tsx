"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";

interface Cmd { label: string; href: string; key?: string; words: string }

// Pages and the one action worth a keyboard route. The digit keys jump between tabs.
const COMMANDS: Cmd[] = [
  { label: "Today", href: "/", key: "1", words: "home dashboard" },
  { label: "Progress", href: "/progress", key: "2", words: "charts strength lifts body map" },
  { label: "Library", href: "/library", key: "3", words: "exercises guides" },
  { label: "Plan", href: "/plan", key: "4", words: "settings program" },
  { label: "Start or resume workout", href: "/workout", words: "train session go" },
  { label: "History", href: "/progress/history", words: "past sessions" },
  { label: "Plan changes", href: "/plan/changes", words: "log undo" },
  { label: "Share your week", href: "/plan/share", words: "link" },
];

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
const apple = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Ctrl/⌘ + K opens a search of every page; the digit keys 1 to 4 jump between the tabs. Keyboard-only, so phones never see it. */
export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const [mod, setMod] = useState("Ctrl");
  const input = useRef<HTMLInputElement>(null);
  const list = useId();

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? COMMANDS.filter((c) => `${c.label} ${c.words}`.toLowerCase().includes(t)) : COMMANDS;
  }, [q]);
  const go = (c: Cmd) => {
    setOpen(false);
    router.push(c.href);
  };

  useEffect(() => setMod(apple() ? "⌘" : "Ctrl"), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQ("");
        setAt(0);
        return;
      }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey || open) return;
      const c = COMMANDS.find((x) => x.key === e.key);
      if (c) router.push(c.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, router]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  return (
    <>
      <button type="button" className="cmdk-open" onClick={() => { setOpen(true); setQ(""); setAt(0); }} aria-label="Search pages">
        <Icon name="search" size={16} />
        <span>Search</span>
        <kbd className="kbd">{mod} K</kbd>
      </button>
      {open && (
        <>
          <div className="scrim anim-fade" onClick={() => setOpen(false)} />
          <div className="cmdk anim-in" role="dialog" aria-modal="true" aria-label="Search pages">
            <input
              ref={input}
              className="input"
              role="combobox"
              aria-expanded="true"
              aria-controls={list}
              aria-activedescendant={shown[at] ? `${list}-${at}` : undefined}
              autoComplete="off"
              placeholder="Go to…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setAt(0); }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  if (shown.length) setAt((i) => (i + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length);
                } else if (e.key === "Enter" && shown[at]) go(shown[at]);
              }}
            />
            <div id={list} role="listbox" aria-label="Pages" className="col g1">
              {shown.map((c, i) => (
                <button key={c.href} id={`${list}-${i}`} type="button" role="option" aria-selected={i === at} className="cmdk-row" onMouseMove={() => setAt(i)} onClick={() => go(c)}>
                  <span>{c.label}</span>
                  {c.key && <kbd className="kbd">{c.key}</kbd>}
                </button>
              ))}
              {shown.length === 0 && <p className="t-small c-2" role="status">Nothing matches that.</p>}
            </div>
            <p className="t-small c-2">↑ ↓ to move, Enter to open, Esc to close</p>
          </div>
        </>
      )}
    </>
  );
}
