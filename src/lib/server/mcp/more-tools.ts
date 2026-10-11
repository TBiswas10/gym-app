import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ServerClient } from "../../supabase/server";
import { longDay, weekdayOf } from "../../dates";
import { findExercises } from "../../parser";
import { formatTarget } from "../../plan";
import type { Op } from "../../ops";
import { applyOps } from "../apply-ops";
import { loadToday } from "../today-data";
import { startSession } from "../workout-data";
import { loadCx } from "./context";
import { errorResult, json, setLine, textResult } from "./format";

// More connector tools. Everything here works inside the connector's existing database limits: it can read
// everything and add or correct workouts, sets, cardio and check-ins, but it still cannot delete anything.

interface Ctx {
  supabase: ServerClient;
  uid: string;
}

const FRIENDLY = "That didn’t save. Try again in a moment.";
const NO_PROGRAM = "The programme hasn’t been started yet. Open the app and finish setup first.";
const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function activeWorkout(supabase: ServerClient) {
  const { data } = await supabase.from("workouts").select("id, weekday, planned_date, day_name, status").eq("status", "in_progress").maybeSingle();
  return data;
}

export function registerMoreTools(server: McpServer, { supabase, uid }: Ctx): void {
  server.registerTool(
    "get_plan",
    {
      title: "Training plan",
      description: "The signed-in user's current plan: each training day with its exercises (sets and rep range) and cardio. Read-only.",
      annotations: READ,
    },
    async () => {
      const cx = await loadCx(supabase);
      if (!cx) return errorResult(NO_PROGRAM);
      const { data: tpl } = await supabase.from("program_templates").select("id").eq("user_id", uid).eq("plan_type", cx.state.planType).maybeSingle();
      if (!tpl) return errorResult(NO_PROGRAM);
      const [days, exs] = await Promise.all([
        supabase.from("template_days").select("weekday, full_name, is_light, cardio_name, cardio_label, cardio_minutes").eq("template_id", tpl.id).order("weekday"),
        supabase.from("template_exercises").select("weekday, position, exercise_slug, sets, rep_lo, rep_hi").eq("template_id", tpl.id).order("position"),
      ]);
      if (days.error || exs.error) return errorResult(FRIENDLY);
      return textResult(
        json({
          plan: cx.state.planType === "5day" ? "5-day split" : "3-day full body",
          days: (days.data ?? []).map((d) => ({
            day: longDay(d.weekday),
            session: d.full_name,
            light_day: d.is_light || undefined,
            exercises: (exs.data ?? [])
              .filter((e) => e.weekday === d.weekday)
              .map((e) => ({ slug: e.exercise_slug, name: cx.exercises.get(e.exercise_slug)?.name ?? e.exercise_slug, sets: e.sets, reps: `${e.rep_lo}-${e.rep_hi}` })),
            cardio: `${d.cardio_name} (${d.cardio_label})`,
            cardio_minutes: d.cardio_minutes,
          })),
        }),
      );
    },
  );

  server.registerTool(
    "list_exercises",
    {
      title: "Exercise library",
      description: "Every exercise the app knows: slug, name, type (weight, bodyweight, timed), the default rep range, the machine's weight step and the user's weight jump. Read-only.",
      annotations: READ,
    },
    async () => {
      const cx = await loadCx(supabase);
      if (!cx) return errorResult(NO_PROGRAM);
      return textResult(
        json(
          [...cx.exercises.values()].map((e) => ({
            slug: e.slug,
            name: e.name,
            type: e.kind,
            default_reps: `${e.repLo}-${e.repHi}`,
            step_kg: e.step,
            weight_jump_kg: cx.increments.get(e.slug) ?? e.defaultIncrement,
          })),
        ),
      );
    },
  );

  server.registerTool(
    "get_schedule",
    {
      title: "This week's schedule",
      description: "The Mon-Sun strip for this week: for each day the status (done, today, missed, rest, skipped, next...), the session, and whether a skipped day can still be done. Read-only.",
      annotations: READ,
    },
    async () => {
      const t = await loadToday(supabase, uid);
      if (!t) return errorResult(NO_PROGRAM);
      return textResult(
        json({
          today: t.today,
          programme_week: t.week,
          days: t.strip.map((d) => ({
            date: d.date,
            day: longDay(d.weekday),
            status: d.status,
            session: d.sessionOrigin ? (t.days[weekdayOf(d.sessionOrigin)]?.fullName ?? null) : null,
            moved_in: d.movedIn || undefined,
            light: d.light || undefined,
            can_still_do: d.skippedOrigin ? "yes: start_workout with this date" : undefined,
          })),
          still_to_go: t.toGo,
          sessions_done_total: t.totalDone,
        }),
      );
    },
  );

  server.registerTool(
    "get_settings",
    {
      title: "Settings",
      description: "Alerts, bodyweight tracking, deload weeks, test mode, and the per-exercise weight jumps, start weights and machine notes. Read-only.",
      annotations: READ,
    },
    async () => {
      const cx = await loadCx(supabase);
      if (!cx) return errorResult(NO_PROGRAM);
      const [ps, ex] = await Promise.all([
        supabase.from("program_state").select("rest_alerts, track_bodyweight, deload_weeks, test_mode").maybeSingle(),
        supabase.from("user_exercise_settings").select("exercise_slug, increment_kg, start_weight_kg, notes, backup_name"),
      ]);
      return textResult(
        json({
          rest_alerts: ps.data?.rest_alerts,
          track_bodyweight: ps.data?.track_bodyweight,
          deload_weeks: ps.data?.deload_weeks,
          test_mode: ps.data?.test_mode,
          exercises: (ex.data ?? []).map((e) => ({
            exercise: cx.exercises.get(e.exercise_slug)?.name ?? e.exercise_slug,
            weight_jump_kg: e.increment_kg ?? undefined,
            start_weight_kg: e.start_weight_kg ?? undefined,
            notes: e.notes ?? undefined,
            swap_substitute: e.backup_name ?? undefined,
          })),
        }),
      );
    },
  );

  server.registerTool(
    "start_workout",
    {
      title: "Start a workout",
      description:
        "Start a session. With no date it starts today's. With a date (YYYY-MM-DD, this week) it starts that day's session, which is how a skipped day is done later. If a session is already in progress it says so and does nothing else.",
      inputSchema: { date: DATE.optional().describe("Day to start, default today") },
      annotations: WRITE,
    },
    async ({ date }) => {
      const active = await activeWorkout(supabase);
      if (active) return textResult(`A session is already in progress: ${active.day_name} (${active.planned_date}). Log sets with log_sets, then finish_workout.`);
      const t = await loadToday(supabase, uid);
      if (!t) return errorResult(NO_PROGRAM);
      const target = date ?? t.today;
      const d = t.strip.find((x) => x.date === target);
      const origin = d?.sessionOrigin ?? d?.skippedOrigin ?? null;
      if (!d || !origin) return errorResult(`There’s no session to start on ${target} (rest day, outside this week, or before the programme began).`);
      if (d.status === "done") return errorResult(`${target} is already done.`);
      const { data: tpl } = await supabase.from("program_templates").select("id").eq("user_id", uid).eq("plan_type", t.planType).maybeSingle();
      if (!tpl) return errorResult(NO_PROGRAM);
      const created = await startSession(supabase, { startDate: t.startDate, planType: t.planType, templateId: tpl.id, week: t.week, today: t.today }, origin);
      if (!created) return errorResult("Couldn’t start that session. Start it in the app instead.");
      const plan = t.days[weekdayOf(origin)];
      const lines = plan ? plan.exercises.map((e) => `- ${e.name}: ${formatTarget(e.sets, e.repLo, e.repHi, e.kind)}`) : [];
      return textResult([`Started ${created.day_name} for ${origin}.`, ...lines, "Cardio first, then the lifts."].join("\n"));
    },
  );

  server.registerTool(
    "finish_workout",
    {
      title: "Finish the workout",
      description: "Mark the session in progress as completed (what End workout does in the app). Sets and cardio already logged are kept.",
      annotations: WRITE,
    },
    async () => {
      const active = await activeWorkout(supabase);
      if (!active) return errorResult("There’s no session in progress.");
      const res = await applyOps(supabase, [{ t: "finish", workoutId: active.id, endedAt: new Date().toISOString() }]);
      if (res.retry || res.dropped) return errorResult(FRIENDLY);
      const { count } = await supabase.from("sets").select("id", { count: "exact", head: true }).eq("workout_id", active.id);
      return textResult(`${active.day_name} is finished: ${count ?? 0} sets logged. Use log_checkin to add soreness and energy.`);
    },
  );

  server.registerTool(
    "edit_logged_sets",
    {
      title: "Correct logged sets",
      description:
        "Correct the sets of ONE exercise in a session on a given date (default today): the numbers you give replace set 1 and set 2. Use it to fix a typo from an earlier workout. It cannot remove a set. Weights are kilograms.",
      inputSchema: {
        date: DATE.optional().describe("The session's date, YYYY-MM-DD (default today)"),
        exercise: z.string().min(2).max(60),
        sets: z
          .array(
            z.object({
              weight_kg: z.number().min(0).max(400).optional(),
              reps: z.number().int().min(1).max(100).optional(),
              seconds: z.number().int().min(1).max(3600).optional(),
            }),
          )
          .min(1)
          .max(2),
      },
      annotations: WRITE,
    },
    async ({ date, exercise, sets }) => {
      const cx = await loadCx(supabase);
      if (!cx) return errorResult(NO_PROGRAM);
      const matches = findExercises(exercise, cx.catalog);
      if (matches.length !== 1) {
        return errorResult(matches.length === 0 ? `I don’t know an exercise called “${exercise}”.` : `“${exercise}” could be ${matches.map((m) => m.name).join(" or ")}. Which one?`);
      }
      const info = cx.exercises.get(matches[0].slug)!;
      for (const [i, s] of sets.entries()) {
        if (info.kind === "timed" && !s.seconds) return errorResult(`${info.name} is timed: give seconds for set ${i + 1}.`);
        if (info.kind !== "timed" && !s.reps) return errorResult(`Give reps for set ${i + 1} of ${info.name}.`);
        if (info.kind === "weight" && s.weight_kg === undefined) return errorResult(`Give weight_kg for set ${i + 1} of ${info.name}.`);
      }
      const day = date ?? cx.today;
      const { data: w } = await supabase
        .from("workouts")
        .select("id, day_name, planned_date")
        .eq("planned_date", day)
        .neq("status", "abandoned")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!w) return errorResult(`There’s no session on ${day}. Use start_workout first.`);
      const { data: before } = await supabase.from("sets").select("set_number, position, weight_kg, reps, seconds, variant").eq("workout_id", w.id).eq("exercise_slug", info.slug).order("set_number");
      const position = before?.[0]?.position ?? 100;
      const variant = before?.find((b) => b.variant)?.variant ?? null; // correcting numbers must not undo a swap
      const ops: Op[] = sets.map((s, i) => ({
        t: "set",
        id: randomUUID(),
        workoutId: w.id,
        slug: info.slug,
        position,
        n: i + 1,
        variant,
        kg: info.kind === "timed" ? null : (s.weight_kg ?? 0),
        reps: info.kind === "timed" ? null : (s.reps ?? null),
        secs: info.kind === "timed" ? (s.seconds ?? null) : null,
        source: "mcp",
      }));
      const res = await applyOps(supabase, ops);
      if (res.retry || res.dropped) return errorResult(FRIENDLY);
      const lines = sets.map((s, i) => {
        const was = before?.find((b) => b.set_number === i + 1);
        const now = setLine(info.kind, { weight_kg: s.weight_kg ?? 0, reps: s.reps ?? null, seconds: s.seconds ?? null });
        return `Set ${i + 1}: ${now}${was ? ` (was ${setLine(info.kind, was)})` : " (new)"}`;
      });
      return textResult([`Corrected ${info.name} on ${w.planned_date} (${w.day_name}).`, ...lines].join("\n"));
    },
  );
}
