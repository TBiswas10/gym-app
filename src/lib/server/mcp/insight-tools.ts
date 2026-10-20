import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ServerClient } from "../../supabase/server";
import { addDays, longDay, weekDates, weekdayOf } from "../../dates";
import { fmtNum } from "../../format";
import { findExercises } from "../../parser";
import { stallCheck } from "../../progression";
import { loadProgress } from "../progress-data";
import { loadToday } from "../today-data";
import { recentSessions } from "../workout-data";
import { loadCx } from "./context";
import { errorResult, json, textResult } from "./format";

// Read-only summaries that would otherwise need several tool calls: the week against the plan, records and stalled
// lifts, and the bodyweight trend. Nothing here writes.

interface Ctx {
  supabase: ServerClient;
  uid: string;
}

const NO_PROGRAM = "The programme hasn’t been started yet. Open the app and finish setup first.";
const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const MACHINES = new Set(["bike", "treadmill", "stair", "rower", "xtrainer"]);

export function registerInsightTools(server: McpServer, { supabase, uid }: Ctx): void {
  // ---------------------------------------------------------------- get_week_summary
  server.registerTool(
    "get_week_summary",
    {
      title: "Week: plan vs actual",
      description:
        "One week against the plan: for each planned session whether it is done, in progress, skipped, moved, missed or still to do, with sets and cardio minutes done against planned. Defaults to this week; give week_of (any date in the week) for another. The plan used is your current one. Read-only.",
      inputSchema: { week_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Any date in the week, YYYY-MM-DD (default today)") },
      annotations: READ,
    },
    async ({ week_of }) => {
      const t = await loadToday(supabase, uid);
      if (!t) return errorResult(NO_PROGRAM);
      const dates = weekDates(week_of ?? t.today);
      const [wRes, cRes, oRes] = await Promise.all([
        supabase.from("workouts").select("id, planned_date, day_name, status, is_test").in("planned_date", dates).neq("status", "abandoned"),
        supabase.from("cardio_entries").select("kind, minutes, logged_on").in("logged_on", dates),
        supabase.from("schedule_overrides").select("planned_date, action, moved_to_date").in("planned_date", dates),
      ]);
      if (wRes.error || cRes.error || oRes.error) return errorResult("I couldn’t load that week. Try again in a moment.");
      const workouts = (wRes.data ?? []).filter((w) => !w.is_test);
      const setCounts = new Map<string, number>();
      if (workouts.length) {
        const { data } = await supabase.from("sets").select("workout_id").in("workout_id", workouts.map((w) => w.id));
        for (const s of data ?? []) setCounts.set(s.workout_id, (setCounts.get(s.workout_id) ?? 0) + 1);
      }

      const days = Object.values(t.days).sort((a, b) => a.weekday - b.weekday).map((d) => {
        const date = dates[d.weekday - 1];
        const w = workouts.find((x) => x.planned_date === date);
        const o = (oRes.data ?? []).find((x) => x.planned_date === date);
        const plannedSets = d.exercises.reduce((n, e) => n + e.sets, 0);
        let status: string;
        if (date < t.startDate) status = "before the programme started";
        else if (w?.status === "completed") status = "done";
        else if (w?.status === "in_progress") status = "in progress";
        else if (o?.action === "skipped") status = "skipped";
        else if (o?.action === "moved") status = `moved to ${o.moved_to_date ? `${longDay(weekdayOf(o.moved_to_date))} ${o.moved_to_date}` : "another day"}`;
        else if (date < t.today) status = "missed";
        else status = date === t.today ? "today" : "to do";
        return {
          date, day: longDay(d.weekday), session: d.fullName, status,
          light: o?.action === "light" || undefined,
          sets: `${w ? setCounts.get(w.id) ?? 0 : 0}/${plannedSets}`,
          planned_cardio: `${d.cardioName} (${d.cardioLabel})`,
        };
      });

      const counted = days.filter((d) => d.status !== "before the programme started");
      const machineMin = (cRes.data ?? []).filter((c) => MACHINES.has(c.kind)).reduce((n, c) => n + c.minutes, 0);
      const otherMin = (cRes.data ?? []).filter((c) => !MACHINES.has(c.kind)).reduce((n, c) => n + c.minutes, 0);
      const plannedSets = Object.values(t.days).reduce((n, d) => n + d.exercises.reduce((m, e) => m + e.sets, 0), 0);
      return textResult(json({
        week_starting: dates[0],
        programme_week: week_of ? undefined : `${t.week} of 12`,
        sessions: `${counted.filter((d) => d.status === "done").length}/${counted.length} done`,
        sets: `${[...setCounts.values()].reduce((a, b) => a + b, 0)}/${plannedSets} logged`,
        cardio_minutes: { machine: `${machineMin}/${Object.values(t.days).reduce((n, d) => n + d.cardioMinutes, 0)} planned`, walks_and_stretches: otherMin },
        missed: counted.filter((d) => d.status === "missed").map((d) => `${d.day} ${d.session}`),
        still_to_do: counted.filter((d) => d.status === "to do" || d.status === "today" || d.status === "in progress").map((d) => `${d.day} ${d.session}`),
        days,
      }));
    },
  );

  // ---------------------------------------------------------------- get_records
  server.registerTool(
    "get_records",
    {
      title: "Records and stalled lifts",
      description:
        "All-time best per exercise (heaviest weight, then most reps at it; longest hold; most bodyweight reps; swapped sets are ignored) and the lifts that have stalled: the same weight for 3 sessions without both sets reaching the top of the rep range, with the advice. Optionally one exercise. Read-only.",
      inputSchema: { exercise: z.string().max(60).optional().describe("Only this exercise, e.g. 'leg press'") },
      annotations: READ,
    },
    async ({ exercise }) => {
      const cx = await loadCx(supabase);
      const t = await loadToday(supabase, uid);
      if (!cx || !t) return errorResult(NO_PROGRAM);
      let only: string | null = null;
      if (exercise) {
        const m = findExercises(exercise, cx.catalog);
        if (m.length !== 1) return errorResult(m.length === 0 ? `I don’t know an exercise called “${exercise}”.` : `“${exercise}” could be: ${m.map((x) => x.name).join(", ")}. Which one?`);
        only = m[0].slug;
      }
      const p = await loadProgress(supabase);
      const nameOf = (slug: string) => cx.exercises.get(slug)?.name ?? slug;
      const records = p.records.filter((r) => !only || r.name === nameOf(only));

      // Stalls are advice for the lifts in your plan; weeks 1-2 are for finding weights so none are raised.
      const stalled: { exercise: string; problem: string; tip: string }[] = [];
      if (!cx.setup) {
        const { data: recent } = await supabase.from("workouts").select("id").eq("status", "completed").order("planned_date", { ascending: false }).limit(12);
        const order = (recent ?? []).map((r) => r.id);
        if (order.length) {
          const { data: sets } = await supabase.from("sets").select("workout_id, exercise_slug, set_number, weight_kg, reps, seconds, variant").in("workout_id", order);
          const usable = (sets ?? []).filter((s) => !s.variant);
          const bySlug = recentSessions(usable, order, 3);
          const seen = new Set<string>();
          for (const d of Object.values(t.days)) {
            for (const e of d.exercises) {
              if (seen.has(e.slug) || (only && e.slug !== only)) continue;
              seen.add(e.slug);
              const info = cx.exercises.get(e.slug);
              const s = stallCheck({ kind: e.kind, repLo: e.repLo, repHi: e.repHi, step: info?.step ?? 2.5 }, bySlug[e.slug] ?? []);
              if (s) stalled.push({ exercise: e.name, problem: s.title, tip: s.tip });
            }
          }
        }
      }
      if (only && !records.length && !stalled.length) return textResult(`No logged sessions yet for ${nameOf(only)}.`);
      return textResult(json({ records: records.map((r) => `${r.name}: ${r.text}`), stalled: stalled.length ? stalled : "none" }));
    },
  );

  // ---------------------------------------------------------------- get_app_errors
  server.registerTool(
    "get_app_errors",
    {
      title: "Errors the app hit on your phone",
      description:
        "Errors the phone reported (a screen that crashed, a failed action), grouped by message with how often, when last, on which screen, and which build. Use it to diagnose \"the app glitched\". Read-only. Network blips are not logged.",
      inputSchema: { days: z.number().int().min(1).max(60).default(7).describe("How many days back (default 7)") },
      annotations: READ,
    },
    async ({ days }) => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await supabase.from("client_errors").select("message, stack, path, build, agent, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(200);
      if (error) return errorResult("I couldn’t read the error log. Try again in a moment.");
      if (!data?.length) return textResult(`No errors reported in the last ${days} days.`);
      const groups = new Map<string, { count: number; last: string; path: string; build: string; agent: string; stack: string | null }>();
      for (const r of data) {
        const g = groups.get(r.message);
        if (g) g.count++;
        else groups.set(r.message, { count: 1, last: r.created_at, path: r.path, build: r.build, agent: r.agent, stack: r.stack });
      }
      return textResult(
        json({
          total: data.length,
          errors: [...groups].map(([message, g]) => ({ message, times: g.count, last_seen: g.last, screen: g.path, build: g.build.slice(0, 7), device: g.agent, stack_top: g.stack ? g.stack.split("\n").slice(0, 4).join("\n") : undefined })),
        }),
      );
    },
  );

  // ---------------------------------------------------------------- get_bodyweight
  server.registerTool(
    "get_bodyweight",
    {
      title: "Bodyweight trend",
      description: "Bodyweight check-ins (kg): every entry, the latest, the change since the first and over the last 4 weeks, and weekly averages. Read-only.",
      inputSchema: { days: z.number().int().min(7).max(365).default(90).describe("How many days back (default 90)") },
      annotations: READ,
    },
    async ({ days }) => {
      const cx = await loadCx(supabase);
      if (!cx) return errorResult(NO_PROGRAM);
      const since = addDays(cx.today, -days);
      const { data, error } = await supabase.from("checkins").select("checked_on, bodyweight_kg").not("bodyweight_kg", "is", null).gte("checked_on", since).order("checked_on", { ascending: true });
      if (error) return errorResult("I couldn’t load bodyweight. Try again in a moment.");
      const rows = (data ?? []).map((r) => ({ date: r.checked_on, kg: Number(r.bodyweight_kg) }));
      if (!rows.length) return textResult(`No bodyweight check-ins in the last ${days} days. Add one with log_checkin (bodyweight_kg).`);

      const first = rows[0];
      const latest = rows[rows.length - 1];
      const monthAgo = addDays(cx.today, -28);
      const base = [...rows].reverse().find((r) => r.date <= monthAgo) ?? null;
      const round = (n: number) => Math.round(n * 10) / 10;
      const weeks = new Map<string, number[]>();
      for (const r of rows) {
        const mon = weekDates(r.date)[0];
        weeks.set(mon, [...(weeks.get(mon) ?? []), r.kg]);
      }
      return textResult(json({
        entries: rows.map((r) => `${r.date}: ${fmtNum(r.kg)} kg`),
        latest: `${fmtNum(latest.kg)} kg on ${latest.date}`,
        change_since_first: rows.length > 1 ? `${round(latest.kg - first.kg) > 0 ? "+" : ""}${fmtNum(round(latest.kg - first.kg))} kg since ${first.date}` : "only one entry",
        change_last_4_weeks: base ? `${round(latest.kg - base.kg) > 0 ? "+" : ""}${fmtNum(round(latest.kg - base.kg))} kg since ${base.date}` : "not enough history yet",
        weekly_average_kg: [...weeks].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([week_starting, v]) => ({ week_starting, kg: round(v.reduce((a, b) => a + b, 0) / v.length) })),
      }));
    },
  );
}
