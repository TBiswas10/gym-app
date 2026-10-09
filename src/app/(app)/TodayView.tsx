"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { formatLongDate, longDay, weekdayOf } from "@/lib/dates";
import { countLine, estimateMinutes, formatTarget, liftMinutes, WARMUP_MIN } from "@/lib/plan";
import type { StripDay } from "@/lib/schedule";
import type { PlanDay, TodayData } from "@/lib/server/today-data";
import { chooseMissed, setLight, toggleRestLog, undoMissed, type ActionResult } from "./actions";
import { setDeloadWeek } from "./plan/actions";

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

export function TodayView({ data }: { data: TodayData }) {
  const { strip, today } = data;
  const todayIdx = Math.max(0, strip.findIndex((d) => d.date === today));
  const [sel, setSel] = useState(todayIdx);
  const [moving, setMoving] = useState(false);
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
  const weekDone = data.weekDone;
  const greeting =
    data.totalDone === 0 && data.setup
      ? "Welcome. Let’s find your weights."
      : weekDone > 0
        ? "Hey, nice work this week."
        : "Ready when you are.";
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
  const needsWeights = data.setup && !!plan && plan.exercises.some((e) => e.kind === "weight" && !e.hasStartWeight);
  const startHref = needsWeights ? `/find-weight?date=${d.sessionOrigin}` : `/workout?date=${d.sessionOrigin}`;
  const startLabel = light ? "Start light workout" : d.status === "today" ? "Start workout" : `Start ${longName}’s workout`;
  const showLightToggle = !!plan && d.status !== "missed" && d.status !== "done";

  // ----- missed card
  const m = data.missed;
  const mPlan = m ? data.days[weekdayOf(m.origin)] : null;
  const mDay = m ? longDay(weekdayOf(m.origin)) : "";
  const freeNames = data.free.map((f) => f.label);

  return (
    <>
      <div className="scroll">
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
                onClick={() => setSel(i)}
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

        {data.setup && compactSetup && (
          <Link className="card card-accent" href="/find-weight" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", minHeight: "var(--size-tap)", padding: "var(--space-2) var(--space-4)", textDecoration: "none", color: "var(--text)" }}>
            <span className="t-eyebrow c-accent">Setup mode · weeks 1 and 2</span>
            <span className="link" style={{ whiteSpace: "nowrap" }}>How it works <Icon name="chevron-right" size={20} /></span>
          </Link>
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
                  For each exercise, pick a weight you can lift cleanly for about 10 reps, with 1 or 2 left in the tank. No pressure to progress yet.
                </p>
              </div>
            </div>
            <Link className="link" href="/find-weight">
              See how it works <Icon name="chevron-right" size={20} />
            </Link>
          </section>
        )}

        {/* missed day */}
        {m && mPlan && (
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

        {data.deloadSuggested && !data.inDeload && !deloadHidden && (
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
          <section className="card">
            <div className="row between g2">
              <span className="t-eyebrow c-accent">{when}</span>
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
              <i style={{ flex: `${WARMUP_MIN} 1 0`, background: "var(--border-strong)" }} />
              <i style={{ flex: `${lifts} 1 0`, background: "var(--accent)" }} />
              <i style={{ flex: `${cardio} 1 0`, background: "var(--info)" }} />
            </div>
            <div className="plan-legend t-caption c-2">
              <span><i style={{ background: "var(--border-strong)" }} />Warm-up {WARMUP_MIN}</span>
              <span><i style={{ background: "var(--accent)" }} />Lifts {lifts}</span>
              <span><i style={{ background: "var(--info)" }} />Cardio {cardio}</span>
            </div>
            <ol className="list" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {plan.exercises.map((e) => (
                <li key={e.slug} className="list-row" style={{ minHeight: "var(--size-tap)" }}>
                  <span className="t-body" style={{ fontWeight: 600 }}>{e.name}</span>
                  <span className="t-small c-2" style={{ whiteSpace: "nowrap" }}>
                    {data.setup && e.kind === "weight" && !e.hasStartWeight ? "Find weight" : formatTarget(e.sets, e.repLo, e.repHi, e.kind)}
                  </span>
                </li>
              ))}
              <li className="list-row" style={{ minHeight: "var(--size-tap)" }}>
                <span className="t-body row g2 c-info" style={{ fontWeight: 600 }}>
                  <Icon name="timer" size={20} />
                  Cardio · {plan.cardioName}
                </span>
                <span className="t-small c-2" style={{ whiteSpace: "nowrap" }}>{plan.cardioLabel}</span>
              </li>
            </ol>
            <p className="t-small c-2">Cool-down 2–3 min is optional.</p>
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
              </>
            )}
            {d.status === "skipped" && (
              <>
                <h2 className="t-title">No session</h2>
                <p className="t-body c-2">This one was skipped or moved to another day. Nothing to do here.</p>
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
        <section className="grid2" style={{ gap: "var(--space-3)" }}>
          <div className="card">
            <span className="t-small c-2">Sessions done</span>
            <div className="row baseline g2">
              <span className="num-m">{data.totalDone}</span>
              <span className="t-small c-2">so far</span>
            </div>
            <span className="t-small c-2">{data.totalDone === 0 ? "Your first one is today." : "Since week 1."}</span>
          </div>
          <Link className="card" href="/progress">
            <span className="t-small c-2">This week</span>
            <div className="row baseline g2">
              <span className="num-m">{data.weekDone}/{data.weekPlan}</span>
              <span className="t-small c-2">sessions</span>
            </div>
            <div className="row g1" aria-hidden="true">
              {Array.from({ length: data.weekPlan }, (_, i) => (
                <i key={i} className={`streak-dot ${i < data.weekDone ? "on" : ""}`} />
              ))}
            </div>
            <span className="t-small c-2">
              {data.weekSets > 0 ? `${data.weekSets} sets` : data.toGo.length ? `${joinNames(data.toGo)} to go.` : "All done this week."}
            </span>
          </Link>
        </section>
      </div>

      {(startable || sel !== todayIdx) && (
      <div className="bottom-bar above-tabs">
        {startable && (
          <Link className="btn btn-primary btn-cta" href={startHref} prefetch={false}>
            <Icon name="play" />
            {startLabel}
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
