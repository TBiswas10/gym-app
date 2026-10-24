import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ServerClient } from "../../supabase/server";
import { addDays, longDay, weekDates, weekdayOf } from "../../dates";
import { fmtNum } from "../../format";
import { findExercises } from "../../parser";
import { estimateMinutes, formatTarget } from "../../plan";
import { isPB, verdict } from "../../progression";
import { cleanParams, isMachine, machineById, machineLabel, type MachineId } from "../../cardio";
import type { Op } from "../../ops";
import { checkInDue, nextCheckIn } from "../../stats";
import { applyOps } from "../apply-ops";
import { loadProgress } from "../progress-data";
import { loadReview } from "../review-data";
import { loadToday } from "../today-data";
import { startSession } from "../workout-data";
import { loadCx, overloadFor, reasonText, suggestionFor, type Cx } from "./context";
import { registerCoachTools } from "./coach-tools";
import { registerInsightTools } from "./insight-tools";
import { registerTrainerTools } from "./trainer-tools";
import { registerMoreTools } from "./more-tools";
import { registerPowerTools } from "./power-tools";
import { cardioLine, cardioSettings, errorResult, json, lastTimeLine, nextLine, setLine, textResult } from "./format";
import { goalText } from "../../progression";

export interface McpContext {
  supabase: ServerClient;
  uid: string;
  clientId: string;
}

const FRIENDLY = "That didn’t save. Try again in a moment.";
const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const WRITE = (idempotent: boolean) => ({ readOnlyHint: false, destructiveHint: false, idempotentHint: idempotent, openWorldHint: false }) as const;

async function needCx(ctx: McpContext): Promise<Cx | null> {
  return loadCx(ctx.supabase);
}
const NO_PROGRAM = "The programme hasn’t been started yet. Open the app and finish setup first.";

/** The session in progress, or null. */
async function activeWorkout(supabase: ServerClient) {
  const { data } = await supabase.from("workouts").select("id, weekday, planned_date, day_name, is_light, status, week").eq("status", "in_progress").maybeSingle();
  return data;
}

export function registerTools(server: McpServer, ctx: McpContext): void {
  const { supabase, uid } = ctx;
  registerMoreTools(server, { supabase, uid });
  registerPowerTools(server, { supabase, uid });
  registerInsightTools(server, { supabase, uid });
  registerCoachTools(server, { supabase, uid });
  registerTrainerTools(server, { supabase, uid });

  // ------------------------------------------------------------------ get_today_workout
  server.registerTool(
    "get_today_workout",
    {
      title: "Today's workout",
      description: "Today's planned session in Australia/Sydney time: status, exercises with targets, last-time numbers and what to lift next, cardio, and any notes (deload week, high soreness, check-in ready). Read-only.",
      annotations: READ,
    },
    async () => {
      const cx = await needCx(ctx);
      const t = await loadToday(supabase, uid);
      if (!cx || !t) return errorResult(NO_PROGRAM);
      const d = t.strip.find((x) => x.date === t.today)!;
      const plan = d.sessionOrigin ? t.days[weekdayOf(d.sessionOrigin)] : null;
      const active = await activeWorkout(supabase);
      const { data: lastC } = await supabase.from("cardio_entries").select("kind, minutes, feel, params, logged_on").not("kind", "in", "(walk,stretch)").order("logged_at", { ascending: false }).limit(1).maybeSingle();

      const session = plan && {
        name: plan.fullName + (d.movedIn ? " (moved)" : ""),
        status: d.status,
        light_day: d.light,
        estimated_minutes: estimateMinutes(plan.exercises.map((e) => e.kind), plan.cardioMinutes, d.light),
        exercises: plan.exercises.map((e) => {
          const s = suggestionFor(cx, e.slug, [e.repLo, e.repHi]);
          const o = overloadFor(cx, e.slug, [e.repLo, e.repHi]);
          return { exercise: e.name, slug: e.slug, target: formatTarget(e.sets, e.repLo, e.repHi, e.kind), last_time: lastTimeLine(e.kind, s.last), next: nextLine(e.kind, s.suggestion), goal_today: goalText(e.kind, o) || undefined, goal_why: o.note };
        }),
        cardio: { plan: plan.cardioName, length: plan.cardioLabel, last_time: lastC ? `${cardioLine(lastC)} on ${lastC.logged_on}` : null },
      };
      const notes: string[] = [];
      if (t.setup) notes.push("Setup weeks 1-2: find your weights; no weight increases yet.");
      if (t.inDeload) notes.push("Deload week: half the sets, same weights.");
      if (t.highSoreness) notes.push("Soreness has been 4-5 for three sessions: hold weights or go light.");
      if (t.checkIn) notes.push(`Week ${t.checkIn} check-in is ready (use get_review).`);
      if (t.missed?.state === "ask") notes.push("A session this week was missed and has not been handled in the app.");

      return textResult(json({
        date: t.today, weekday: longDay(weekdayOf(t.today)), programme_week: `${t.week} of 12`, plan: t.planType === "5day" ? "5-day split" : "3-day full body",
        session: session ?? (d.status === "rest" ? "Rest day" : d.status),
        session_in_progress: active ? { started_at: active.planned_date, name: active.day_name } : null,
        notes,
      }));
    },
  );

  // ------------------------------------------------------------------ get_history
  server.registerTool(
    "get_history",
    {
      title: "Workout history",
      description: "Recent workouts with sets, cardio and soreness/energy check-ins, newest first. Optionally filter to one exercise. Read-only.",
      inputSchema: {
        days: z.number().int().min(1).max(90).default(14).describe("How many days back (default 14)"),
        exercise: z.string().max(60).optional().describe("Only this exercise, e.g. 'chest press'"),
      },
      annotations: READ,
    },
    async ({ days, exercise }) => {
      const cx = await needCx(ctx);
      if (!cx) return errorResult(NO_PROGRAM);
      let only: string | null = null;
      if (exercise) {
        const m = findExercises(exercise, cx.catalog);
        if (m.length !== 1) return errorResult(m.length === 0 ? `I don’t know an exercise called “${exercise}”.` : `“${exercise}” could be: ${m.map((x) => x.name).join(", ")}. Which one?`);
        only = m[0].slug;
      }
      const since = addDays(cx.today, -days);
      const { data: workouts, error } = await supabase.from("workouts").select("id, planned_date, day_name, status, week, is_light").gte("planned_date", since).neq("status", "abandoned").order("planned_date", { ascending: false }).limit(40);
      if (error) return errorResult(FRIENDLY);
      const ids = (workouts ?? []).map((w) => w.id);
      if (!ids.length) return textResult(`No workouts in the last ${days} days.`);
      const [sets, cardio, checkins] = await Promise.all([
        supabase.from("sets").select("workout_id, exercise_slug, set_number, variant, weight_kg, reps, seconds").in("workout_id", ids).order("set_number"),
        supabase.from("cardio_entries").select("workout_id, kind, minutes, feel, params").in("workout_id", ids),
        supabase.from("checkins").select("workout_id, soreness, energy, notes, bodyweight_kg").in("workout_id", ids),
      ]);
      const out = (workouts ?? []).map((w) => {
        const mine = (sets.data ?? []).filter((s) => s.workout_id === w.id && (!only || s.exercise_slug === only));
        const bySlug = new Map<string, typeof mine>();
        for (const s of mine) bySlug.set(s.exercise_slug, [...(bySlug.get(s.exercise_slug) ?? []), s]);
        const cs = (cardio.data ?? []).filter((x) => x.workout_id === w.id);
        const k = checkins.data?.find((x) => x.workout_id === w.id);
        return {
          date: w.planned_date, session: w.day_name, status: w.status, week: w.week, light: w.is_light || undefined,
          exercises: [...bySlug].map(([slug, rows]) => {
            const info = cx.exercises.get(slug)!;
            return { exercise: info.name, swapped_to: rows[0].variant ?? undefined, sets: rows.map((r) => setLine(info.kind, r)) };
          }),
          cardio: only || !cs.length ? undefined : cs.map(cardioLine).join("; "),
          checkin: only ? undefined : k ? { soreness: k.soreness, energy: k.energy, bodyweight_kg: k.bodyweight_kg, notes: k.notes } : undefined,
        };
      });
      return textResult(json(only ? out.filter((o) => o.exercises.length) : out));
    },
  );

  // ------------------------------------------------------------------ log_sets
  server.registerTool(
    "log_sets",
    {
      title: "Log sets",
      description: "Log or correct the sets of ONE exercise in today's session (up to the plan's 2 sets). Weighted lifts need weight_kg and reps; bodyweight lifts need reps; planks need seconds. Weights are kilograms. Starts today's session if it isn't started. Replaces sets with the same number; never deletes. Returns what changed.",
      inputSchema: {
        exercise: z.string().min(2).max(60).describe("Exercise name, e.g. 'lat pulldown'"),
        sets: z.array(z.object({
          weight_kg: z.number().min(0).max(400).optional(),
          reps: z.number().int().min(1).max(100).optional(),
          seconds: z.number().int().min(1).max(3600).optional(),
        })).min(1).max(2).describe("Set 1, then set 2"),
        swapped_to: z.string().min(2).max(60).optional().describe("Did the swap instead (machine busy)? Give the exercise you actually did, or 'backup' for the plan's backup. Swapped sets are kept out of progression, like a swap in the app. Leave out to keep how it was."),
      },
      annotations: WRITE(true),
    },
    async ({ exercise, sets, swapped_to }) => {
      const cx = await needCx(ctx);
      if (!cx) return errorResult(NO_PROGRAM);
      const matches = findExercises(exercise, cx.catalog);
      if (matches.length === 0) return errorResult(`I don’t know an exercise called “${exercise}”. Known: ${cx.catalog.map((c) => c.name).join(", ")}.`);
      if (matches.length > 1) return errorResult(`“${exercise}” could be ${matches.map((m) => m.name).join(" or ")}. Which one did you mean? Nothing was logged.`);
      const info = cx.exercises.get(matches[0].slug)!;

      for (const [i, s] of sets.entries()) {
        if (info.kind === "timed" && !s.seconds) return errorResult(`${info.name} is timed: give seconds for set ${i + 1}.`);
        if (info.kind !== "timed" && !s.reps) return errorResult(`Give reps for set ${i + 1} of ${info.name}.`);
        if (info.kind === "weight" && s.weight_kg === undefined) return errorResult(`Give weight_kg for set ${i + 1} of ${info.name} (kilograms).`);
        if (info.kind === "timed" && (s.reps || s.weight_kg)) return errorResult(`${info.name} is timed: use seconds only.`);
      }

      // Find or start today's session.
      let workout = await activeWorkout(supabase);
      if (!workout) {
        const t = await loadToday(supabase, uid);
        const d = t?.strip.find((x) => x.date === t.today);
        if (!t || !d?.sessionOrigin || !(d.status === "today" || d.status === "light")) {
          return errorResult("There’s no session to start today (rest day, or it’s already done). Nothing was logged.");
        }
        const { data: tpl } = await supabase.from("program_templates").select("id").eq("user_id", uid).eq("plan_type", t.planType).maybeSingle();
        if (!tpl) return errorResult(NO_PROGRAM);
        const created = await startSession(supabase, { startDate: t.startDate, planType: t.planType, templateId: tpl.id, week: t.week, today: t.today }, d.sessionOrigin);
        if (!created) return errorResult("Couldn’t start today’s session. Start it in the app and try again.");
        workout = created;
      }

      // Where it sits in the plan, and how many sets the plan has.
      const { data: tex } = await supabase.from("template_exercises").select("exercise_slug, position, sets, template_id").eq("weekday", workout.weekday).order("position");
      const { data: tpl2 } = await supabase.from("program_templates").select("id").eq("user_id", uid).eq("plan_type", cx.state.planType).maybeSingle();
      const rows = (tex ?? []).filter((r) => r.template_id === tpl2?.id);
      const inPlan = rows.find((r) => r.exercise_slug === info.slug);
      const deload = cx.state.deloadWeeks.includes(cx.week);
      const planned = inPlan ? (deload ? Math.max(1, Math.ceil(inPlan.sets / 2)) : inPlan.sets) : 2;
      if (sets.length > planned) return errorResult(`${info.name} has ${planned} ${planned === 1 ? "set" : "sets"} in the plan${deload ? " this deload week" : ""}. You gave ${sets.length}. Nothing was logged.`);
      const position = inPlan ? inPlan.position : 100;

      const { data: before } = await supabase.from("sets").select("set_number, weight_kg, reps, seconds, variant").eq("workout_id", workout.id).eq("exercise_slug", info.slug).order("set_number");
      // A swap sticks: sets already logged as the backup stay that way unless swapped_to says otherwise.
      let variant: string | null = before?.find((b) => b.variant)?.variant ?? null;
      if (swapped_to !== undefined) {
        if (swapped_to.trim().toLowerCase() === "backup") {
          const { data: ex } = await supabase.from("exercises").select("backup_name").eq("slug", info.slug).maybeSingle();
          variant = ex?.backup_name ?? "a similar exercise";
        } else if (swapped_to.trim().toLowerCase() === info.name.toLowerCase()) {
          variant = null;
        } else {
          variant = swapped_to.trim();
        }
      }
      const ops: Op[] = sets.map((s, i) => ({
        t: "set", id: randomUUID(), workoutId: workout!.id, slug: info.slug, position, n: i + 1, variant,
        kg: info.kind === "timed" ? null : (s.weight_kg ?? 0), reps: info.kind === "timed" ? null : (s.reps ?? null), secs: info.kind === "timed" ? (s.seconds ?? null) : null, source: "mcp",
      }));
      const res = await applyOps(supabase, ops);
      if (res.retry || res.dropped) return errorResult(FRIENDLY);

      const { data: after } = await supabase.from("sets").select("set_number, weight_kg, reps, seconds").eq("workout_id", workout.id).eq("exercise_slug", info.slug).order("set_number");
      const changes = sets.map((s, i) => {
        const was = before?.find((b) => b.set_number === i + 1);
        const now = setLine(info.kind, { weight_kg: s.weight_kg ?? 0, reps: s.reps ?? null, seconds: s.seconds ?? null });
        return `Set ${i + 1}: ${now}${was ? ` (replaced ${setLine(info.kind, was)})` : " (new)"}`;
      });
      const all = (after ?? []).map((r) => ({ kg: r.weight_kg, reps: r.reps, secs: r.seconds }));
      const spec = { kind: info.kind, repLo: inPlan ? info.repLo : info.repLo, repHi: info.repHi, step: info.step, increment: cx.increments.get(info.slug) ?? info.defaultIncrement };
      const lines = [`${info.name}${variant ? ` (swapped to ${variant})` : ""} logged for ${workout.day_name} (${workout.planned_date}).`, ...changes];
      if ((after ?? []).length < planned) lines.push(`${planned - (after ?? []).length} more ${planned - (after ?? []).length === 1 ? "set" : "sets"} to go.`);
      if ((after ?? []).length >= planned && planned === 2) {
        const v = verdict(spec, all, { setup: cx.setup, highSoreness: cx.highSoreness, hold: cx.hold });
        lines.push(`${v.title}. ${v.sub}`);
      }
      if (!variant && isPB(info.kind, cx.lastBySlug[info.slug] ?? null, all)) lines.push("That’s a personal best versus last time.");
      return textResult(lines.join("\n"));
    },
  );

  // ------------------------------------------------------------------ get_cardio
  server.registerTool(
    "get_cardio",
    {
      title: "Cardio history and totals",
      description: "Cardio entries (machine, minutes, the numbers you set on it, how it felt, which session) with a per-machine summary and minutes per week. Includes rest-day walks and stretches. Optionally filter to one machine. Read-only.",
      inputSchema: {
        days: z.number().int().min(1).max(180).default(30).describe("How many days back (default 30)"),
        machine: z.enum(["bike", "treadmill", "stair", "rower", "xtrainer", "walk", "stretch"]).optional(),
      },
      annotations: READ,
    },
    async ({ days, machine }) => {
      const cx = await needCx(ctx);
      if (!cx) return errorResult(NO_PROGRAM);
      const since = addDays(cx.today, -days);
      let q = supabase.from("cardio_entries").select("kind, minutes, feel, params, logged_on, workout_id").gte("logged_on", since).order("logged_on", { ascending: false }).order("logged_at", { ascending: false }).limit(200);
      if (machine) q = q.eq("kind", machine);
      const { data, error } = await q;
      if (error) return errorResult(FRIENDLY);
      const rows = data ?? [];
      if (!rows.length) return textResult(`No ${machine ?? "cardio"} entries in the last ${days} days.`);

      const wids = [...new Set(rows.map((r) => r.workout_id).filter((x): x is string => !!x))];
      const names = new Map<string, string>();
      if (wids.length) {
        const { data: ws } = await supabase.from("workouts").select("id, day_name").in("id", wids);
        for (const w of ws ?? []) names.set(w.id, w.day_name);
      }

      const byMachine = new Map<string, typeof rows>();
      for (const r of rows) byMachine.set(r.kind, [...(byMachine.get(r.kind) ?? []), r]);
      const summary = [...byMachine].map(([kind, rs]) => ({
        machine: kind,
        sessions: rs.length,
        total_minutes: rs.reduce((a, r) => a + r.minutes, 0),
        average_minutes: Math.round(rs.reduce((a, r) => a + r.minutes, 0) / rs.length),
        longest_minutes: Math.max(...rs.map((r) => r.minutes)),
        latest: { date: rs[0].logged_on, minutes: rs[0].minutes, feel: rs[0].feel ?? undefined, settings: cardioSettings(kind, rs[0].params) },
      }));

      const weeks = new Map<string, number>();
      for (const r of rows) {
        const monday = weekDates(r.logged_on)[0];
        weeks.set(monday, (weeks.get(monday) ?? 0) + r.minutes);
      }
      return textResult(json({
        days,
        entries: rows.map((r) => ({
          date: r.logged_on, machine: r.kind, minutes: r.minutes, feel: r.feel ?? undefined,
          settings: cardioSettings(r.kind, r.params),
          session: r.workout_id ? names.get(r.workout_id) ?? "workout" : "outside a workout (rest day)",
        })),
        by_machine: summary,
        minutes_per_week: [...weeks].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([week_starting, minutes]) => ({ week_starting, minutes })),
      }));
    },
  );

  // ------------------------------------------------------------------ log_cardio
  server.registerTool(
    "log_cardio",
    {
      title: "Log cardio",
      description: "Log a cardio block (bike, treadmill, stair, rower, xtrainer) or a rest-day walk or stretch. Attaches to the session in progress when there is one. Replaces an earlier entry of the same kind for the same session/day; never deletes. Returns what changed.",
      inputSchema: {
        machine: z.enum(["bike", "treadmill", "stair", "rower", "xtrainer", "walk", "stretch"]),
        minutes: z.number().int().min(1).max(180),
        settings: z.record(z.string(), z.number().min(0).max(1000)).optional().describe("Machine numbers, e.g. {resistance: 5} uses keys res, rpm / speed, incline / level / damper, spm"),
        feel: z.enum(["easy", "moderate", "hard"]).optional(),
      },
      annotations: WRITE(true),
    },
    async ({ machine, minutes, settings, feel }) => {
      const cx = await needCx(ctx);
      if (!cx) return errorResult(NO_PROGRAM);
      let params: Record<string, number> = {};
      if (isMachine(machine)) {
        const allowed = new Set(machineById(machine as MachineId).params.map((p) => p.k));
        const bad = Object.keys(settings ?? {}).filter((k) => !allowed.has(k) && k !== "min");
        if (bad.length) return errorResult(`${machineLabel(machine as MachineId)} settings can only use: ${[...allowed].join(", ")}. Not: ${bad.join(", ")}.`);
        params = cleanParams(machine as MachineId, { ...(settings ?? {}), min: minutes });
      }
      const workout = isMachine(machine) ? await activeWorkout(supabase) : null;

      let q = supabase.from("cardio_entries").select("id, minutes").eq("kind", machine);
      q = workout ? q.eq("workout_id", workout.id) : q.is("workout_id", null).eq("logged_on", cx.today);
      const { data: existing } = await q.limit(1);
      const prev = existing?.[0];

      const op: Op = { t: "cardio", id: prev?.id ?? randomUUID(), workoutId: workout?.id ?? null, kind: machine, minutes, params, feel: feel ?? null, loggedOn: cx.today };
      const res = await applyOps(supabase, [op]);
      if (res.retry || res.dropped) return errorResult(FRIENDLY);
      const what = isMachine(machine) ? `${minutes} min on the ${machineLabel(machine as MachineId).toLowerCase()}` : `${minutes} min ${machine}`;
      return textResult(`Logged ${what}${feel ? ` (${feel})` : ""}${workout ? ` for ${workout.day_name}` : ` for ${cx.today}`}.${prev ? ` Replaced the earlier entry (${prev.minutes} min).` : ""}`);
    },
  );

  // ------------------------------------------------------------------ log_checkin
  server.registerTool(
    "log_checkin",
    {
      title: "Log a check-in",
      description: "Record soreness (1 none to 5 very sore), energy (1 drained to 5 buzzing), notes and/or bodyweight (kg) for today's session (or just for today). Only the fields you give are changed. Never deletes. Returns what changed.",
      inputSchema: {
        soreness: z.number().int().min(1).max(5).optional(),
        energy: z.number().int().min(1).max(5).optional(),
        notes: z.string().max(500).optional(),
        bodyweight_kg: z.number().min(20).max(400).optional(),
      },
      annotations: WRITE(true),
    },
    async ({ soreness, energy, notes, bodyweight_kg }) => {
      const cx = await needCx(ctx);
      if (!cx) return errorResult(NO_PROGRAM);
      if (soreness === undefined && energy === undefined && notes === undefined && bodyweight_kg === undefined) return errorResult("Give at least one of soreness, energy, notes or bodyweight_kg.");

      // Today's session: the one in progress, else the latest one planned for today.
      let workoutId: string | null = (await activeWorkout(supabase))?.id ?? null;
      if (!workoutId) {
        const { data } = await supabase.from("workouts").select("id").eq("planned_date", cx.today).order("started_at", { ascending: false }).limit(1);
        workoutId = data?.[0]?.id ?? null;
      }
      let q = supabase.from("checkins").select("id, soreness, energy, notes, bodyweight_kg");
      q = workoutId ? q.eq("workout_id", workoutId) : q.is("workout_id", null).eq("checked_on", cx.today);
      const { data: found } = await q.limit(1);
      const prev = found?.[0];

      const patch = { ...(soreness !== undefined && { soreness }), ...(energy !== undefined && { energy }), ...(notes !== undefined && { notes: notes.trim() || null }), ...(bodyweight_kg !== undefined && { bodyweight_kg: Math.round(bodyweight_kg * 10) / 10 }) };
      const { error } = prev
        ? await supabase.from("checkins").update(patch).eq("id", prev.id)
        : await supabase.from("checkins").insert({ ...patch, workout_id: workoutId, checked_on: cx.today });
      if (error) return errorResult(FRIENDLY);

      const parts = [
        soreness !== undefined && `soreness ${soreness}${prev?.soreness != null ? ` (was ${prev.soreness})` : ""}`,
        energy !== undefined && `energy ${energy}${prev?.energy != null ? ` (was ${prev.energy})` : ""}`,
        bodyweight_kg !== undefined && `bodyweight ${fmtNum(bodyweight_kg)} kg`,
        notes !== undefined && "notes",
      ].filter(Boolean);
      return textResult(`Check-in ${prev ? "updated" : "saved"} for ${cx.today}: ${parts.join(", ")}.`);
    },
  );

  // ------------------------------------------------------------------ get_progress
  server.registerTool(
    "get_progress",
    {
      title: "Progress",
      description: "Programme week, this week's sessions/sets/personal bests, sets per muscle group, strength trend per exercise (top set over recent sessions), soreness/energy trend, and the next check-in. Optionally one exercise. Read-only.",
      inputSchema: { exercise: z.string().max(60).optional().describe("Only this exercise, e.g. 'leg press'") },
      annotations: READ,
    },
    async ({ exercise }) => {
      const cx = await needCx(ctx);
      if (!cx) return errorResult(NO_PROGRAM);
      const p = await loadProgress(supabase);
      let chips = p.chips;
      if (exercise) {
        const m = findExercises(exercise, cx.catalog);
        if (m.length !== 1) return errorResult(m.length === 0 ? `I don’t know an exercise called “${exercise}”.` : `“${exercise}” could be: ${m.map((x) => x.name).join(", ")}. Which one?`);
        chips = chips.filter((c) => c.slug === m[0].slug);
        if (!chips.length) return textResult(`No logged sessions yet for ${m[0].name}.`);
      }
      return textResult(json({
        programme_week: `${p.week} of 12`,
        this_week: { sessions: `${p.thisWeek.sessions}/${p.thisWeek.planned}`, sets: p.thisWeek.sets, personal_bests: p.thisWeek.pbs.map((b) => `${b.name}: ${b.text}`), sets_per_muscle_group: Object.fromEntries(p.thisWeek.groups) },
        strength: chips.slice(0, exercise ? 1 : 6).map((c) => ({ exercise: c.name, unit: c.unit, top_by_session_oldest_first: c.values, change: c.values.length > 1 ? Math.round((c.values[c.values.length - 1] - c.values[0]) * 10) / 10 : 0 })),
        soreness_energy_recent: p.trend,
        next_check_in: p.due ? `Week ${p.due} (ready now)` : p.next ? `Week ${p.next}` : "all done",
      }));
    },
  );

  // ------------------------------------------------------------------ suggest_next_weights
  server.registerTool(
    "suggest_next_weights",
    {
      title: "Suggest next weights",
      description: "What to lift next time for each exercise in today's session (or one named exercise), using the progression rule: go up only when the top of the rep range was hit on BOTH sets; otherwise hold. Holds in setup weeks 1-2, after high soreness, or after choosing Hold at a check-in. Read-only.",
      inputSchema: { exercise: z.string().max(60).optional() },
      annotations: READ,
    },
    async ({ exercise }) => {
      const cx = await needCx(ctx);
      if (!cx) return errorResult(NO_PROGRAM);
      let slugs: { slug: string; range?: [number, number] }[] = [];
      if (exercise) {
        const m = findExercises(exercise, cx.catalog);
        if (m.length !== 1) return errorResult(m.length === 0 ? `I don’t know an exercise called “${exercise}”.` : `“${exercise}” could be: ${m.map((x) => x.name).join(", ")}. Which one?`);
        slugs = [{ slug: m[0].slug }];
      } else {
        const t = await loadToday(supabase, uid);
        const d = t?.strip.find((x) => x.date === t.today);
        const plan = t && d?.sessionOrigin ? t.days[weekdayOf(d.sessionOrigin)] : null;
        if (!plan) return textResult("No session today, so nothing to suggest. Name an exercise to get its next weight.");
        slugs = plan.exercises.map((e) => ({ slug: e.slug, range: [e.repLo, e.repHi] as [number, number] }));
      }
      return textResult(json(slugs.map(({ slug, range }) => {
        const info = cx.exercises.get(slug)!;
        const s = suggestionFor(cx, slug, range);
        const o = overloadFor(cx, slug, range);
        return { exercise: info.name, last_time: lastTimeLine(info.kind, s.last) ?? "none yet", next: nextLine(info.kind, s.suggestion), goal_today: goalText(info.kind, o) || undefined, goal_why: o.note, why: reasonText(s.suggestion.reason), weight_jump_kg: s.spec.increment, step_kg: s.spec.step };
      })));
    },
  );

  // ------------------------------------------------------------------ get_review
  server.registerTool(
    "get_review",
    {
      title: "Week 4/8/12 review",
      description: "The week 4, 8 or 12 check-in: sessions done, average soreness and energy, strength change on the main lifts, and the recommendation (keep building, hold, or deload) with the reason. Defaults to the check-in that is ready, otherwise the next one. Read-only; applying a choice is done in the app.",
      inputSchema: { week: z.union([z.literal(4), z.literal(8), z.literal(12)]).optional() },
      annotations: READ,
    },
    async ({ week }) => {
      const cx = await needCx(ctx);
      if (!cx) return errorResult(NO_PROGRAM);
      const { data: done } = await supabase.from("reviews").select("week").not("applied_at", "is", null);
      const doneWeeks = (done ?? []).map((r) => r.week);
      const w = week ?? checkInDue(cx.week, doneWeeks) ?? nextCheckIn(cx.week, doneWeeks) ?? 12;
      const r = await loadReview(supabase, w);
      if (!r) return errorResult(NO_PROGRAM);
      return textResult(json({
        check_in: `Week ${r.week}`, ready: r.available, sessions: `${r.input.sessionsDone}/${r.input.sessionsPlanned}`,
        average_soreness: r.input.avgSoreness, average_energy: r.input.avgEnergy,
        strength_since_week_1: r.rows.map((x) => `${x.name}: ${fmtNum(x.from)} → ${fmtNum(x.to)} kg (${x.delta >= 0 ? "+" : "−"}${fmtNum(Math.abs(x.delta))})`),
        recommendation: r.rec === "build" ? "Keep building" : r.rec === "hold" ? "Hold" : "Deload", why: r.why,
        applied_in_app: r.applied ? (r.applied === "build" ? "Keep building" : r.applied === "hold" ? "Hold" : "Deload") : null,
      }));
    },
  );
}

export const TOOL_NAMES = [
  "get_today_workout", "get_history", "get_cardio", "get_week_summary", "get_records", "get_bodyweight", "get_app_errors", "log_sets", "log_cardio", "log_checkin", "get_progress", "suggest_next_weights", "get_review",
  "get_plan", "list_exercises", "get_schedule", "get_settings", "start_workout", "finish_workout", "edit_logged_sets",
  "delete_logged_sets", "delete_workout", "delete_cardio_entry", "edit_plan_day", "swap_plan_exercise", "edit_plan_cardio", "edit_logged_cardio", "edit_checkin", "schedule_day", "update_settings", "set_exercise_settings",
  "get_change_log", "undo_change", "save_weekly_review", "get_weekly_reviews", "get_goals", "set_goal", "remove_goal", "get_trainer_brief",
] as const;
