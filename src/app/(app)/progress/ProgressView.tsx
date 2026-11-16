"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import { BodyMap } from "@/components/BodyMap";
import { Icon, type IconName } from "@/components/Icon";
import { LineChart } from "@/components/LineChart";
import { GoalsCard, ReviewCard } from "@/components/V2Cards";
import type { Balance } from "@/lib/balance";
import { shareOf } from "@/lib/balance";
import { direction, wordFor } from "@/lib/checkin-scale";
import { addDays } from "@/lib/dates";
import { fmtNum } from "@/lib/format";
import type { ProgressData } from "@/lib/server/progress-data";
import { weekCompare, type SeriesPoint } from "@/lib/stats";
import { withTransition } from "@/lib/view-transition";

const CELL_CLASS = { done: "wk-done", now: "wk-now", check: "wk-check", todo: "" } as const;
const SHOWN = 4;

type Range = "4w" | "12w" | "all";
const RANGES: [Range, string][] = [["4w", "4 weeks"], ["12w", "12 weeks"], ["all", "All"]];
const RANGE_DAYS = { "4w": 28, "12w": 84 } as const;
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { timeZone: "UTC", day: "numeric", month: "short" });

export function ProgressView({ data }: { data: ProgressData }) {
  const [range, setRange] = useState<Range>("12w");
  const since = range === "all" ? "" : addDays(data.today, -RANGE_DAYS[range]);
  const within = (pts: SeriesPoint[]) => (since ? pts.filter((q) => q.date >= since) : pts);

  // Every lift logged in the range, biggest gain first. The one you tap gets the full chart on top.
  const rows = data.chips.flatMap((c, i) => {
    const values = within(c.points).map((q) => q.value);
    if (values.length === 0) return [];
    const first = values[0];
    const last = values[values.length - 1];
    return [{ c, i, values, last, delta: last - first, pct: first ? (last - first) / first : 0, moved: values.length > 1 }];
  });
  const ordered = [...rows].sort((a, b) => b.pct - a.pct);
  const withChange = rows.filter((r) => r.moved);
  const up = withChange.filter((r) => r.delta > 0).length;
  const best = ordered.find((r) => r.moved && r.delta > 0) ?? null;

  const [tab, setTab] = useState<"lifts" | "body" | "plan">("lifts");
  // Open on the biggest gain among weighted lifts (a hold or a rep count is a different kind of number).
  const lead = ordered.find((r) => r.moved && r.delta > 0 && r.c.kind === "weight") ?? best;
  const [sel, setSel] = useState(lead ? lead.i : 0);
  const [all, setAll] = useState(false);
  const [metric, setMetric] = useState<"top" | "e1rm">("top");
  const chip = data.chips[sel];
  const showE1rm = metric === "e1rm" && !!chip?.e1rm && chip.e1rm.length > 0;
  const pts = chip ? within(showE1rm ? chip.e1rm! : chip.points) : [];
  const values = pts.map((q) => q.value);
  const unit = chip?.unit ?? "kg";
  const fmt = (v: number) => `${fmtNum(v)} ${unit}`;
  const delta = values.length > 1 ? values[values.length - 1] - values[0] : 0;
  const shown = all ? ordered : ordered.slice(0, SHOWN);

  // Tapping a lift or a record brings its chart into view at the top.
  const chartRef = useRef<HTMLElement | null>(null);
  const showChart = (i: number) => {
    setSel(i);
    chartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const openLift = (name: string) => {
    const r = data.chips.findIndex((x) => x.name === name);
    if (r >= 0) showChart(r);
  };

  const streak = data.consistency.streak;
  const story = [
    withChange.length > 0 ? `${up} of ${withChange.length} lifts are up.` : "",
    streak > 0 ? `${streak} full ${streak === 1 ? "week" : "weeks"} in a row.` : "",
  ].filter(Boolean).join(" ");
  const compare = data.volumeNow ? weekCompare(data.volumeNow) : null;
  const energy = data.trend.map((t) => t.energy);
  const soreness = data.trend.map((t) => t.soreness);
  const t = data.thisWeek;

  return (
    <>
      <div className="scroll stagger">
        <div className="row between">
          <h1 className="t-title">Progress</h1>
          <Link className="btn btn-tertiary" href="/progress/history">History</Link>
        </div>

        <section className="card" aria-label="Where you are">
          <div className="row between baseline">
            <h2 className="num-m">Week {data.week} of 12</h2>
            <span className="t-small c-2">{12 - data.week === 0 ? "last week" : `${12 - data.week} to go`}</span>
          </div>
          <div className="bar" role="img" aria-label={`Week ${data.week} of 12`}><i style={{ transform: `scaleX(${Math.min(1, data.week / 12)})` }} /></div>
          {data.empty ? (
            <p className="t-small c-2">Finish your first workout and this page fills in.</p>
          ) : (
            <>
              {story && <p className="t-small c-2">{story}</p>}
              {compare && <p className="t-small c-2">{compare}</p>}
              <div className="grid3">
                <div className="stat"><span className="num-m">{t.sessions}/{t.planned}</span><span className="t-caption c-2">SESSIONS</span></div>
                <div className="stat"><span className="num-m">{t.sets}</span><span className="t-caption c-2">SETS</span></div>
                <div className="stat"><span className={`num-m ${t.pbs.length ? "c-accent" : ""}`}>{t.pbs.length}</span><span className="t-caption c-2">NEW PBS</span></div>
              </div>
            </>
          )}
          {data.due && (
            <Link className="attn-row" href={`/review?week=${data.due}`}>
              <span className="round round-accent"><Icon name="calendar" /></span>
              <span className="col" style={{ flex: 1 }}>
                <strong>Week {data.due} check-in is ready</strong>
                <span className="t-small c-2">Two minutes, then the plan adjusts</span>
              </span>
              <span className="c-accent"><Icon name="chevron-right" /></span>
            </Link>
          )}
        </section>

        <div className="segmented is-sticky" role="tablist" aria-label="Progress sections">
          {([["lifts", "Lifts"], ["body", "Body"], ["plan", "12 weeks"]] as const).map(([id, label]) => (
            <button key={id} type="button" className="seg" role="tab" aria-selected={tab === id} onClick={() => withTransition(() => setTab(id))}>{label}</button>
          ))}
        </div>

        <div hidden={tab !== "lifts"} className="col g4" role="tabpanel">
          <section className="card" aria-label="Strength" ref={chartRef}>
            {chip ? (
              <>
                {chip.e1rm && chip.e1rm.length > 0 && (
                  <div className="chip-row-tight" role="tablist" aria-label="What the chart shows">
                    <button type="button" className="chip" role="tab" aria-selected={!showE1rm} onClick={() => setMetric("top")}>Top set</button>
                    <button type="button" className="chip" role="tab" aria-selected={showE1rm} onClick={() => setMetric("e1rm")}>Estimated 1RM</button>
                  </div>
                )}
                {values.length > 0 ? (
                  <>
                    <div className="row between g2" style={{ alignItems: "flex-end" }}>
                      <span className="col" style={{ minWidth: 0 }}>
                        <span className="t-caption c-2">{chip.name.toUpperCase()}</span>
                        <span className="num-m">{fmt(values[values.length - 1])}</span>
                      </span>
                      {values.length > 1 && <span className="tag tag-accent">{delta >= 0 ? "+" : "−"}{fmtNum(Math.abs(delta))} {unit} over {values.length} sessions</span>}
                    </div>
                    <LineChart
                      key={`${chip.slug}-${showE1rm}-${range}`}
                      values={values}
                      labels={pts.map((q) => shortDate(q.date))}
                      format={fmt}
                      ariaLabel={`${chip.name} ${showE1rm ? "estimated one-rep max" : chip.kind === "timed" ? "longest hold" : chip.kind === "bodyweight" ? "best set" : "top set"} by session: ${values.map(fmtNum).join(", ")} ${unit}`}
                    />
                    <p className="t-small c-2">{showE1rm ? "Estimated 1RM (the most you could lift once, worked out from your best set)" : chip.kind === "timed" ? "Longest hold" : chip.kind === "bodyweight" ? "Best set" : "Top set"}, {values.length} {values.length === 1 ? "session" : "sessions"}. Tap the chart to read a point.</p>
                  </>
                ) : (
                  <p className="t-small c-2">{chip.name} has no sessions in this range. Pick a longer one.</p>
                )}
                <div className="segmented" role="radiogroup" aria-label="How far back">
                  {RANGES.map(([id, label]) => (
                    <button key={id} type="button" className="seg" role="radio" aria-checked={range === id} onClick={() => setRange(id)}>{label}</button>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty">
                <span className="round round-subtle"><Icon name="chart" /></span>
                <h2 className="t-heading">Your first session shows up here</h2>
                <p className="t-small c-2">Finish a workout and your strength chart starts.</p>
              </div>
            )}
          </section>

          {chip && (
            <section className="card" aria-label="Your lifts">
              <div className="row between baseline">
                <h2 className="t-heading">Your lifts</h2>
                <span className="t-small c-2">biggest gain first</span>
              </div>
              {withChange.length === 0 && <p className="t-small c-2">Do each lift once more and the trends start.</p>}
              <div className="col g1">
                {shown.map((r) => {
                  const dir = !r.moved ? "" : r.delta > 0 ? "srow-up" : r.delta < 0 ? "srow-down" : "c-2";
                  return (
                    <button key={r.c.slug} type="button" className="srow" aria-pressed={r.i === sel} onClick={() => showChart(r.i)}>
                      <span className="srow-name">{r.c.name}</span>
                      <Spark values={r.values} />
                      <span className="srow-val">
                        <b>{fmtNum(r.last)} {r.c.unit}</b>
                        <span className={`t-caption ${dir}`} style={{ textTransform: "none", letterSpacing: 0 }}>
                          {!r.moved ? "first session" : r.delta === 0 ? "no change" : `${r.delta > 0 ? "+" : "−"}${fmtNum(Math.abs(r.delta))} ${r.c.unit}`}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {ordered.length > SHOWN && (
                <button type="button" className="btn btn-tertiary" onClick={() => setAll((v) => !v)}>
                  {all ? "Show fewer" : `Show all ${ordered.length} lifts`}
                </button>
              )}
            </section>
          )}

          {t.pbs.length > 0 && (
            <section className="card" aria-label="New personal bests">
              <h2 className="t-heading">New PBs this week</h2>
              <div className="col g2">
                {t.pbs.map((p, i) => (
                  <div key={`${p.name}-${i}`} className="pb-row">
                    <span className="badge-pb">PB</span>
                    <span className="t-body" style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
                    <span className="t-body" style={{ fontWeight: 700 }}>{p.text}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.volume && data.volume.some((v) => v.kg > 0) ? (
            <VolumeCard weeks={data.volume} point={data.volumeNow} />
          ) : (
            <Waiting label="Training volume" icon="dumbbell" title="Your weekly total shows here" text="Log sets with weight and the kilograms you lift each week fill in here." />
          )}

          <GoalsCard goals={data.goals ?? []} choices={data.chips.map((c) => ({ slug: c.slug, name: c.name, unit: c.unit }))} />

          {data.records.length === 0 ? (
            <Waiting label="Records" icon="chart" title="Your records show here" text="Your best set for each lift is kept here. Finish a workout to start." />
          ) : (
            <details className="card fold" aria-label="Records">
              <summary><h2 className="t-heading">Records</h2><span className="t-small c-2">{data.records.length}</span></summary>
              <div className="col g2">
                {data.records.map((r) => (
                  <button key={r.name} type="button" className="rec-row" onClick={() => openLift(r.name)} aria-label={`${r.name}, best ${r.text}. Show its chart.`}>
                    <span className="t-body">{r.name}</span>
                    <span className="row g2">
                      <span className="t-body" style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.text}</span>
                      <span className="c-2"><Icon name="chevron-right" size={16} /></span>
                    </span>
                  </button>
                ))}
              </div>
            </details>
          )}

          <ReviewCard reviews={data.reviews ?? []} />
        </div>

        <div hidden={tab !== "body"} className="col g4" role="tabpanel">
          {data.bodyMap && Object.values(data.bodyMap).some((m) => m.sets > 0 || m.daysAgo !== null) ? (
            <BodyMap load={data.bodyMap} />
          ) : (
            <Waiting label="Body map" icon="dumbbell" title="Your body map lights up here" text="Each muscle you train lights up for the week. Log a session and it fills in." />
          )}
          {data.balance && data.balance.total > 0 ? (
            <BalanceCard b={data.balance} />
          ) : (
            <Waiting label="Muscle balance" icon="chart" title="Your balance shows here" text="Push against pull, front against back and upper against lower, from your last four weeks of sets." />
          )}

          {data.bodyweight ? (
            <section className="card" aria-label="Bodyweight">
              <div className="row between baseline">
                <h2 className="t-heading">Bodyweight</h2>
                <span className="t-small c-2">7-day average</span>
              </div>
              <div className="row between g2" style={{ alignItems: "flex-end" }}>
                <span className="num-m">{fmtNum(data.bodyweight.summary.now)} kg</span>
                <span className="tag tag-accent">
                  {data.bodyweight.summary.change === 0 ? "No change" : `${data.bodyweight.summary.change > 0 ? "+" : "−"}${fmtNum(Math.abs(data.bodyweight.summary.change))} kg since you started`}
                </span>
              </div>
              {data.bodyweight.avg.length > 1 && (
                <LineChart values={data.bodyweight.avg} format={(v) => `${fmtNum(v)} kg`} ariaLabel={`Bodyweight 7-day average: ${data.bodyweight.avg.map(fmtNum).join(", ")} kg`} />
              )}
              <p className="t-small c-2">
                {data.bodyweight.rate == null
                  ? "A few more weigh-ins over the next week and you get a weekly trend."
                  : `Trend: ${data.bodyweight.rate > 0 ? "+" : data.bodyweight.rate < 0 ? "−" : ""}${fmtNum(Math.abs(data.bodyweight.rate))} kg a week.`}
              </p>
              <p className="t-small c-2">
                {data.bodyweight.goal === null
                  ? "Set a goal weight in Plan to see how far to go."
                  : data.bodyweight.summary.reached
                    ? `You’re at your goal of ${fmtNum(data.bodyweight.goal)} kg.`
                    : `${fmtNum(data.bodyweight.summary.toGo ?? 0)} kg to go to ${fmtNum(data.bodyweight.goal)} kg.`}
              </p>
            </section>
          ) : (
            <Waiting label="Bodyweight" icon="calendar" title="Your bodyweight shows here" text="Turn on bodyweight tracking in Plan, then add your weight at a check-in." />
          )}

          <section className="card" aria-label="How you have felt">
            <h2 className="t-heading">How you’ve felt</h2>
            {data.trend.length > 0 ? (
              <>
                <Trend5 label="Energy" kind="energy" values={energy} tone="var(--accent)" />
                <Trend5 label="Soreness" kind="soreness" values={soreness} tone="var(--warning)" />
                <p className="t-small c-2">From your check-in after each session, last {data.trend.length}. Energy 1 is drained, 5 is buzzing. Soreness 1 is none, 5 is very sore.</p>
              </>
            ) : (
              <p className="t-small c-2">After each session you’ll rate soreness and energy. They show up here.</p>
            )}
          </section>
        </div>

        <div hidden={tab !== "plan"} className="col g4" role="tabpanel">
          <section className="card">
            <h2 className="t-heading">12-week program</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: "var(--space-2)" }}>
              {data.cells.map((c) => (
                <div key={c.week} className={`week ${CELL_CLASS[c.cell]}`}><span>{c.week}</span></div>
              ))}
            </div>
            {data.next && !data.due && (
              <Link className="attn-row" href={`/review?week=${data.next}`}>
                <span className="round round-accent"><Icon name="calendar" /></span>
                <span className="col" style={{ flex: 1 }}>
                  <strong>Week {data.next} check-in next</strong>
                  <span className="t-small c-2">Review weeks 4, 8 and 12</span>
                </span>
                <span className="c-accent"><Icon name="chevron-right" /></span>
              </Link>
            )}
            <details className="fold-in">
              <summary>How the 12 weeks work</summary>
              <div className="col g1 t-small c-2" style={{ paddingTop: "var(--space-2)" }}>
                <span><strong className="c-text">Every week:</strong> Mon Push, Tue Pull, Wed Legs + Core, Thu Upper, Sat Lower + Core + Cardio. Fri and Sun rest.</span>
                <span>Weeks 1 and 2: find your weight. Weeks 3 to 12: build.</span>
              </div>
            </details>
          </section>

          <section className="card" aria-label="Consistency">
            <div className="row between baseline">
              <h2 className="t-heading">Consistency</h2>
              <span className="t-small c-2">{streak > 0 ? `${streak} ${streak === 1 ? "full week" : "full weeks"} in a row` : "Finish every planned session to start a run"}</span>
            </div>
            <div className="consistency" role="img" aria-label="Sessions finished each week against the plan">
              {data.consistency.weeks.map((w) => (
                <span key={w.week} className={`consistency-col ${w.week === data.week ? "is-now" : ""}`}>
                  <span className="consistency-track"><i style={{ height: `${Math.min(100, Math.round((w.done / Math.max(1, w.planned)) * 100))}%` }} className={w.done >= w.planned ? "is-full" : ""} /></span>
                  <span className="t-caption c-2">{w.week}</span>
                </span>
              ))}
            </div>
          </section>

          {data.activity && (
            <section className="card" aria-label="Activity calendar">
              <div className="row between baseline">
                <h2 className="t-heading">Activity</h2>
                <span className="t-small c-2">last 16 weeks</span>
              </div>
              <div className="cal" role="group" aria-label="Days you trained, oldest week on the left">
                {data.activity.map((wk, i) => (
                  <span key={i} className="cal-col">
                    {wk.map((c) =>
                      c.id ? (
                        <Link key={c.date} className="cal-cell is-done" href={`/progress/history/${c.id}`} aria-label={`Session on ${c.date}`} />
                      ) : (
                        <i key={c.date} className={`cal-cell${c.future ? " is-future" : ""}`} aria-hidden="true" />
                      ),
                    )}
                  </span>
                ))}
              </div>
              <p className="t-small c-2">Each square is a day. Tap a lit one to open that session.</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

/** A section with nothing in it yet: says what will appear and how to make it appear. Never fills in fake numbers. */
function Waiting({ label, icon, title, text }: { label: string; icon: IconName; title: string; text: string }) {
  return (
    <section className="card" aria-label={label}>
      <div className="empty">
        <span className="round round-subtle"><Icon name={icon} /></span>
        <h2 className="t-heading">{title}</h2>
        <p className="t-small c-2">{text}</p>
      </div>
    </section>
  );
}

/** A tiny line for one lift: oldest to newest, with the latest point filled. */
function Spark({ values }: { values: number[] }) {
  const W = 64;
  const H = 24;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i: number) => (values.length === 1 ? W / 2 : (i * W) / (values.length - 1));
  const y = (v: number) => (hi === lo ? H / 2 : H - 3 - ((v - lo) / (hi - lo)) * (H - 6));
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {values.length > 1 && <path d={d} />}
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} />
    </svg>
  );
}

/** One 1-5 series as a line, with the latest answer in words and which way is better written out. */
function Trend5({ label, kind, values, tone }: { label: string; kind: "soreness" | "energy"; values: number[]; tone: string }) {
  const W = 300;
  const H = 72;
  const px = 12;
  const py = 10;
  const n = values.length;
  const x = (i: number) => (n === 1 ? W / 2 : px + (i * (W - 2 * px)) / (n - 1));
  const y = (v: number) => py + ((5 - v) * (H - 2 * py)) / 4;
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = values[n - 1];
  const dir = direction(values);
  const phrase = dir === "flat" ? "Steady" : kind === "energy" ? (dir === "up" ? "Rising" : "Dipping") : dir === "down" ? "Easing" : "Creeping up";
  return (
    <div className="t5" style={{ "--tone": tone } as CSSProperties}>
      <div className="t5-head">
        <strong className="t-body">{label}</strong>
        <span className="t-body" style={{ color: tone, fontWeight: 800 }}>{wordFor(kind, last)} · {last} of 5</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}, 1 to 5, last ${n} sessions: ${values.join(", ")}`}>
        {[1, 2, 3, 4, 5].map((v) => (
          <line key={v} className="t5-grid" x1={px} x2={W - px} y1={y(v)} y2={y(v)} />
        ))}
        {n > 1 && <path className="t5-line" d={d} />}
        {values.map((v, i) => (
          <circle key={i} className={i === n - 1 ? "t5-now" : "t5-dot"} cx={x(i)} cy={y(v)} r={i === n - 1 ? 6 : 4} />
        ))}
      </svg>
      <div className="row between t-small c-2">
        <span>{kind === "energy" ? "Higher is better" : "Lower is better"}</span>
        <span>{phrase}</span>
      </div>
    </div>
  );
}

/** Total kg lifted per week: the plainest measure of progressive overload. More over time is the point. */
function VolumeCard({ weeks, point }: { weeks: { weekStart: string; kg: number }[]; point?: { now: number; lastSame: number; lastWeek: number } }) {
  const now = point?.now ?? weeks[weeks.length - 1].kg;
  const max = Math.max(1, ...weeks.map((w) => w.kg));
  // Like with like: this week so far against the same point of last week, never against a whole finished week.
  const pct = point && point.lastSame > 0 ? Math.round(((now - point.lastSame) / point.lastSame) * 100) : null;
  const day = (iso: string) => String(Number(iso.slice(8, 10)));
  const kg = (n: number) => `${n.toLocaleString("en-AU")} kg`;
  const from = weeks[0].weekStart;
  const to = weeks[weeks.length - 1].weekStart;
  const long = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", { timeZone: "UTC", day: "numeric", month: "short" });
  return (
    <details className="card fold" aria-label="Training volume">
      <summary>
        <h2 className="t-heading">Training volume</h2>
        <span className="t-small c-2">{kg(now)} this week</span>
      </summary>
      {pct !== null && <span className={`tag ${pct >= 0 ? "tag-accent" : ""}`} style={{ alignSelf: "flex-start" }}>{pct >= 0 ? "+" : "−"}{Math.abs(pct)}% vs same point last week</span>}
      <div className="col g1">
        <span className="num-m">{kg(now)}</span>
        <span className="t-small c-2">weight × reps so far this week{point ? `. Last week in full: ${kg(point.lastWeek)}.` : "."}</span>
      </div>
      <div className="consistency" role="img" aria-label={`Kilograms lifted per week, weeks starting ${weeks.map((w) => `${long(w.weekStart)} ${w.kg}`).join(", ")}`}>
        {weeks.map((w, i) => (
          <span key={w.weekStart} className={`consistency-col ${i === weeks.length - 1 ? "is-now" : ""}`}>
            <span className="consistency-track"><i style={{ height: `${Math.round((w.kg / max) * 100)}%` }} className={i === weeks.length - 1 ? "is-full" : ""} /></span>
            <span className="t-caption c-2 vol-day">{day(w.weekStart)}</span>
          </span>
        ))}
      </div>
      <p className="t-small c-2">Weeks start on Monday ({long(from)} to {long(to)}). Progressive overload is doing a little more over time: more weight, or more reps at the same weight. The bars are the total of both.</p>
    </details>
  );
}

/** Push against pull, front against back, upper against lower: sets over the last four weeks, so a lopsided week stands out. */
function BalanceCard({ b }: { b: Balance }) {
  const rows: { label: [string, string]; a: number; c: number }[] = [
    { label: ["Push", "Pull"], a: b.push, c: b.pull },
    { label: ["Front", "Back"], a: b.front, c: b.back },
    { label: ["Upper", "Lower"], a: b.upper, c: b.lower },
  ];
  return (
    <section className="card" aria-label="Muscle balance">
      <div className="row between baseline g2">
        <h2 className="t-heading">Muscle balance</h2>
        <span className="t-small c-2">last 4 weeks</span>
      </div>
      {!b.enough ? (
        <p className="t-small c-2">A few more sessions and this shows push against pull, front against back, and upper against lower.</p>
      ) : (
        <>
          <div className="col g3">
            {rows.map((r) => {
              const pa = Math.round(shareOf(r.a, r.c) * 100);
              return (
                <div key={r.label[0]} className="col g1" role="img" aria-label={`${r.label[0]} ${pa} percent, ${r.label[1]} ${100 - pa} percent`}>
                  <div className="row between t-small">
                    <span><strong>{r.label[0]}</strong> <span className="c-2">{pa}%</span></span>
                    <span><span className="c-2">{100 - pa}%</span> <strong>{r.label[1]}</strong></span>
                  </div>
                  <div className="bar-split" aria-hidden="true">
                    <i style={{ flex: `${Math.max(1, pa)} 1 0`, background: "var(--accent)" }} />
                    <i style={{ flex: `${Math.max(1, 100 - pa)} 1 0`, background: "var(--info)" }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="t-small c-2">{b.notes.length ? b.notes.join(" ") : "Nicely balanced. Keep it up."}</p>
        </>
      )}
    </section>
  );
}
