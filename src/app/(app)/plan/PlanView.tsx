"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { logOut } from "@/lib/auth-actions";
import { shortDay } from "@/lib/dates";
import { estimateMinutes } from "@/lib/plan";
import { add, estimateNote, move, rangeLabel, rangesFor, removeAt, setRange, setSets, type Row } from "@/lib/plan-edit";
import type { PlanData } from "@/lib/server/plan-data";
import { disableRestAlerts, enableRestAlerts, PUSH_MESSAGE } from "@/lib/push-client";
import { deleteAccount, saveSettings, savePlanDay, switchPlan, type Result } from "./actions";

export function PlanView({ data, deleteProblem }: { data: PlanData; deleteProblem: boolean }) {
  const [days, setDays] = useState(data.days);
  const [dayIdx, setDayIdx] = useState(0);
  const [open, setOpen] = useState(0);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [restAlerts, setRestAlerts] = useState(data.restAlerts);
  const [bodyweight, setBodyweight] = useState(data.trackBodyweight);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const is5 = data.planType === "5day";
  const day = days[Math.min(dayIdx, days.length - 1)];
  const rows: Row[] = day.exercises;
  const minutes = estimateMinutes(rows.map((r) => r.kind), day.cardioMinutes);
  const note = estimateNote(minutes);

  const run = (fn: () => Promise<Result>, undo?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) setError(null);
      else {
        setError(r.error);
        undo?.();
      }
    });

  /** Show the change now, save the whole day, and put it back if saving fails. */
  const commit = (next: Row[]) => {
    const before = days;
    setDays(days.map((d, i) => (i === dayIdx ? { ...d, exercises: next } : d)));
    run(() => savePlanDay(data.templateId, day.weekday, next.map((r) => ({ slug: r.slug, sets: r.sets, repLo: r.repLo, repHi: r.repHi }))), () => setDays(before));
  };

  const pickPlan = (p: "5day" | "3day") => {
    if (p === data.planType) return;
    run(() => switchPlan(p));
  };

  const [alertNote, setAlertNote] = useState<{ ok: boolean; text: string } | null>(null);

  /** Turning alerts on asks permission (this is the tap) and subscribes this phone. */
  const toggleAlerts = (value: boolean) => {
    setAlertNote(null);
    if (!value) {
      setRestAlerts(false);
      run(() => saveSettings({ restAlerts: false }), () => setRestAlerts(true));
      void disableRestAlerts();
      return;
    }
    startTransition(async () => {
      const status = await enableRestAlerts();
      if (status !== "on") {
        setAlertNote({ ok: false, text: PUSH_MESSAGE[status] });
        return;
      }
      setRestAlerts(true);
      const r = await saveSettings({ restAlerts: true });
      if (!r.ok) {
        setRestAlerts(false);
        setError(r.error);
      }
    });
  };

  const sendTest = () =>
    startTransition(async () => {
      try {
        const res = await fetch("/api/push/test", { method: "POST" });
        const j = (await res.json()) as { sent: number; reason: string; status?: number | null; removed?: number };
        setAlertNote(j.sent ? { ok: true, text: "Sent. It should appear in a few seconds." } : { ok: false, text: j.reason === "rejected" ? (j.removed ? "Your phone’s alert link had expired, so I cleared it. Turn the toggle off and on again, then press Send test." : `Apple’s alert service refused the message (code ${j.status ?? "?"}). Turn the toggle off and on again; if it still fails, tell me the code.`) : j.reason === "no-device" ? "No phone is set up for alerts yet. Turn the toggle off and on again." : j.reason === "not-configured" ? "Alerts aren’t set up on the server yet." : "Couldn’t send a test. Try again in a moment." });
      } catch {
        setAlertNote({ ok: false, text: "Couldn’t reach the server. Check your connection." });
      }
    });

  const toggle = (key: "restAlerts" | "trackBodyweight", value: boolean) => {
    const [set, prev] = key === "restAlerts" ? [setRestAlerts, restAlerts] : [setBodyweight, bodyweight];
    set(value);
    run(() => saveSettings({ [key]: value }), () => set(prev));
  };

  const available = data.library.filter((l) => !rows.some((r) => r.slug === l.slug));

  return (
    <>
      <div className="scroll">
        <h1 className="t-title">Plan</h1>
        <div className="segmented" role="radiogroup" aria-label="Programme">
          <button type="button" className="seg" role="radio" aria-checked={is5} aria-selected={is5} onClick={() => pickPlan("5day")}>5-day split</button>
          <button type="button" className="seg" role="radio" aria-checked={!is5} aria-selected={!is5} onClick={() => pickPlan("3day")}>3-day full body</button>
        </div>
        <p className="t-small c-2" style={{ marginTop: "calc(var(--space-2) * -1)" }}>
          {is5 ? "Mon to Thu and Sat. Fri and Sun are rest days." : "Mon, Wed and Sat. Everything else is rest."}
        </p>

        {error && <div className="banner banner-danger" role="alert"><Icon name="circle-alert" /><span>{error}</span></div>}
        {deleteProblem && <div className="banner banner-danger" role="alert"><Icon name="circle-alert" /><span>Couldn’t delete your account. Check your connection and try again.</span></div>}

        <div className="dayrow" style={{ gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))` }}>
          {days.map((d, i) => (
            <button key={d.weekday} type="button" className="chip chip-day" aria-pressed={i === dayIdx} onClick={() => { setDayIdx(i); setOpen(-1); }}>
              <span className="t-caption" style={{ letterSpacing: ".04em" }}>{shortDay(d.weekday)}</span>
              <strong className="t-body">{d.shortName}</strong>
            </button>
          ))}
        </div>

        <section className="col g3">
          <div className="row between">
            <h2 className="t-heading">{day.fullName} · {rows.length} exercises</h2>
            <span className="t-small c-2">Tap to edit</span>
          </div>
          <div className={`banner ${note.over ? "banner-danger" : "banner-info"}`}><span>{note.text}</span></div>

          {rows.map((r, i) => {
            const isOpen = open === i;
            return (
              <div key={r.slug} className="card" style={{ padding: 0, gap: 0, ...(isOpen ? { borderColor: "var(--border-strong)" } : {}) }}>
                <button type="button" className="list-row" style={{ padding: "var(--space-2) var(--space-4)", background: "transparent", border: 0, color: "var(--text)", textAlign: "left", width: "100%", borderTop: 0 }} onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen}>
                  <span className="round round-subtle" style={{ width: 32, height: 32, font: "800 .875rem var(--font-display)" }}>{i + 1}</span>
                  <span className="col" style={{ flex: 1, minWidth: 0 }}>
                    <strong className="t-body" style={{ fontWeight: 700 }}>{r.name}</strong>
                    <span className="t-small c-2">{r.sets} {r.sets === 1 ? "set" : "sets"} × {rangeLabel(r.repLo, r.repHi, r.kind)}{r.kind === "timed" ? "" : " reps"}</span>
                  </span>
                  <span className="c-2" style={{ transform: isOpen ? "rotate(180deg)" : "none" }}><Icon name="chevron-right" /></span>
                </button>
                {isOpen && (
                  <div className="col g4 anim-in" style={{ padding: "0 var(--space-4) var(--space-4)" }}>
                    <div className="row between">
                      <span className="t-body" style={{ fontWeight: 700 }}>Sets</span>
                      <div className="row g3">
                        <button type="button" className="step-btn" style={{ width: 48, height: 48 }} aria-label="Fewer sets" disabled={r.sets <= 1} onClick={() => commit(setSets(rows, i, r.sets - 1))}><Icon name="minus" /></button>
                        <span className="num-m" style={{ minWidth: 32, textAlign: "center" }}>{r.sets}</span>
                        <button type="button" className="step-btn" style={{ width: 48, height: 48 }} aria-label="More sets" disabled={r.sets >= 2} onClick={() => commit(setSets(rows, i, r.sets + 1))}><Icon name="plus" /></button>
                      </div>
                    </div>
                    <div className="col g2">
                      <span className="t-body" style={{ fontWeight: 700 }}>{r.kind === "timed" ? "Hold time" : "Rep range"}</span>
                      <div className="row g2 wrap">
                        {rangesFor(r.kind).map(([lo, hi]) => (
                          <button key={lo} type="button" className="chip" aria-pressed={r.repLo === lo && r.repHi === hi} onClick={() => commit(setRange(rows, i, lo, hi))}>{rangeLabel(lo, hi, r.kind)}</button>
                        ))}
                      </div>
                    </div>
                    <div className="row g2">
                      <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: "0 var(--space-2)" }} disabled={i === 0} aria-label="Move up" onClick={() => { commit(move(rows, i, -1)); setOpen(i - 1); }}>Up</button>
                      <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: "0 var(--space-2)" }} disabled={i === rows.length - 1} aria-label="Move down" onClick={() => { commit(move(rows, i, 1)); setOpen(i + 1); }}>Down</button>
                      <button type="button" className="btn btn-tertiary" style={{ flex: 1, padding: "0 var(--space-2)", color: "var(--danger)" }} onClick={() => { commit(removeAt(rows, i)); setOpen(-1); }}>Remove</button>
                    </div>
                    <Link className="link" href={`/library/${r.slug}`}>Weight jump and form guide <Icon name="chevron-right" size={20} /></Link>
                  </div>
                )}
              </div>
            );
          })}

          <div className="card" style={{ flexDirection: "row", alignItems: "center", padding: "var(--space-3) var(--space-4)" }}>
            <span className="round round-subtle"><Icon name="timer" /></span>
            <span className="col"><strong className="t-body">Cardio · {day.cardioName}</strong><span className="t-small c-2">{day.cardioLabel} · talk-test pace</span></span>
          </div>
          <p className="t-small c-2">Every session starts with cardio, which is your warm-up, and can end with an optional 2 to 3 min cool-down.</p>
          <button type="button" className="btn btn-secondary btn-block" disabled={rows.length >= 8 || available.length === 0} onClick={() => setAdding(true)}>Add exercise</button>
        </section>

        <section className="card" style={{ gap: 0, padding: "var(--space-1) var(--space-4)" }}>
          <div className="switch-row list-row">
            <span className="col"><span className="t-body" style={{ fontWeight: 600 }}>Notify me when rest ends</span><span className="t-small c-2">Needs notification permission</span></span>
            <button type="button" className="switch" role="switch" aria-checked={restAlerts} aria-label="Notify me when rest ends" onClick={() => toggleAlerts(!restAlerts)}><span className="switch-track"><span className="switch-knob"><Icon name="check" /></span></span></button>
          </div>
          {restAlerts && (
            <div className="list-row">
              <span className="col"><span className="t-body" style={{ fontWeight: 600 }}>Test the alert</span><span className="t-small c-2">Sends a notification to this phone now</span></span>
              <button type="button" className="btn btn-secondary" disabled={pending} onClick={sendTest}>Send test</button>
            </div>
          )}
          {alertNote && (
            <div className={`banner ${alertNote.ok ? "banner-success" : "banner-info"}`} role="status" style={{ margin: "var(--space-2) 0" }}>
              <Icon name={alertNote.ok ? "circle-check" : "info"} />
              <span>{alertNote.text}</span>
            </div>
          )}
          <div className="switch-row list-row">
            <span className="col"><span className="t-body" style={{ fontWeight: 600 }}>Bodyweight tracking</span><span className="t-small c-2">Log your weight once a week</span></span>
            <button type="button" className="switch" role="switch" aria-checked={bodyweight} aria-label="Bodyweight tracking" onClick={() => toggle("trackBodyweight", !bodyweight)}><span className="switch-track"><span className="switch-knob"><Icon name="check" /></span></span></button>
          </div>
          <Link className="list-row row-link" href="/notifications"><span className="col"><span className="t-body" style={{ fontWeight: 600 }}>Notification permission</span><span className="t-small c-2">Why we ask, and how to allow it</span></span><span className="c-2"><Icon name="chevron-right" /></span></Link>
          <Link className="list-row row-link" href="/install"><span className="col"><span className="t-body" style={{ fontWeight: 600 }}>Add to Home Screen guide</span><span className="t-small c-2">Install it like an app on iPhone</span></span><span className="c-2"><Icon name="chevron-right" /></span></Link>
          <Link className="list-row row-link" href="/find-weight?all=1"><span className="col"><span className="t-body" style={{ fontWeight: 600 }}>Find your weight</span><span className="t-small c-2">Re-run setup for any exercise</span></span><span className="c-2"><Icon name="chevron-right" /></span></Link>
        </section>

        <a className="btn btn-secondary btn-block" href="/api/export" download>Export data as CSV</a>
        <form action={logOut}><button type="submit" className="btn btn-tertiary btn-block">Log out{data.email ? ` (${data.email})` : ""}</button></form>
        <button type="button" className="btn btn-tertiary btn-block" style={{ color: "var(--danger)" }} onClick={() => setConfirmDelete(true)}>Delete my account</button>
        {pending && <span className="sr" role="status">Saving</span>}
      </div>

      {adding && (
        <>
          <div className="scrim" onClick={() => setAdding(false)} />
          <div className="sheet-wrap">
            <div className="sheet" role="dialog" aria-label="Add exercise" style={{ maxHeight: 640, overflowY: "auto" }}>
              <span className="sheet-grab" />
              <div className="row between g3 start">
                <h2 className="t-title">Add exercise</h2>
                <button type="button" className="icon-btn" aria-label="Close" onClick={() => setAdding(false)}><Icon name="x" /></button>
              </div>
              <p className="t-small c-2">It goes at the end of {day.fullName}. Check the time estimate afterwards.</p>
              <div className="col g2">
                {available.map((l) => (
                  <button key={l.slug} type="button" className="card" style={{ flexDirection: "row", alignItems: "center", gap: "var(--space-3)", textAlign: "left", color: "var(--text)", minHeight: 64, padding: "var(--space-2) var(--space-4)" }}
                    onClick={() => { commit(add(rows, { slug: l.slug, name: l.name, kind: l.kind, sets: 2, repLo: l.repLo, repHi: l.repHi })); setOpen(rows.length); setAdding(false); }}>
                    <span className="col" style={{ flex: 1 }}><strong>{l.name}</strong><span className="t-small c-2">{l.group}</span></span>
                    <Icon name="plus" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {confirmDelete && (
        <>
          <div className="scrim" onClick={() => setConfirmDelete(false)} />
          <div className="sheet-wrap">
            <form className="sheet" role="dialog" aria-label="Delete account" action={deleteAccount}>
              <span className="sheet-grab" />
              <h2 className="t-title">Delete everything?</h2>
              <p className="t-body c-2">This deletes your login and all your workouts, plans and check-ins. It can’t be undone.</p>
              <a className="btn btn-secondary btn-block" href="/api/export" download>Export my data first</a>
              <button type="submit" className="btn btn-danger btn-block"><Icon name="trash" />Delete my account</button>
              <button type="button" className="btn btn-tertiary btn-block" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
