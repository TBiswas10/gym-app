"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { ResumeBar } from "@/components/ResumeBar";
import { BriefingInline, NudgeStack, ReviewTeaser } from "@/components/V2Cards";
import { STRETCH_ROUTINE } from "@/lib/stretch";
import type { V2Today } from "@/lib/server/v2-data";
import { Rings } from "@/components/Rings";
import { formatLongDate, longDay, weekdayOf } from "@/lib/dates";
import { countLine, estimateMinutes, formatTarget, liftMinutes } from "@/lib/plan";
import type { StripDay } from "@/lib/schedule";
import type { PlanDay, TodayData } from "@/lib/server/today-data";
import { chooseMissed, setLight, skipDay, toggleRestLog, undoMissed, type ActionResult } from "./actions";
import { setDeloadWeek, setTestMode } from "./plan/actions";

const joinNames = (names: string[]): string =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

const STATUS_WORDS: Partial<Record<StripDay["status"], string>> = {
  done: ", done",
  rest: ", rest day",
  today: ", today",
  missed: ", missed",
  skipped: ", skipped",
  pre: ", before you started",
};

export function TodayView({ data, v2 }: { data: TodayData; v2?: V2Today }) {
  const { strip, today } = data;
  const todayIdx = Math.max(0, strip.findIndex((d) => d.date === today));
  const [sel, setSel] = useState(todayIdx);
  const [moving, setMoving] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  // The setup note is long. After you've seen it once, it shrinks to a single line so the workout sits higher.
  const [compactSetup, setCompactSetup] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem("wt.setupSeen")) setCompactSetup(true);
      else window.localStorage.setItem("wt.setupSeen", "1");
    } catch {
      /* storage blocked: keep the full note */
    }
  }, []);
  const [deloadHidden, setDeloadHidden] = useState(false);
  const [missedOpen, setMissedOpen] = useState(false);
  // Press and hold a day in the week strip for quick actions (start early, go light, skip).
  const [quick, setQuick] = useState<number | null>(null);
  const pressTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const pressAt = useRef({ x: 0, y: 0 });
  const pressStart = (i: number, x: number, y: number) => {
    longFired.current = false;
    pressAt.current = { x, y };
    pressTimer.current = window.setTimeout(() => {
      longFired.current = true;
      setQuick(i);
    }, 500);
  };
  const pressEnd = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  // Moving the finger (a swipe or a scroll) is not a press: cancel it.
  const pressMove = (x: number, y: number) => {
    if (pressTimer.current !== null && Math.hypot(x - pressAt.current.x, y - pressAt.current.y) > 8) pressEnd();
  };
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const d = strip[sel];
  const plan: PlanDay | null = d.sessionOrigin ? data.days[weekdayOf(d.sessionOrigin)] : null;

  const [light, setOptLight] = useOptimistic(d.light, (_s, v: boolean) => v);
  const restNow = data.restLogs[d.date] ?? { walk: false, stretch: false };
  const [rest, setOptRest] = useOptimistic(restNow, (s, p: { kind: "walk" | "stretch"; on: boolean }) => ({ ...s, [p.kind]: p.on }));

  const run = (fn: () => Promise<ActionResult>, optimistic?: () => void) =>
    startTransition(async () => {
      optimistic?.();
      const r = await fn();
      setError(r.ok ? null : r.error);
    });

  // ----- header copy
  const tStrip = strip[todayIdx];
  const tPlan = tStrip?.sessionOrigin ? data.days[weekdayOf(tStrip.sessionOrigin)] : null;
  const greeting =
    data.totalDone === 0 && data.setup
      ? "Welcome. Let’s find your weights."
      : tStrip?.status === "done"
        ? "Done for today. Nice work."
        : tPlan && (tStrip.status === "today" || tStrip.status === "light")
          ? `${tPlan.fullName} today`
          : tPlan
            ? "Rest day. Next up: " + tPlan.shortName
            : "Rest day. Recover well.";
  const dateLine = `${formatLongDate(today)} · Week ${data.week} of 12`;

  // ----- selected day
  const longName = longDay(d.weekday);
  const kinds = plan?.exercises.map((e) => e.kind) ?? [];
  const lifts = plan ? liftMinutes(kinds, light) : 0;
  const cardio = plan?.cardioMinutes ?? 0;
  const total = plan ? estimateMinutes(kinds, cardio, light) : 0;
  const when =
    d.status === "today" ? `Today · ${longName}` : d.status === "done" ? `${longName} · Done` : d.status === "missed" ? `${longName} · Missed` : longName;
  const startable = !!plan && (d.status === "today" || d.status === "next" || d.status === "light");
  // In weeks 1-2 an exercise with no starting weight goes through "Find your weight" first.
  // No separate setup step: weeks 1 and 2 find their weights inside the workout itself, and those sets count.
  const startHref = `/workout?date=${d.sessionOrigin}`;
  const startLabel = light ? "Start light workout" : d.status === "today" ? "Start workout" : d.status === "next" ? `Start ${longName} workout early` : `Start ${longName}’s workout`;
  const showLightToggle = !!plan && d.status !== "missed" && d.status !== "done";

  // ----- missed card
  const m = data.missed;
  const mPlan = m ? data.days[weekdayOf(m.origin)] : null;
  const mDay = m ? longDay(weekdayOf(m.origin)) : "";
  const freeNames = data.free.map((f) => f.label);

  return (
    <>
      <div className="scroll stagger">
        <div className="row between start g3">
          <div className="col g1 grow">
            <span className="t-small c-2">{dateLine}</span>
            <h1 className="t-title">{greeting}</h1>
          </div>
          <Link className="icon-btn" href="/plan" aria-label="Plan and settings">
            <Icon name="settings" />
          </Link>
        </div>

        {/* week strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: "var(--space-1)" }}>
          {strip.map((s, i) => {
            const name = s.sessionOrigin ? data.days[weekdayOf(s.sessionOrigin)].shortName : "Rest";
            const cls =
              s.status === "done" ? "dot-done" : s.status === "today" ? "dot-today" : s.status === "missed" ? "dot-missed" : s.status === "rest" || s.status === "skipped" || s.status === "pre" ? "dot-rest" : "";
            return (
              <button
                key={s.date}
                type="button"
                className="day"
                aria-pressed={i === sel}
                aria-label={`${longDay(s.weekday)} ${name}${STATUS_WORDS[s.status] ?? ""}`}
                onPointerDown={(e) => pressStart(i, e.clientX, e.clientY)}
                onPointerMove={(e) => pressMove(e.clientX, e.clientY)}
                onTouchMove={pressEnd}
                onPointerUp={pressEnd}
                onPointerLeave={pressEnd}
                onPointerCancel={pressEnd}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => {
                  if (longFired.current) {
                    longFired.current = false;
                    return;
                  }
                  setSel(i);
                }}
                style={{ opacity: s.status === "pre" ? 0.45 : 1 }}
              >
                <span style={{ color: s.status === "today" ? "var(--accent)" : s.status === "missed" ? "var(--warning)" : "inherit" }}>{s.label}</span>
                <span className={`dot ${cls}`}>
                  {s.status === "done" && <Icon name="check" size={16} />}
                  {s.status === "missed" && <Icon name="triangle-alert" size={16} />}
                  {(s.status === "rest" || s.status === "skipped") && <Icon name="moon" size={16} />}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="banner banner-danger" role="alert">
            <Icon name="circle-alert" />
            <span>{error}</span>
          </div>
        )}

        {data.inProgress && <ResumeBar dayName={data.inProgress.dayName} startedAt={data.inProgress.startedAt} />}

        {data.testMode && (
          <section className="card card-warning" aria-label="Test mode">
            <div className="col g1">
              <span className="t-eyebrow c-warning row g2"><Icon name="triangle-alert" size={16} />Test mode</span>
              <p className="t-small">Start any day to try every screen. Sessions you do here are deleted when you exit.</p>
            </div>
            <div className="chip-row-tight">
              {Object.values(data.days).map((p) => (
                <Link key={p.weekday} className="chip" prefetch={false} href={`/workout?test=${p.weekday}`}>{p.shortName}</Link>
              ))}
            </div>
            <div className="chip-row-tight">
              {[4, 8, 12].map((w) => (
                <Link key={w} className="chip" href={`/review?week=${w}`}>Week {w} check-in</Link>
              ))}
              <Link className="chip" href="/offline">Offline screen</Link>
            </div>
            {!confirmExit ? (
              <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirmExit(true)}>Exit test mode</button>
            ) : (
              <div className="grid2">
                <button type="button" className="btn btn-secondary" onClick={() => setConfirmExit(false)}>Stay in test mode</button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={pending}
                  onClick={() => startTransition(async () => { await setTestMode(false); })}
                >
                  Delete test sessions and exit
                </button>
              </div>
            )}
          </section>
        )}

        {data.setup && compactSetup && (
          <div className="card card-accent" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", minHeight: "var(--size-tap)", padding: "var(--space-2) var(--space-4)", textDecoration: "none", color: "var(--text)" }}>
            <span className="t-eyebrow c-accent">Weeks 1 and 2 · find your weights</span>
          </div>
        )}
        {data.setup && !compactSetup && (
          <section className="card card-accent">
            <div className="row g3 start">
              <span className="round round-accent">
                <Icon name="dumbbell" />
              </span>
              <div className="col g1 grow">
                <span className="t-eyebrow c-accent">Setup mode · weeks 1 and 2</span>
                <p className="t-small">
                  Find your weights as you train. For each exercise, pick a weight you can lift cleanly for about 10 reps, with 1 or 2 left in the tank. Every set you log counts. No pressure to progress yet.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* v2: today's briefing, suggestions about the plan, and this week's review */}
        {v2 && v2.nudges.length > 0 && <NudgeStack nudges={v2.nudges} />}
        {/* missed day */}
        {m && mPlan && m.state === "ask" && !moving && !missedOpen && (
          <button type="button" className="attn-row" onClick={() => setMissedOpen(true)} aria-expanded="false">
            <span className="round round-subtle"><Icon name="triangle-alert" /></span>
            <span className="col" style={{ flex: 1, minWidth: 0 }}>
              <span className="t-caption c-warning">MISSED WORKOUT</span>
              <strong className="attn-title">{mDay}’s {mPlan.shortName} didn’t happen</strong>
            </span>
            <span className="t-small c-2">Choose</span>
          </button>
        )}
        {m && mPlan && !(m.state === "ask" && !moving && !missedOpen) && (
          <section className="card card-warning anim-in">
            {m.state === "ask" && !moving && (
              <>
                <div className="col g1">
                  <span className="t-eyebrow c-warning row g2">
                    <Icon name="triangle-alert" size={16} />
                    Missed workout
                  </span>
                  <h2 className="t-heading">
                    {mDay}’s {mPlan.shortName} didn’t happen.
                  </h2>
                  <p className="t-small c-2">No stress. Pick what suits this week.</p>
                </div>
                <div className="col g2">
                  {freeNames.length > 0 && (
                    <button type="button" className="opt main" disabled={pending} onClick={() => setMoving(true)}>
                      <span className="col">
                        <strong>Move to a free day</strong>
                        <span className="t-small">{joinNames(freeNames)} {freeNames.length === 1 ? "is" : "are"} free</span>
                      </span>
                      <Icon name="chevron-right" size={20} />
                    </button>
                  )}
                  <button type="button" className="opt" disabled={pending} onClick={() => run(() => chooseMissed(m.origin, "light"))}>
                    <span className="col">
                      <strong>Do a light version</strong>
                      <span className="t-small c-2">About 30 min, lighter weights</span>
                    </span>
                    <Icon name="chevron-right" size={20} />
                  </button>
                  <button type="button" className="opt" style={{ minHeight: "var(--size-tap)" }} disabled={pending} onClick={() => run(() => chooseMissed(m.origin, "skipped"))}>
                    <span className="col">
                      <strong>Skip it</strong>
                    </span>
                  </button>
                </div>
              </>
            )}

            {m.state === "ask" && moving && (
              <>
                <div className="col g1">
                  <span className="t-eyebrow c-warning">Move {mPlan.shortName} to</span>
                  <p className="t-small c-2">{freeNames.length === 2 ? "Both days are free. Which suits you?" : "Which day suits you?"}</p>
                </div>
                <div className="grid2">
                  {data.free.map((f) => (
                    <button
                      key={f.date}
                      type="button"
                      className="btn btn-warning"
                      style={{ minHeight: "var(--size-control)" }}
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const r = await chooseMissed(m.origin, "moved", f.date);
                          if (r.ok) setMoving(false);
                          return r;
                        })
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="btn btn-tertiary" style={{ color: "var(--text-2)", alignSelf: "flex-start" }} onClick={() => setMoving(false)}>
                  Back
                </button>
              </>
            )}

            {m.state !== "ask" && (
              <>
                <div className="row g3">
                  <span className="round round-success">
                    <Icon name="check" />
                  </span>
                  <div className="col grow">
                    <strong>
                      {m.state === "moved" && `${mPlan.shortName} moved to ${m.movedTo ? longDay(weekdayOf(m.movedTo)) : "another day"}`}
                      {m.state === "skipped" && `${mPlan.shortName} skipped`}
                      {m.state === "light" && `Light ${mPlan.shortName} is ready`}
                    </strong>
                    <span className="t-small c-2">
                      {m.state === "moved" && "It’s on your week strip now."}
                      {m.state === "skipped" && (data.toGo.length ? `Back to the plan on ${data.toGo[0]}.` : "Back to the plan next week.")}
                      {m.state === "light" && "About 30 min, weights about 20% lighter."}
                    </span>
                  </div>
                </div>
                {m.state === "light" && (
                  <Link className="btn btn-primary btn-block" href={`/workout?date=${m.origin}`} prefetch={false}>
                    Start light {mPlan.shortName}
                  </Link>
                )}
                <button
                  type="button"
                  className="btn btn-tertiary"
                  style={{ color: "var(--text-2)", alignSelf: "flex-start" }}
                  disabled={pending}
                  onClick={() => run(() => undoMissed(m.origin))}
                >
                  Undo
                </button>
              </>
            )}
          </section>
        )}

        {data.checkIn && (
          <Link className="verdict verdict-up" href={`/review?week=${data.checkIn}`} style={{ textDecoration: "none", color: "var(--text)" }}>
            <span className="round round-accent"><Icon name="calendar" /></span>
            <span className="col" style={{ flex: 1 }}>
              <strong>Week {data.checkIn} check-in is ready</strong>
              <span className="t-small c-2">See how it’s going and pick what’s next</span>
            </span>
            <span className="c-accent"><Icon name="chevron-right" /></span>
          </Link>
        )}

        {data.inDeload && (
          <div className="banner banner-info" role="status">
            <Icon name="info" />
            <span className="col">
              <span><b>Deload week.</b> Half the sets, same weights. Easy does it.</span>
              <button type="button" className="link" style={{ background: "none", border: 0, padding: 0, alignSelf: "flex-start" }} disabled={pending} onClick={() => run(() => setDeloadWeek(data.week, false))}>Not this week</button>
            </span>
          </div>
        )}

        {!v2 && data.deloadSuggested && !data.inDeload && !deloadHidden && (
          <section className="card card-raised">
            <span className="t-eyebrow c-2">Week {data.week}</span>
            <h2 className="t-heading">Take an easier week?</h2>
            <p className="t-small c-2">Every 6 to 8 weeks a deload week keeps you fresh: same weights, half the sets (1 each).</p>
            <div className="grid2">
              <button type="button" className="btn btn-secondary" onClick={() => setDeloadHidden(true)}>Not now</button>
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => setDeloadWeek(data.week, true))}>Make it a deload</button>
            </div>
          </section>
        )}

        {data.highSoreness && plan && d.status !== "done" && (
          <div className="banner banner-warning" role="status">
            <Icon name="triangle-alert" />
            <span><b>Soreness has been high for three sessions.</b> Hold your weights today, or switch on Go light.</span>
          </div>
        )}

        {/* selected day: workout */}
        {plan && (
          <section key={d.date} className="card anim-in">
            {d.status === "done" && (
              <div className="row g3" style={{ alignItems: "center" }} role="status">
                <span className="done-mini"><Icon name="check" /></span>
                <span className="col">
                  <strong className="t-heading">Workout complete</strong>
                  <span className="t-small c-2">{plan.fullName} is done.</span>
                </span>
              </div>
            )}
            <div className="row between g2">
              <span className={`t-eyebrow ${d.status === "today" ? "c-accent" : "c-2"}`}>{when}</span>
              <span className="t-small c-2">{countLine(plan.exercises.length)}</span>
            </div>
            <div className="row between end g3">
              <h2 className="t-title">{plan.fullName}{d.movedIn ? " (moved)" : ""}</h2>
              <div className="col" style={{ alignItems: "flex-end", flex: "none" }}>
                <span className="num-m">~{total}</span>
                <span className="t-caption c-2">min est.</span>
              </div>
            </div>
            <div className="bar-split" aria-hidden="true">
              <i style={{ flex: `${lifts} 1 0`, background: "var(--accent)" }} />
              <i style={{ flex: `${cardio} 1 0`, background: "var(--info)" }} />
            </div>
            <div className="plan-legend t-caption c-2">
              <span><i style={{ background: "var(--accent)" }} />Lifts {lifts}</span>
              <span><i style={{ background: "var(--info)" }} />Cardio at the end {cardio}</span>
            </div>
            {v2?.briefing && d.date === today && startable && <BriefingInline briefing={v2.briefing} />}
            <ol className="list" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {plan.exercises.map((e) => (
                <li key={e.slug} className="list-row" style={{ minHeight: 44 }}>
                  <span className="t-body" style={{ fontWeight: 600, minWidth: 0 }}>{e.name}</span>
                  <span className="col" style={{ alignItems: "flex-end", flex: "none", gap: 0 }}>
                    <span className="t-small c-2" style={{ whiteSpace: "nowrap" }}>{formatTarget(e.sets, e.repLo, e.repHi, e.kind)}</span>
                    {(v2?.goals?.[e.slug] || v2?.lasts?.[e.slug]) && (
                      <span className="t-caption c-accent" style={{ textTransform: "none", letterSpacing: 0, whiteSpace: "nowrap" }}>
                        {v2?.goals?.[e.slug] ? `Goal ${v2.goals[e.slug]}` : `Last ${v2?.lasts?.[e.slug]}`}
                      </span>
                    )}
                  </span>
                </li>
              ))}
              <li className="list-row" style={{ minHeight: 40 }}>
                <span className="t-body row g2 c-info" style={{ fontWeight: 600 }}>
                  <Icon name="timer" size={20} />
                  Cardio · {plan.cardioName}
                </span>
                <span className="t-small c-2" style={{ whiteSpace: "nowrap" }}>{plan.cardioLabel}</span>
              </li>
            </ol>
            {showLightToggle && (
              <div className="switch-row inset" style={{ flexDirection: "row", padding: "var(--space-1) var(--space-1) var(--space-1) var(--space-4)" }}>
                <span className="col">
                  <strong>Go light today</strong>
                  <span className="t-small c-2">{light ? "Weights about 20% lighter, same reps." : "For days you feel very sore."}</span>
                </span>
                <button
                  type="button"
                  className="switch"
                  role="switch"
                  aria-checked={light}
                  aria-label="Go light today"
                  onClick={() => run(() => setLight(d.sessionOrigin!, !light), () => setOptLight(!light))}
                >
                  <span className="switch-track">
                    <span className="switch-knob">
                      <Icon name="check" />
                    </span>
                  </span>
                </button>
              </div>
            )}
          </section>
        )}

        {/* selected day: rest, skipped, or before the start */}
        {!plan && (
          <section className={`card ${d.status === "rest" ? "card-dashed" : ""}`}>
            <span className="t-eyebrow c-2">{longName}</span>
            {d.status === "rest" && (
              <>
                <h2 className="t-title">Rest day</h2>
                <p className="t-body c-2">Muscles grow while you recover. Keep moving gently if you feel like it.</p>
                {d.date <= today ? (
                  <div className="grid2">
                    {(["walk", "stretch"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="chip"
                        style={{ flexDirection: "column", alignItems: "flex-start", borderRadius: "var(--radius-sm)", minHeight: 72, padding: "var(--space-3) var(--space-4)" }}
                        aria-pressed={rest[k]}
                        onClick={() => run(() => toggleRestLog(d.date, k, !rest[k]), () => setOptRest({ kind: k, on: !rest[k] }))}
                      >
                        <span className="row g2">
                          <Icon name={k === "walk" ? "footprints" : "heart"} size={20} />
                          {k === "walk" ? "Easy walk" : "Stretch"}
                        </span>
                        <span className="t-small c-2" style={{ fontWeight: 500 }}>
                          {rest[k] ? "Nice. Logged." : k === "walk" ? "20–30 min" : "10 min routine"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="t-small c-2">Come back on the day to log a walk or a stretch.</p>
                )}
                <p className="t-small c-2">{data.highSoreness ? "Soreness has been high, so the stretch is worth more than the walk today." : "A walk and a stretch both help. Do whichever you feel like."}</p>
                <details className="stretch">
                  <summary>See the 10 minute stretch routine</summary>
                  <ol className="col g2">
                    {STRETCH_ROUTINE.map((m) => (
                      <li key={m.name}>
                        <span className="row between baseline g3"><strong className="t-body">{m.name}</strong><span className="t-small c-2">{m.time}</span></span>
                        <span className="t-small c-2">{m.how}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              </>
            )}
            {d.status === "skipped" && (
              <>
                {d.skippedOrigin ? (
                  <>
                    <h2 className="t-title">Skipped</h2>
                    <p className="t-body c-2">You skipped this one, but you can still do it. It will show a tick when it’s done.</p>
                    <Link className="btn btn-secondary btn-block" href={`/workout?date=${d.skippedOrigin}`} prefetch={false}>
                      <Icon name="play" />Do it now
                    </Link>
                  </>
                ) : (
                  <>
                    <h2 className="t-title">No session</h2>
                    <p className="t-body c-2">This one was moved to another day. Nothing to do here.</p>
                  </>
                )}
              </>
            )}
            {d.status === "pre" && (
              <>
                <h2 className="t-title">Before you started</h2>
                <p className="t-body c-2">Your programme starts on {formatLongDate(data.startDate)}.</p>
              </>
            )}
          </section>
        )}

        {/* stats */}
        <section className="col g3">
          <Link className="card" href="/progress" aria-label="This week, open progress">
            <div className="row between baseline">
              <span className="t-small c-2">This week</span>
              <span className="t-small c-2">{data.toGo.length ? `${joinNames(data.toGo)} to go` : "All done this week"}</span>
            </div>
            <Rings
              values={[
                { label: "Sessions", done: data.weekDone, planned: data.weekPlan, color: "var(--accent)" },
                { label: "Sets", done: data.weekSets, planned: data.weekSetsPlan ?? 0, color: "var(--info)" },
                { label: "Cardio", done: data.weekCardioMin ?? 0, planned: data.weekCardioPlan ?? 0, unit: " min", color: "var(--success)" },
              ]}
            />
            <span className="t-small c-2">{data.totalDone === 0 ? "Your first session is today." : `${data.totalDone} ${data.totalDone === 1 ? "session" : "sessions"} so far.`}</span>
          </Link>
        </section>
        {v2?.review && <ReviewTeaser review={v2.review} />}
      </div>

      {quick !== null && (() => {
        const q = strip[quick];
        const qPlan = q.sessionOrigin ? data.days[weekdayOf(q.sessionOrigin)] : null;
        const canStart = !!qPlan && (q.status === "today" || q.status === "next" || q.status === "light");
        const canLight = !!qPlan && q.status !== "done" && q.status !== "missed";
        const canSkip = !!qPlan && (q.status === "today" || q.status === "next");
        const canRestore = q.status === "skipped" && !!q.skippedOrigin;
        const close = () => setQuick(null);
        return (
          <>
            <div className="scrim anim-fade" onClick={close} />
            <div className="sheet-wrap">
              <div className="sheet" role="dialog" aria-label={`${longDay(q.weekday)} quick actions`}>
                <span className="sheet-grab" />
                <div className="row between">
                  <h2 className="t-title">{longDay(q.weekday)}{qPlan ? ` · ${qPlan.shortName}` : ""}</h2>
                  <button type="button" className="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
                </div>
                {canStart && (
                  <Link className="btn btn-primary btn-block" href={`/workout?date=${q.sessionOrigin}`} prefetch={false}>
                    <Icon name="play" />{q.status === "next" ? "Start it early" : "Start now"}
                  </Link>
                )}
                {canLight && (
                  <button type="button" className="btn btn-secondary btn-block" disabled={pending} onClick={() => { run(() => setLight(q.sessionOrigin!, !q.light)); close(); }}>
                    {q.light ? "Back to a normal session" : "Make it a light session"}
                  </button>
                )}
                {canSkip && (
                  <button type="button" className="btn btn-secondary btn-block" disabled={pending} onClick={() => { run(() => skipDay(q.sessionOrigin!)); close(); }}>Skip this one</button>
                )}
                {canRestore && (
                  <button type="button" className="btn btn-secondary btn-block" disabled={pending} onClick={() => { run(() => undoMissed(q.skippedOrigin!)); close(); }}>Bring it back</button>
                )}
                {!canStart && !canLight && !canSkip && !canRestore && <p className="t-body c-2">Nothing to change on this day.</p>}
              </div>
            </div>
          </>
        );
      })()}

      {(startable || sel !== todayIdx) && (
      <div className="bottom-bar above-tabs">
        {startable && (
          <Link className="btn btn-primary btn-cta" href={startHref} prefetch={false}>
            <Icon name="play" />
            {startLabel}
            {total > 0 && <span style={{ fontWeight: 500, opacity: 0.75 }}> · ~{total} min</span>}
          </Link>
        )}
        {!startable && sel !== todayIdx && (
          <button type="button" className="btn btn-secondary btn-cta" onClick={() => setSel(todayIdx)}>
            Back to today’s workout
          </button>
        )}
      </div>
      )}
    </>
  );
}
