"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import type { ChangeRow } from "@/lib/server/change-log";
import { undoChangeAction } from "../actions";

const WHEN = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function ChangesView({ rows }: { rows: ChangeRow[] }) {
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const undo = (id: string) => {
    setProblem(null);
    setBusy(id);
    start(async () => {
      const r = await undoChangeAction(id);
      if (!r.ok) setProblem(r.error);
      setBusy(null);
    });
  };

  return (
    <div className="scroll">
      <div className="topbar">
        <Link className="btn btn-tertiary" href="/plan" style={{ paddingLeft: "var(--space-2)" }}>Plan</Link>
      </div>
      <div className="col g1">
        <h1 className="t-title">Change log</h1>
        <p className="t-body c-2">Edits to your plan and settings, and anything Claude changed or deleted. Undo puts the old version back.</p>
      </div>

      {problem && (
        <div className="banner banner-danger" role="alert"><Icon name="circle-alert" /><span>{problem}</span></div>
      )}

      {rows.length === 0 ? (
        <div className="empty">
          <p className="t-body">Nothing has changed yet.</p>
        </div>
      ) : (
        <ol className="col g2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((r) => (
            <li key={r.id} className="card" style={{ gap: "var(--space-2)" }}>
              <div className="row between baseline">
                <span className={`tag ${r.source === "claude" ? "tag-accent" : ""}`}>{r.source === "claude" ? "Claude" : "You, in the app"}</span>
                <span className="t-small c-2">{WHEN.format(new Date(r.created_at))}</span>
              </div>
              <p className="t-body" style={{ fontWeight: 600 }}>{r.summary}</p>
              {r.undone_at ? (
                <span className="t-small c-2">Undone</span>
              ) : r.undoable ? (
                <button type="button" className={`btn btn-secondary ${busy === r.id ? "is-loading" : ""}`} disabled={pending} onClick={() => undo(r.id)}>
                  <Icon name="undo" />Undo this
                </button>
              ) : (
                <span className="t-small c-2">Can’t be undone automatically</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
