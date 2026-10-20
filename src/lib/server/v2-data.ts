import type { ServerClient } from "../supabase/server";
import { addDays, weekdayOf } from "../dates";
import { buildBriefing, type Briefing } from "../briefing";
import { goalProgress, goalUnit, recordNumber, type GoalUnit } from "../goals";
import { computeNudges, type Nudge } from "../nudges";
import { estimateMinutes, type ExerciseKind } from "../plan";
import { goalText, stallCheck } from "../progression";
import { records } from "../stats";
import { loadCx, overloadFor, suggestionFor, type Cx } from "./mcp/context";
import { cardioLine, nextLine } from "./mcp/format";
import type { TodayData } from "./today-data";
import { recentSessions } from "./workout-data";

// Everything the v2 features need from the database: the Today briefing, plan nudges, goals and weekly reviews.
// Each loader is independent and the Today page treats a failure as "no extras", never as a broken screen.

const kindOf = (k: string): ExerciseKind => (k === "timed" || k === "bodyweight" ? k : "weight");

export interface GoalView {
  id: string;
  slug: string;
  name: string;
  unit: GoalUnit;
  start: number;
  current: number;
  target: number;
  fraction: number;
  toGo: number;
  reached: boolean;
}

export interface ReviewView {
  id: string;
  weekStart: string;
  headline: string;
  wins: string[];
  watch: string[];
  nextWeek: string[];
  createdAt: string;
}

export interface V2Today {
  /** slug -> a short "last time" like "30 kg" or "40 s" */
  lasts?: Record<string, string>;
  /** slug -> today's goal, e.g. "30 kg × 11" (what to aim for to beat last time) */
  goals?: Record<string, string>;
  briefing: Briefing | null;
  nudges: Nudge[];
  review: ReviewView | null;
}

/** Your goals with the best number you have logged so far for each. */
export async function loadGoals(supabase: ServerClient): Promise<GoalView[]> {
  const { data: rows } = await supabase.from("goals").select("id, exercise_slug, target, start_value, exercises(name, kind)").order("created_at");
  if (!rows?.length) return [];
  const slugs = rows.map((r) => r.exercise_slug);
  const { data: done } = await supabase.from("workouts").select("id").eq("status", "completed").eq("is_test", false);
  const ids = (done ?? []).map((w) => w.id);
  let sets: { workout_id: string; exercise_slug: string; set_number: number; weight_kg: number | null; reps: number | null; seconds: number | null; variant: string | null }[] = [];
  if (ids.length) {
    const { data } = await supabase.from("sets").select("workout_id, exercise_slug, set_number, weight_kg, reps, seconds, variant").in("workout_id", ids).in("exercise_slug", slugs);
    sets = data ?? [];
  }
  const kinds: Record<string, ExerciseKind> = {};
  for (const r of rows) kinds[r.exercise_slug] = kindOf((r.exercises as unknown as { kind: string }).kind);
  const best = new Map(records(sets, kinds).map((r) => [r.slug, r.value]));
  return rows.map((r) => {
    const ex = r.exercises as unknown as { name: string; kind: string };
    const kind = kindOf(ex.kind);
    const current = best.has(r.exercise_slug) ? recordNumber(kind, best.get(r.exercise_slug)!) : 0;
    const start = Number(r.start_value);
    const target = Number(r.target);
    const p = goalProgress(start, current, target);
    return { id: r.id, slug: r.exercise_slug, name: ex.name, unit: goalUnit(kind), start, current, target, fraction: p.fraction, toGo: p.toGo, reached: p.reached };
  });
}

export async function loadReviews(supabase: ServerClient, limit = 8): Promise<ReviewView[]> {
  const { data } = await supabase.from("coach_reviews").select("id, week_start, headline, wins, watch, next_week, created_at").order("week_start", { ascending: false }).limit(limit);
  return (data ?? []).map((r) => ({ id: r.id, weekStart: r.week_start, headline: r.headline, wins: r.wins, watch: r.watch, nextWeek: r.next_week, createdAt: r.created_at }));
}

/** Lifts in your plan that have sat at the same weight for 3 sessions without ever hitting the top of the range. */
async function loadStalls(supabase: ServerClient, cx: Cx, t: TodayData) {
  const { data: recent } = await supabase.from("workouts").select("id").eq("status", "completed").eq("is_test", false).order("planned_date", { ascending: false }).limit(12);
  const order = (recent ?? []).map((r) => r.id);
  if (!order.length) return [];
  const { data: sets } = await supabase.from("sets").select("workout_id, exercise_slug, set_number, weight_kg, reps, seconds, variant").in("workout_id", order);
  const bySlug = recentSessions((sets ?? []).filter((s) => !s.variant), order, 3);
  const seen = new Set<string>();
  const out: { slug: string; name: string; title: string; tip: string; smallKg: number }[] = [];
  for (const d of Object.values(t.days)) {
    for (const e of d.exercises) {
      if (seen.has(e.slug)) continue;
      seen.add(e.slug);
      const step = cx.exercises.get(e.slug)?.step ?? 2.5;
      const s = stallCheck({ kind: e.kind, repLo: e.repLo, repHi: e.repHi, step }, bySlug[e.slug] ?? []);
      if (s) out.push({ slug: e.slug, name: e.name, title: s.title, tip: s.tip, smallKg: step > 1 ? 1 : step });
    }
  }
  return out;
}

/** The queries that do not depend on Today's data. Start them first so they run while Today loads. */
export function startV2Today(supabase: ServerClient) {
  // Reduce each query to { data } and never throw: Today works without the extras.
  const quiet = async <D,>(p: PromiseLike<{ data: D }>, fallback: D): Promise<{ data: D }> => {
    try {
      const r = await p;
      return { data: r.data ?? fallback };
    } catch {
      return { data: fallback };
    }
  };
  return {
    cx: loadCx(supabase).catch(() => null),
    feel: quiet(supabase.from("checkins").select("soreness, energy").order("created_at", { ascending: false }).limit(3), [] as { soreness: number | null; energy: number | null }[]),
    cardio: quiet(supabase.from("cardio_entries").select("kind, minutes, feel, params").not("kind", "in", "(walk,stretch)").order("logged_at", { ascending: false }).limit(1).maybeSingle(), null),
    answered: quiet(supabase.from("nudge_responses").select("key"), [] as { key: string }[]),
    goals: loadGoals(supabase).catch(() => [] as GoalView[]),
    reviews: loadReviews(supabase, 1).catch(() => [] as ReviewView[]),
  };
}

export async function loadV2Today(supabase: ServerClient, t: TodayData, pre: ReturnType<typeof startV2Today> = startV2Today(supabase)): Promise<V2Today> {
  const cx = await pre.cx;
  if (!cx) return { briefing: null, nudges: [], review: null };

  const [feelRes, cardioRes, answeredRes, goals, reviews, stalls] = await Promise.all([
    pre.feel,
    pre.cardio,
    pre.answered,
    pre.goals,
    pre.reviews,
    loadStalls(supabase, cx, t).catch(() => []),
  ]);
  const feel = (feelRes.data ?? []).map((f) => ({ soreness: f.soreness, energy: f.energy }));

  // Today's briefing: only when there is a session to do today.
  const today = t.strip.find((d) => d.date === t.today);
  const plan = today?.sessionOrigin ? t.days[weekdayOf(today.sessionOrigin)] : null;
  let briefing: Briefing | null = null;
  if (plan && today && (today.status === "today" || today.status === "light")) {
    const open = goals.filter((g) => !g.reached).sort((a, b) => b.fraction - a.fraction)[0];
    briefing = buildBriefing({
      sessionName: plan.fullName,
      minutes: estimateMinutes(plan.exercises.map((e) => e.kind), plan.cardioMinutes, today.light),
      light: today.light,
      setup: t.setup,
      deload: t.inDeload,
      highSoreness: t.highSoreness,
      lifts: plan.exercises.map((e) => {
        const s = suggestionFor(cx, e.slug, [e.repLo, e.repHi]);
        const o = overloadFor(cx, e.slug, [e.repLo, e.repHi]);
        return { name: e.name, next: nextLine(e.kind, s.suggestion), up: s.suggestion.action === "up", first: !s.last, kind: o.kind, goal: goalText(e.kind, o) || undefined };
      }),
      cardio: { plan: plan.cardioName, label: plan.cardioLabel, last: cardioRes.data ? cardioLine(cardioRes.data) : null },
      feel: feel[0] ?? null,
      goal: open ? { name: open.name, toGo: `${open.toGo} ${open.unit}` } : null,
    });
  }

  // Last time, short, for every lift in the plan (shown on Today's list).
  const lasts: Record<string, string> = {};
  const goalMap: Record<string, string> = {};
  for (const d of Object.values(t.days)) {
    for (const e of d.exercises) {
      const l = cx.lastBySlug[e.slug];
      if (!l) continue;
      const g = goalText(e.kind, overloadFor(cx, e.slug, [e.repLo, e.repHi]));
      if (g) goalMap[e.slug] = g;
      lasts[e.slug] = e.kind === "timed" ? `${Math.max(...l.secs, 0)} s` : l.kg ? `${l.kg} kg` : l.reps.length ? `${Math.max(...l.reps)} reps` : "";
    }
  }

  // Nudges: the next session still to do, and whether it is already a light one.
  const next = t.strip.find((d) => d.sessionOrigin && d.date >= t.today && d.status !== "done" && d.status !== "skipped");
  const answered = new Set((answeredRes.data ?? []).map((r) => r.key));
  const nudges = computeNudges({
    week: t.week,
    setup: t.setup,
    inDeload: t.inDeload,
    deloadSuggested: t.deloadSuggested,
    stalls,
    feel,
    nextSession: next?.date ?? null,
    nextSessionLight: !!next?.light,
    answered,
  });

  // The latest weekly review, while it is fresh (written for this week or last).
  const latest = reviews[0];
  const review = latest && latest.weekStart >= addDays(t.today, -13) ? latest : null;

  return { lasts, goals: goalMap, briefing, nudges, review };
}
