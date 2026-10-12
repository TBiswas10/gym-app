"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { createShareLink, revokeShareLink } from "../../v2-actions";

interface LinkRow {
  id: string;
  token: string;
  label: string;
  expiresAt: string;
  live: boolean;
}

const DAY = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short" });

export function ShareView({ links }: { links: LinkRow[] }) {
  const [label, setLabel] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const live = links.filter((l) => l.live);

  const urlFor = (t: string) => `${window.location.origin}/share/${t}`;
  const copy = async (l: LinkRow) => {
    const url = urlFor(l.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(l.id);
    } catch {
      window.prompt?.("Copy this link", url);
    }
  };
  const nativeShare = async (l: LinkRow) => {
    const url = urlFor(l.token);
    try {
      if (navigator.share) await navigator.share({ title: "My week", url });
      else await copy(l);
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="scroll">
      <div className="topbar">
        <Link className="btn btn-tertiary" href="/plan" style={{ paddingLeft: "var(--space-2)" }}>Plan</Link>
      </div>
      <div className="col g1">
        <h1 className="t-title">Share your week</h1>
        <p className="t-body c-2">A link anyone can open, no account needed. It shows this week’s sessions, sets and cardio minutes. No weights, notes, soreness or bodyweight. It stops working after 7 days, or when you turn it off.</p>
      </div>

      {problem && <div className="banner banner-danger" role="alert"><Icon name="circle-alert" /><span>{problem}</span></div>}

      <section className="card">
        <label className="field-label" htmlFor="share-label">Name on the page (optional)</label>
        <input id="share-label" className="input" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Tito’s week" />
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await createShareLink(label);
              setProblem(r.ok ? null : r.error);
              if (r.ok) setLabel("");
            })
          }
        >
          Create a 7-day link
        </button>
      </section>

      <section className="col g3" aria-label="Active links">
        <h2 className="t-heading">Active links</h2>
        {live.length === 0 && <p className="t-small c-2">No links yet.</p>}
        {live.map((l) => (
          <div key={l.id} className="card">
            <div className="col g1">
              <strong className="t-body">{l.label || "My week"}</strong>
              <span className="t-small c-2">Works until {DAY.format(new Date(l.expiresAt))}</span>
            </div>
            <div className="grid2">
              <button type="button" className="btn btn-secondary" onClick={() => copy(l)}>{copied === l.id ? "Copied" : "Copy link"}</button>
              <button type="button" className="btn btn-secondary" onClick={() => nativeShare(l)}>Share</button>
            </div>
            <button
              type="button"
              className="btn btn-tertiary btn-block"
              disabled={pending}
              onClick={() => start(async () => { const r = await revokeShareLink(l.id); setProblem(r.ok ? null : r.error); })}
            >
              Turn this link off
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
