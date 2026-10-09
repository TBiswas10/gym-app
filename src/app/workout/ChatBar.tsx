"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { confirmCopy, errorCopy, keepAsKilos, parseQuickLog, type Entry, type ParseContext, type ParseError } from "@/lib/parser";

type Mode = "idle" | "confirm" | "error";

/** "30kg 12 12" -> "30 kg · 12, 12" (timed fills like "30 sec 30 sec" stay as they are). */
const fillLabel = (fill: string): string => {
  const m = fill.match(/^([\d.]+)kg (\d+) (\d+)$/);
  return m ? `${m[1]} kg · ${m[2]}, ${m[3]}` : fill;
};

interface Props {
  ctx: ParseContext;
  placeholder: string;
  plannedFor: (slug: string) => number;
  onSave: (entry: Entry) => void;
  onEdit: (entry: Entry) => void;
  onModeChange?: (mode: Mode) => void;
  /** One-tap text for "same as last time", e.g. "lat pulldown 35kg 10 10". */
  suggestion?: string | null;
  /** The primary button, shown above the input while nothing else is open. */
  children?: React.ReactNode;
}

/** Quick log: type a set, read it back, and only then save. Never saves a guess. */
export function ChatBar({ ctx, placeholder, plannedFor, onSave, onEdit, onModeChange, suggestion, children }: Props) {
  const [text, setText] = useState("");
  const [mode, setModeState] = useState<Mode>("idle");
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState<ParseError | null>(null);

  const setMode = (m: Mode) => {
    setModeState(m);
    onModeChange?.(m);
  };

  const run = (value: string) => {
    const r = parseQuickLog(value, ctx);
    if (r.ok) {
      setEntry(r.entry);
      setError(null);
      setMode("confirm");
    } else {
      setEntry(null);
      setError(r.error);
      setMode("error");
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) run(text);
  };

  const reset = () => {
    setText("");
    setEntry(null);
    setError(null);
    setMode("idle");
  };

  const card = entry ? confirmCopy(entry, plannedFor(entry.slug)) : null;
  const copy = error ? errorCopy(error, ctx) : null;
  const nameOf = (slug: string) => ctx.catalog.find((c) => c.slug === slug)?.name ?? slug;

  return (
    <footer className="bottom-bar">
      {mode === "confirm" && entry && card && (
        <div className="card anim-in" style={{ borderColor: "var(--accent)" }}>
          <p className="t-body bold">{card.text}</p>
          <div className="grid2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (card.mode === "pounds") setEntry(keepAsKilos(entry));
                else {
                  onEdit(entry);
                  reset();
                }
              }}
            >
              {card.altLabel}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onSave(entry);
                reset();
              }}
            >
              {card.goLabel}
            </button>
          </div>
        </div>
      )}

      {mode === "error" && copy && error && (
        <div className="card card-warning anim-in" role="alert">
          <strong className="c-warning row g2">
            <Icon name="circle-alert" size={16} />
            {copy.title}
          </strong>
          <p className="t-small">{copy.body}</p>
          {(copy.chips || copy.fills) && (
            <div className="row g2 wrap">
              {copy.chips?.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  className="chip"
                  onClick={() => {
                    const tail = error.code === "unknown" || error.code === "ambiguous" ? error.tail : "";
                    const next = `${nameOf(slug).toLowerCase()} ${tail}`.trim();
                    setText(next);
                    run(next);
                  }}
                >
                  {nameOf(slug)}
                </button>
              ))}
              {copy.fills?.map((fill) => (
                <button
                  key={fill}
                  type="button"
                  className="chip"
                  onClick={() => {
                    const slug = "slug" in error ? error.slug : null;
                    const next = `${slug ? nameOf(slug).toLowerCase() : ""} ${fill}`.trim();
                    setText(next);
                    run(next);
                  }}
                >
                  {fillLabel(fill)}
                </button>
              ))}
            </div>
          )}
          <div className="grid2">
            <button type="button" className="btn btn-secondary" onClick={reset}>Use steppers</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setText("lat pulldown 35kg 10 10"); setMode("idle"); }}>Try example</button>
          </div>
        </div>
      )}

      {mode === "idle" && children}

      {mode === "idle" && !text && suggestion && (
        <div className="chip-row-tight">
          <button type="button" className="chip" onClick={() => setText(suggestion)}>Same as last: {suggestion}</button>
        </div>
      )}

      <form className="chat-bar" onSubmit={submit} style={{ margin: 0 }}>
        <label className="sr" htmlFor="quicklog">Quick log</label>
        <input
          className="input"
          id="quicklog"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (mode === "error") setMode("idle");
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="none"
          enterKeyHint="send"
        />
        <button className="send-btn" type="submit" aria-label="Log it" disabled={!text.trim()}>
          <Icon name="arrow-up" />
        </button>
      </form>
    </footer>
  );
}
