import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ServerClient } from "../../supabase/server";
import { longDay, sydneyDate, weekDates, weekdayOf } from "../../dates";
import { findExercises } from "../../parser";
import { loadCx } from "./context";
import { errorResult, setLine, textResult } from "./format";

// The connector's stronger tools. They exist because the owner asked for them. Safeguards that stay on:
//  - every delete needs `confirm: true` and, for a whole workout, the date typed twice;
//  - deletes name exactly what was removed; a client can show its own approval prompt (destructiveHint);
//  - nothing here can touch the account, restart the programme, switch plan type or change the start date
//    (the database refuses those for connector tokens regardless of what this code does).

interface Ctx {
  supabase: ServerClient;
  uid: string;
}

const FRIENDLY = "That didn’t save. Try again in a moment.";
const NO_PROGRAM = "The programme hasn’t been started yet. Open the app and finish setup first.";
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const CHANGE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const DESTROY = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } as const;

async function workoutOn(supabase: ServerClient, date: string) {
  const { data } = await supabase
    .from("workouts")
    .select("id, day_name, planned_date, status, is_test")
    .eq("planned_date", date)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export function registerPowerTools(server: McpServer, { supabase, uid }: Ctx): void {
  // ---------------------------------------------------------------- delete_logged_sets
  server.registerTool(
    "delete_logged_sets",
    {
      title: "Delete the logged sets of one exercise",
      description:
        "Remove every logged set of ONE exercise from the session on a date (default today). Permanent. Requires confirm: true. Returns exactly which sets were removed.",
      inputSchema: {
        date: DATE.optional().describe("Session date YYYY-MM-DD (default today)"),
        exercise: z.string().min(2).max(60),
        confirm: z.literal(true).describe("Must be true: this cannot be undone"),
      },
      annotations: DESTROY,
    },
    async ({ date, exercise }) => {
      const cx = await loadCx(supabase);
      if (!cx) return errorResult(NO_PROGRAM);
      const m = findExercises(exercise, cx.catalog);
      if (m.length !== 1) return errorResult(m.length === 0 ? `I don’t know an exercise called “${exercise}”.` : `“${exercise}” could be ${m.map((x) => x.name).join(" or ")}. Which one?`);
      const info = cx.exercises.get(m[0].slug)!;
      const day = date ?? cx.today;
      const w = await workoutOn(supabase, day);
      if (!w) return errorResult(`There’s no session on ${day}. Nothing was deleted.`);
      const { data: rows } = await supabase.from("sets").select("id, set_number, weight_kg, reps, seconds").eq("workout_id", w.id).eq("exercise_slug", info.slug).order("set_number");
      if (!rows?.length) return textResult(`${info.name} has no logged sets on ${day}. Nothing to delete.`);
      const { error } = await supabase.from("sets").delete().eq("workout_id", w.id).eq("exercise_slug", info.slug);
      if (error) return errorResult(FRIENDLY);
      return textResult([`Deleted ${rows.length} ${rows.length === 1 ? "set" : "sets"} of ${info.name} from ${w.day_name} (${day}):`, ...rows.map((r) => `- Set ${r.set_number}: ${setLine(info.kind, r)}`)].join("\n"));
    },
  );

  // ---------------------------------------------------------------- delete_workout
  server.registerTool(
    "delete_workout",
    {
      title: "Delete a whole workout",
      description:
        "Permanently delete the session on a date with ALL its sets, cardio and check-in. Requires confirm: true and the date repeated in confirm_date. Returns exactly what was removed. Use delete_logged_sets to remove just one exercise.",
      inputSchema: {
        date: DATE,
        confirm_date: DATE.describe("The same date again, to confirm"),
        confirm: z.literal(true).describe("Must be true: this cannot be undone"),
      },
      annotations: DESTROY,
    },
    async ({ date, confirm_date }) => {
      if (date !== confirm_date) return errorResult("confirm_date must match date exactly. Nothing was deleted.");
      const w = await workoutOn(supabase, date);
      if (!w) return errorResult(`There’s no workout on ${date}. Nothing was deleted.`);
      const [sets, cardio, checkin] = await Promise.all([
        supabase.from("sets").select("id", { count: "exact", head: true }).eq("workout_id", w.id),
        supabase.from("cardio_entries").select("id", { count: "exact", head: true }).eq("workout_id", w.id),
        supabase.from("checkins").select("id", { count: "exact", head: true }).eq("workout_id", w.id),
      ]);
      // A check-in keeps its row when its workout goes (workout_id is set to null), so it is removed first.
      const c = await supabase.from("checkins").delete().eq("workout_id", w.id);
      if (c.error) return errorResult(FRIENDLY);
      const d = await supabase.from("workouts").delete().eq("id", w.id);
      if (d.error) return errorResult(FRIENDLY);
      return textResult(
        `Deleted ${w.day_name} on ${date} (${w.status}) with ${sets.count ?? 0} sets, ${cardio.count ?? 0} cardio ${cardio.count === 1 ? "entry" : "entries"} and ${checkin.count ?? 0} check-in${checkin.count === 1 ? "" : "s"}.`,
      );
    },
  );

  // ---------------------------------------------------------------- delete_cardio_entry
  server.registerTool(
    "delete_cardio_entry",
    {
      title: "Delete a cardio entry",
      description: "Permanently delete one cardio (or walk/stretch) entry by date and kind. Requires confirm: true. Returns what was removed.",
      inputSchema: {
        date: DATE,
        machine: z.enum(["bike", "treadmill", "stair", "rower", "xtrainer", "walk", "stretch"]),
        confirm: z.literal(true).describe("Must be true: this cannot be undone"),
      },
      annotations: DESTROY,
    },
    async ({ date, machine }) => {
      const { data: rows } = await supabase.from("cardio_entries").select("id, minutes").eq("kind", machine).eq("logged_on", date);
      if (!rows?.length) return textResult(`No ${machine} entry on ${date}. Nothing to delete.`);
      const { error } = await supabase.from("cardio_entries").delete().in("id", rows.map((r) => r.id));
      if (error) return errorResult(FRIENDLY);
      return textResult(`Deleted ${rows.length} ${machine} ${rows.length === 1 ? "entry" : "entries"} on ${date}: ${rows.map((r) => `${r.minutes} min`).join(", ")}.`);
    },
  );

  // ---------------------------------------------------------------- edit_plan_day
  server.registerTool(
    "edit_plan_day",
    {
      title: "Edit a day of the plan",
      description:
        "Replace the exercise list of one training day (1 = Monday ... 7 = Sunday; the day must already be a training day). Up to 8 exercises, each with 1 or 2 sets and a rep range. Order given is the order done. Returns the day before and after. It does not change past workouts.",
      inputSchema: {
        weekday: z.number().int().min(1).max(7),
        exercises: z
          .array(
            z.object({
              exercise: z.string().min(2).max(60),
              sets: z.number().int().min(1).max(2).default(2),
              rep_lo: z.number().int().min(1).max(100),
              rep_hi: z.number().int().min(1).max(100),
            }),
          )
          .min(1)
          .max(8),
      },
      annotations: CHANGE,
    },
    async ({ weekday, exercises }) => {
      const cx = await loadCx(supabase);
      if (!cx) return errorResult(NO_PROGRAM);
      const rows: { slug: string; sets: number; rep_lo: number; rep_hi: number }[] = [];
      for (const e of exercises) {
        if (e.rep_hi < e.rep_lo) return errorResult(`“${e.exercise}”: rep_hi must be at least rep_lo.`);
        const m = findExercises(e.exercise, cx.catalog);
        if (m.length !== 1) return errorResult(m.length === 0 ? `I don’t know an exercise called “${e.exercise}”.` : `“${e.exercise}” could be ${m.map((x) => x.name).join(" or ")}. Which one?`);
        if (rows.some((r) => r.slug === m[0].slug)) return errorResult(`${m[0].name} is listed twice.`);
        rows.push({ slug: m[0].slug, sets: e.sets, rep_lo: e.rep_lo, rep_hi: e.rep_hi });
      }
      const { data: tpl } = await supabase.from("program_templates").select("id").eq("user_id", uid).eq("plan_type", cx.state.planType).maybeSingle();
      if (!tpl) return errorResult(NO_PROGRAM);
      const { data: day } = await supabase.from("template_days").select("full_name").eq("template_id", tpl.id).eq("weekday", weekday).maybeSingle();
      if (!day) return errorResult(`${longDay(weekday)} isn’t a training day in your plan, so there’s nothing to edit.`);
      const { data: before } = await supabase.from("template_exercises").select("exercise_slug, sets, rep_lo, rep_hi").eq("template_id", tpl.id).eq("weekday", weekday).order("position");
      const { error } = await supabase.rpc("replace_day_exercises", {
        p_template: tpl.id,
        p_weekday: weekday,
        p_rows: rows.map((r) => ({ slug: r.slug, sets: r.sets, rep_lo: r.rep_lo, rep_hi: r.rep_hi })),
      });
      if (error) return errorResult(FRIENDLY);
      const line = (slug: string, sets: number, lo: number, hi: number) => `- ${cx.exercises.get(slug)?.name ?? slug}: ${sets} × ${lo}-${hi}`;
      return textResult(
        [
          `${longDay(weekday)} (${day.full_name}) updated.`,
          "Before:",
          ...(before ?? []).map((b) => line(b.exercise_slug, b.sets, b.rep_lo, b.rep_hi)),
          "Now:",
          ...rows.map((r) => line(r.slug, r.sets, r.rep_lo, r.rep_hi)),
        ].join("\n"),
      );
    },
  );

  // ---------------------------------------------------------------- schedule_day
  server.registerTool(
    "schedule_day",
    {
      title: "Skip, move or lighten a day",
      description:
        "Change what happens to a session on a date in THIS week: skip it, do a light version (about 20% lighter), move it to a free day (move_to, today or later this week), or clear the choice. A skipped day can still be done later with start_workout.",
      inputSchema: {
        date: DATE.describe("The session's planned date"),
        action: z.enum(["skip", "light", "move", "clear"]),
        move_to: DATE.optional().describe("Required for move"),
      },
      annotations: CHANGE,
    },
    async ({ date, action, move_to }) => {
      const today = sydneyDate();
      const week = weekDates(today);
      if (!week.includes(date)) return errorResult(`${date} isn’t in this week (${week[0]} to ${week[6]}).`);
      if (action === "move") {
        if (!move_to) return errorResult("Give move_to for a move.");
        if (!week.includes(move_to) || move_to < today) return errorResult("move_to must be today or a later day this week.");
        if (move_to === date) return errorResult("move_to is the same day.");
      }
      if (action === "clear") {
        const { error } = await supabase.from("schedule_overrides").delete().eq("planned_date", date);
        if (error) return errorResult(FRIENDLY);
        return textResult(`Cleared any skip, move or light choice for ${longDay(weekdayOf(date))} ${date}.`);
      }
      const dbAction = action === "skip" ? "skipped" : action === "move" ? "moved" : "light";
      const { error } = await supabase
        .from("schedule_overrides")
        .upsert({ planned_date: date, action: dbAction, moved_to_date: action === "move" ? move_to! : null }, { onConflict: "user_id,planned_date" });
      if (error) return errorResult(FRIENDLY);
      const what = action === "skip" ? "skipped" : action === "light" ? "set to a light version" : `moved to ${longDay(weekdayOf(move_to!))} ${move_to}`;
      return textResult(`${longDay(weekdayOf(date))} ${date} is ${what}.`);
    },
  );

  // ---------------------------------------------------------------- update_settings
  server.registerTool(
    "update_settings",
    {
      title: "Change settings",
      description: "Change rest-over alerts, bodyweight tracking, or which programme weeks are deload weeks (half the sets). Only the fields you give are changed. Cannot change the start date or plan type.",
      inputSchema: {
        rest_alerts: z.boolean().optional(),
        track_bodyweight: z.boolean().optional(),
        deload_weeks: z.array(z.number().int().min(1).max(12)).max(12).optional().describe("The full list of deload weeks (1-12)"),
      },
      annotations: CHANGE,
    },
    async ({ rest_alerts, track_bodyweight, deload_weeks }) => {
      const patch: { rest_alerts?: boolean; track_bodyweight?: boolean; deload_weeks?: number[] } = {};
      if (rest_alerts !== undefined) patch.rest_alerts = rest_alerts;
      if (track_bodyweight !== undefined) patch.track_bodyweight = track_bodyweight;
      if (deload_weeks !== undefined) patch.deload_weeks = [...new Set(deload_weeks)].sort((a, b) => a - b);
      if (Object.keys(patch).length === 0) return errorResult("Nothing to change: give at least one field.");
      const { error } = await supabase.from("program_state").update(patch).not("user_id", "is", null);
      if (error) return errorResult(FRIENDLY);
      return textResult(`Settings updated: ${Object.entries(patch).map(([k, v]) => `${k.replace(/_/g, " ")} = ${Array.isArray(v) ? (v.length ? v.join(", ") : "none") : v}`).join("; ")}.`);
    },
  );

  // ---------------------------------------------------------------- set_exercise_settings
  server.registerTool(
    "set_exercise_settings",
    {
      title: "Per-exercise settings",
      description: "Set one exercise's weight jump (kg), starting weight (kg) or machine notes. Only the fields you give are changed. Pass notes as an empty string to clear them.",
      inputSchema: {
        exercise: z.string().min(2).max(60),
        weight_jump_kg: z.number().min(0.5).max(20).optional(),
        start_weight_kg: z.number().min(0).max(400).optional(),
        notes: z.string().max(200).optional(),
      },
      annotations: CHANGE,
    },
    async ({ exercise, weight_jump_kg, start_weight_kg, notes }) => {
      const cx = await loadCx(supabase);
      if (!cx) return errorResult(NO_PROGRAM);
      const m = findExercises(exercise, cx.catalog);
      if (m.length !== 1) return errorResult(m.length === 0 ? `I don’t know an exercise called “${exercise}”.` : `“${exercise}” could be ${m.map((x) => x.name).join(" or ")}. Which one?`);
      const row: { exercise_slug: string; increment_kg?: number; start_weight_kg?: number; notes?: string | null } = { exercise_slug: m[0].slug };
      if (weight_jump_kg !== undefined) row.increment_kg = weight_jump_kg;
      if (start_weight_kg !== undefined) row.start_weight_kg = start_weight_kg;
      if (notes !== undefined) row.notes = notes.trim() || null;
      if (Object.keys(row).length === 1) return errorResult("Nothing to change: give weight_jump_kg, start_weight_kg or notes.");
      const { error } = await supabase.from("user_exercise_settings").upsert(row, { onConflict: "user_id,exercise_slug" });
      if (error) return errorResult(FRIENDLY);
      return textResult(`${m[0].name} updated: ${Object.entries(row).filter(([k]) => k !== "exercise_slug").map(([k, v]) => `${k.replace(/_/g, " ")} = ${v ?? "cleared"}`).join("; ")}.`);
    },
  );
}
