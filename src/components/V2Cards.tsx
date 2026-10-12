"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import type { Briefing } from "@/lib/briefing";
import type { Nudge } from "@/lib/nudges";
import type { GoalView, ReviewView } from "@/lib/server/v2-data";
import { answerNudge, removeGoal, saveGoal } from "@/app/(app)/v2-actions";

/** Today: what this session asks of you, in a few plain lines. */
export function BriefingCard({ briefing }: { briefing: Briefing }) {
  return (
    <section className="card card-accent anim-in" aria-label="Today’s briefing">
      <span className="t-eyebrow c-accent">Today’s briefing</span>
      <div className="col g1">
        <h2 className="t-heading">{briefing.headline}</h2>
        <p className="t-small c-2">{briefing.sub}</p>
      </div>
      {briefing.tries.length > 0 && (
        <ul className="brief-list">
          {briefing.tries.map((t) => (
            <li key={t}><Icon name="arrow-up" size={16} /><span className="t-body">{t}</span></li>
          ))}
        </ul>
      )}
      {briefing.notes.map((n) => (
        <p key={n} className="t-small c-2">{n}</p>
      ))}
    </section>
  );
}

/** The same briefing, inside the day's card: only what the card does not already say (what to try, and the notes). */
export function BriefingInline({ briefing }: { briefing: Briefing }) {
  if (briefing.tries.length === 0 && briefing.notes.length === 0) return null;
  return (
    <div className="col g2 brief-inline" aria-label="For today">
      <span className="t-eyebrow c-accent">For today</span>
      {briefing.tries.length > 0 && (
        <ul className="brief-list">
          {briefing.tries.map((t) => (
            <li key={t}><Icon name="arrow-up" size={16} /><span className="t-body">{t}</span></li>
          ))}
        </ul>
      )}
      {briefing.notes.map((n) => (
        <p key={n} className="t-small c-2">{n}</p>
      ))}
    </div>
  );
}

/** Suggestions one at a time, so Today never stacks them. */
export function NudgeStack({ nudges }: { nudges: Nudge[] }) {
  const [done, setDone] = useState<string[]>([]);
  const left = nudges.filter((n) => !done.includes(n.key));
  if (left.length === 0) return null;
  const n = left[0];
  return <NudgeCard key={n.key} nudge={n} position={nudges.length > 1 ? `${done.length + 1} of ${nudges.length}` : undefined} onDone={() => setDone((d) => [...d, n.key])} />;
}

/** A suggestion about your plan. Nothing changes unless you accept it. */
export function NudgeCard({ nudge, position, onDone }: { nudge: Nudge; position?: string; onDone?: () => void }) {
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (gone) return null;
  const answer = (accept: boolean) =>
    start(async () => {
      const r = await answerNudge(nudge.key, nudge.kind, nudge.payload, accept);
      if (r.ok) {
        setGone(true);
        onDone?.();
      } else setError(r.error);
    });
  return (
    <section className="card card-warning anim-in" aria-label="Suggestion">
      <div className="row between">
        <span className="t-eyebrow c-warning row g2"><Icon name="info" size={16} />Suggestion</span>
        {position && <span className="t-small c-2">{position}</span>}
      </div>
      <div className="col g1">
        <h2 className="t-heading">{nudge.title}</h2>
        <p className="t-small c-2">{nudge.body}</p>
      </div>
      {error && <p className="t-small c-warning" role="alert">{error}</p>}
      <div className="grid2">
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => answer(false)}>Not now</button>
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => answer(true)}>{nudge.accept}</button>
      </div>
    </section>
  );
}

/** Today: a pointer to this week's review from Claude. */
export function ReviewTeaser({ review }: { review: ReviewView }) {
  return (
    <Link href="/progress" className="row-link" style={{ textDecoration: "none", color: "var(--text)" }}>
      <span className="round round-accent"><Icon name="chart" /></span>
      <span className="col" style={{ flex: 1, minWidth: 0 }}>
        <strong>Your weekly review</strong>
        <span className="t-small c-2" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{review.headline}</span>
      </span>
      <span className="c-accent"><Icon name="chevron-right" /></span>
    </Link>
  );
}

/** Progress: the weekly review written by Claude, with the earlier ones under it. */
export function ReviewCard({ reviews }: { reviews: ReviewView[] }) {
  const [more, setMore] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!reviews.length) {
    const ask = "Write my weekly review";
    return (
      <section className="card card-dashed" aria-label="Weekly review">
        <h2 className="t-heading">Weekly review</h2>
        <p className="t-small c-2">Claude can read your week and write a short review that shows up here. In Claude, say:</p>
        <p className="t-body" style={{ fontWeight: 700 }}>“{ask}”</p>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(ask);
              setCopied(true);
            } catch {
              /* the phrase is on screen to type */
            }
          }}
        >
          {copied ? "Copied" : "Copy that to ask Claude"}
        </button>
      </section>
    );
  }
  const [latest, ...older] = reviews;
  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <div className="col g1">
        <span className="t-caption c-2">{title}</span>
        <ul className="brief-list">
          {items.map((t) => (
            <li key={t}><span className="t-body">{t}</span></li>
          ))}
        </ul>
      </div>
    );
  return (
    <section className="card" aria-label="Weekly review">
      <div className="row between baseline">
        <h2 className="t-heading">Weekly review</h2>
        <span className="t-small c-2">Week of {latest.weekStart}</span>
      </div>
      <p className="t-body" style={{ fontWeight: 700 }}>{latest.headline}</p>
      {list("WINS", latest.wins)}
      {list("WATCH", latest.watch)}
      {list("NEXT WEEK", latest.nextWeek)}
      {older.length > 0 && (
        <>
          <button type="button" className="btn btn-tertiary" onClick={() => setMore((v) => !v)}>{more ? "Hide earlier reviews" : `Earlier reviews (${older.length})`}</button>
          {more && (
            <div className="col g3">
              {older.map((r) => (
                <div key={r.id} className="col g1">
                  <span className="t-caption c-2">WEEK OF {r.weekStart}</span>
                  <p className="t-body">{r.headline}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Progress: targets you set, with how far you have come. */
export function GoalsCard({ goals, choices }: { goals: GoalView[]; choices: { slug: string; name: string; unit: string }[] }) {
  const [adding, setAdding] = useState(false);
  const [slug, setSlug] = useState(choices[0]?.slug ?? "");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const unit = choices.find((c) => c.slug === slug)?.unit ?? "kg";
  const free = choices.filter((c) => !goals.some((g) => g.slug === c.slug));

  const save = () =>
    start(async () => {
      const r = await saveGoal(slug, Number(target));
      if (r.ok) {
        setAdding(false);
        setTarget("");
        setError(null);
      } else setError(r.error);
    });

  return (
    <section className="card" aria-label="Goals">
      <div className="row between baseline">
        <h2 className="t-heading">Goals</h2>
        {!adding && free.length > 0 && goals.length > 0 && (
          <button type="button" className="btn btn-tertiary" onClick={() => { setSlug(free[0].slug); setAdding(true); }}>Add a goal</button>
        )}
      </div>
      {goals.length === 0 && !adding && (
        <>
          <p className="t-small c-2">{free.length > 0 ? "Pick a lift and a number to chase. The bar fills as you get closer." : "Finish a workout first, then you can set a goal for any lift you have logged."}</p>
          {free.length > 0 && <button type="button" className="btn btn-secondary btn-block" onClick={() => { setSlug(free[0].slug); setAdding(true); }}>Add your first goal</button>}
        </>
      )}
      <div className="col g3">
        {goals.map((g) => (
          <div key={g.id} className="col g1">
            <div className="row between baseline g3">
              <strong className="t-body">{g.name}</strong>
              <span className={`t-small ${g.reached ? "c-accent" : "c-2"}`} style={{ fontWeight: 700 }}>
                {g.reached ? "Reached" : `${g.current} of ${g.target} ${g.unit}`}
              </span>
            </div>
            <div className="bar" role="img" aria-label={`${g.name}: ${g.current} of ${g.target} ${g.unit}`}>
              <i style={{ transform: `scaleX(${g.fraction})` }} />
            </div>
            <div className="row between t-small c-2">
              <span>{g.reached ? "Nice work." : `${g.toGo} ${g.unit} to go`}</span>
              <button type="button" className="goal-x" aria-label={`Remove the ${g.name} goal`} disabled={pending} onClick={() => start(async () => { await removeGoal(g.id); })}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      {adding && (
        <div className="col g2">
          <label className="field-label" htmlFor="goal-ex">Exercise</label>
          <select id="goal-ex" className="input" value={slug} onChange={(e) => setSlug(e.target.value)}>
            {free.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <label className="field-label" htmlFor="goal-target">Target ({unit})</label>
          <input id="goal-target" className="input" type="number" inputMode="decimal" min="1" step="0.5" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 100" />
          {error && <p className="t-small c-warning" role="alert">{error}</p>}
          <div className="grid2">
            <button type="button" className="btn btn-secondary" onClick={() => { setAdding(false); setError(null); }}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={pending || !target} onClick={save}>Save goal</button>
          </div>
        </div>
      )}
    </section>
  );
}
