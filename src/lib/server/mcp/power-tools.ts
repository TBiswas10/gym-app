import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Json } from "../../database.types";
import type { ServerClient } from "../../supabase/server";
import { longDay, sydneyDate, weekDates, weekdayOf } from "../../dates";
import { cleanParams, defaultMachine, isMachine, machineById, type MachineId } from "../../cardio";
import { findExercises } from "../../parser";
import { listChanges, recordChange, snapshotWorkout, undoChange } from "../change-log";
import { loadCx } from "./context";
import { cardioLine, errorResult, json, setLine, textResult } from "./format";

// The connector's stronger tools. They exist because the owner asked for them. Safeguards that stay on:
//  - every delete and plan edit can be previewed first (`dry_run: true`) and needs `confirm: true` to run;
//  - every change is written to the change log with its "before", and can be put back (`undo_change`, or the app's
//    Change log screen);
//  - nothing here can touch the account, restart the programme, switch plan type or change the start date
//    (the database refuses those for connector tokens regardless of what this code does).

interface Ctx {
  supabase: ServerClient;
  uid: string;
}

const FRIENDLY = "That didn’t save. Try again in a moment.";
const NO_PROGRAM = "The programme hasn’t been started yet. Open the app and finish setup first.";
const NEEDS_CONFIRM = "Nothing was changed. Run it again with confirm: true to go ahead, or dry_run: true to preview first.";
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const CHANGE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const DESTROY = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } as const;
const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const UNDO_NOTE = "It can be put back with undo_change.";

const PREVIEW = {
  dry_run: z.boolean().optional().describe("true = show exactly what would change and change nothing"),
  confirm: z.literal(true).optional().describe("Must be true to actually make the change"),
};

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
        "Remove every logged set of ONE exercise from the session on a date (default today). Use dry_run: true to preview. Needs confirm: true to run. Recorded in the change log and can be undone with undo_change.",
      inputSchema: {
        date: DATE.optional().describe("Session date YYYY-MM-DD (default today)"),
        exercise: z.string().min(2).max(60),
        ...PREVIEW,
      },
      annotations: DESTROY,
    },
    async ({ date, exercise, dry_run, confirm }) => {
      if (!dry_run && confirm !== true) return errorResult(NEEDS_CONFIRM);
      const cx = await loadCx(supabase);
      if (!cx) return errorResult(NO_PROGRAM);
      const m = findExercises(exercise, cx.catalog);
      if (m.length !== 1) return errorResult(m.length === 0 ? `I don’t know an exercise called “${exercise}”.` : `“${exercise}” could be ${m.map((x) => x.name).join(" or ")}. Which one?`);
      const info = cx.exercises.get(m[0].slug)!;
      const day = date ?? cx.today;
      const w = await workoutOn(supabase, day);
      if (!w) return errorResult(`There’s no session on ${day}. Nothing was deleted.`);
      const { data: rows } = await supabase.from("sets").select("*").eq("workout_id", w.id).eq("exercise_slug", info.slug).order("set_number");
      if (!rows?.length) return textResult(`${info.name} has no logged sets on ${day}. Nothing to delete.`);
      const lines = rows.map((r) => `- Set ${r.set_number}: ${setLine(info.kind, r)}`);
      if (dry_run) return textResult([`Preview: this would delete ${rows.length} ${rows.length === 1 ? "set" : "sets"} of ${info.name} from ${w.day_name} (${day}):`, ...lines, "Nothing was changed."].join("\n"));

      const stripped = rows.map(({ user_id: _u, ...r }) => (void _u, r));
      const { error } = await supabase.from("sets").delete().eq("workout_id", w.id).eq("exercise_slug", info.slug);
      if (error) return errorResult(FRIENDLY);
      await recordChange(supabase, {
        source: "claude", action: "delete_sets", undoable: true,
        summary: `Deleted ${rows.length} ${rows.length === 1 ? "set" : "sets"} of ${info.name} from ${w.day_name} (${day})`,
        before: { kind: "delete_sets", rows: stripped },
      });
      return textResult([`Deleted ${rows.length} ${rows.length === 1 ? "set" : "sets"} of ${info.name} from ${w.day_name} (${day}):`, ...lines, UNDO_NOTE].join("\n"));
    },
  );

  // ---------------------------------------------------------------- delete_workout
  server.registerTool(
    "delete_workout",
    {
      title: "Delete a whole workout",
      description:
        "Delete the session on a date with ALL its sets, cardio and check-in. Use dry_run: true to preview. Needs confirm: true and the date repeated in confirm_date. Recorded in the change log and can be undone with undo_change.",
      inputSchema: {
        date: DATE,
        confirm_date: DATE.optional().describe("The same date again, to confirm (not needed for dry_run)"),
        ...PREVIEW,
      },
      annotations: DESTROY,
    },
    async ({ date, confirm_date, dry_run, confirm }) => {
      if (!dry_run && (confirm !== true || confirm_date !== date)) return errorResult(`${NEEDS_CONFIRM} Also repeat the date in confirm_date.`);
      const w = await workoutOn(supabase, date);
      if (!w) return errorResult(`There’s no workout on ${date}. Nothing was deleted.`);
      const snap = await snapshotWorkout(supabase, w.id);
      if (!snap) return errorResult(FRIENDLY);
      const what = `${w.day_name} on ${date} (${w.status}) with ${snap.sets.length} sets, ${snap.cardio.length} cardio ${snap.cardio.length === 1 ? "entry" : "entries"} and ${snap.checkins.length} check-in${snap.checkins.length === 1 ? "" : "s"}`;
      if (dry_run) return textResult(`Preview: this would delete ${what}. Nothing was changed.`);

      // A check-in keeps its row when its workout goes (workout_id is set to null), so it is removed first.
      const c = await supabase.from("checkins").delete().eq("workout_id", w.id);
      if (c.error) return errorResult(FRIENDLY);
      const d = await supabase.from("workouts").delete().eq("id", w.id);
      if (d.error) return errorResult(FRIENDLY);
      await recordChange(supabase, { source: "claude", action: "delete_workout", undoable: true, summary: `Deleted ${what}`, before: { kind: "delete_workout", ...snap } });
      return textResult(`Deleted ${what}. ${UNDO_NOTE}`);
    },
  );

  // ---------------------------------------------------------------- delete_cardio_entry
  server.registerTool(
    "delete_cardio_entry",
    {
      title: "Delete a cardio entry",
      description: "Delete one cardio (or walk/stretch) entry by date and kind. Use dry_run: true to preview. Needs confirm: true. Can be undone with undo_change.",
      inputSchema: {
        date: DATE,
        machine: z.enum(["bike", "treadmill", "stair", "rower", "xtrainer", "walk", "stretch"]),
        ...PREVIEW,
      },
      annotations: DESTROY,
    },
    async ({ date, machine, dry_run, confirm }) => {
      if (!dry_run && confirm !== true) return errorResult(NEEDS_CONFIRM);
      const { data: rows } = await supabase.from("cardio_entries").select("*").eq("kind", machine).eq("logged_on", date);
      if (!rows?.length) return textResult(`No ${machine} entry on ${date}. Nothing to delete.`);
      const what = `${rows.length} ${machine} ${rows.length === 1 ? "entry" : "entries"} on ${date}: ${rows.map((r) => `${r.minutes} min`).join(", ")}`;
      if (dry_run) return textResult(`Preview: this would delete ${what}. Nothing was changed.`);
      const stripped = rows.map(({ user_id: _u, ...r }) => (void _u, r));
      const { error } = await supabase.from("cardio_entries").delete().in("id", rows.map((r) => r.id));
      if (error) return errorResult(FRIENDLY);
      await recordChange(supabase, { source: "claude", action: "delete_cardio", undoable: true, summary: `Deleted ${what}`, before: { kind: "delete_cardio", rows: stripped } });
      return textResult(`Deleted ${what}. ${UNDO_NOTE}`);
    },
  );

  // ---------------------------------------------------------------- edit_plan_day
  server.registerTool(
    "edit_plan_day",
    {
      title: "Edit a day of the plan",
      description:
        "Replace the exercise list of one training day (1 = Monday ... 7 = Sunday; the day must already be a training day). Up to 8 exercises, each with 1 or 2 sets and a rep range, in the order to be done. Use dry_run: true to preview the before and after. Needs confirm: true to run. Does not change past workouts. Recorded in the change log and can be undone with undo_change.",
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
        ...PREVIEW,
      },
      annotations: CHANGE,
    },
    async ({ weekday, exercises, dry_run, confirm }) => {
      if (!dry_run && confirm !== true) return errorResult(NEEDS_CONFIRM);
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
      const line = (slug: string, sets: number, lo: number, hi: number) => `- ${cx.exercises.get(slug)?.name ?? slug}: ${sets} × ${lo}-${hi}`;
      const report = [
        `${longDay(weekday)} (${day.full_name})`,
        "Before:",
        ...(before ?? []).map((b) => line(b.exercise_slug, b.sets, b.rep_lo, b.rep_hi)),
        "After:",
        ...rows.map((r) => line(r.slug, r.sets, r.rep_lo, r.rep_hi)),
      ];
      if (dry_run) return textResult(["Preview:", ...report, "Nothing was changed."].join("\n"));

      const { error } = await supabase.rpc("replace_day_exercises", {
        p_template: tpl.id,
        p_weekday: weekday,
        p_rows: rows.map((r) => ({ slug: r.slug, sets: r.sets, rep_lo: r.rep_lo, rep_hi: r.rep_hi })),
      });
      if (error) return errorResult(FRIENDLY);
      await recordChange(supabase, {
        source: "claude", action: "edit_plan_day", undoable: true,
        summary: `Edited ${longDay(weekday)} (${day.full_name}): ${rows.map((r) => cx.exercises.get(r.slug)?.name ?? r.slug).join(", ")}`,
        before: { kind: "edit_plan_day", template_id: tpl.id, weekday, rows: (before ?? []).map((b) => ({ slug: b.exercise_slug, sets: b.sets, rep_lo: b.rep_lo, rep_hi: b.rep_hi })) },
        after: { rows },
      });
      return textResult([`Updated.`, ...report, UNDO_NOTE].join("\n"));
    },
  );

  // ---------------------------------------------------------------- edit_logged_cardio
  server.registerTool(
    "edit_logged_cardio",
    {
      title: "Correct a logged cardio entry",
      description:
        "Fix ONE cardio entry you already logged (found by its date and machine): its minutes, the machine numbers, how it felt, or move it to another date (only for entries outside a workout, such as a rest-day walk, and not into the future). Only the fields you give change. Use dry_run: true to preview. Needs confirm: true. Recorded in the change log and can be undone with undo_change.",
      inputSchema: {
        date: DATE.describe("The entry's current date"),
        machine: z.enum(["bike", "treadmill", "stair", "rower", "xtrainer", "walk", "stretch"]),
        minutes: z.number().int().min(1).max(180).optional(),
        settings: z.record(z.string(), z.number().min(0).max(1000)).optional().describe("Machine numbers to change, same keys as log_cardio (res, rpm / speed, incline / level / damper, spm)"),
        feel: z.enum(["easy", "moderate", "hard"]).optional(),
        move_to_date: DATE.optional().describe("Move the entry to this date (rest-day entries only)"),
        ...PREVIEW,
      },
      annotations: CHANGE,
    },
    async ({ date, machine, minutes, settings, feel, move_to_date, dry_run, confirm }) => {
      if (!dry_run && confirm !== true) return errorResult(NEEDS_CONFIRM);
      if (minutes === undefined && settings === undefined && feel === undefined && move_to_date === undefined) return errorResult("Nothing to change: give minutes, settings, feel or move_to_date.");
      const { data: rows } = await supabase.from("cardio_entries").select("*").eq("kind", machine).eq("logged_on", date).order("logged_at", { ascending: false });
      const e = rows?.[0];
      if (!e) return errorResult(`There’s no ${machine} entry on ${date}.`);
      if (move_to_date !== undefined) {
        if (e.workout_id) return errorResult("That entry belongs to a workout, so it stays on that session’s date. Only rest-day entries can be moved.");
        if (move_to_date > sydneyDate()) return errorResult("move_to_date can’t be in the future.");
      }

      let params = (e.params ?? {}) as Record<string, number>;
      const newMinutes = minutes ?? e.minutes;
      if (settings !== undefined || minutes !== undefined) {
        if (isMachine(machine)) {
          const allowed = new Set(machineById(machine as MachineId).params.map((p) => p.k));
          const bad = Object.keys(settings ?? {}).filter((k) => !allowed.has(k) && k !== "min");
          if (bad.length) return errorResult(`${machine} settings can only use: ${[...allowed].join(", ")}. Not: ${bad.join(", ")}.`);
          params = cleanParams(machine as MachineId, { ...params, ...(settings ?? {}), min: newMinutes });
        } else if (settings !== undefined) {
          return errorResult(`${machine} has no machine numbers. Change minutes or feel instead.`);
        }
      }
      const patch = { minutes: newMinutes, params, feel: feel ?? e.feel, logged_on: move_to_date ?? e.logged_on };
      const was = `${cardioLine({ kind: e.kind, minutes: e.minutes, feel: e.feel, params: e.params })} on ${e.logged_on}`;
      const now = `${cardioLine({ kind: e.kind, minutes: patch.minutes, feel: patch.feel, params })} on ${patch.logged_on}`;
      if (dry_run) return textResult(["Preview:", `Before: ${was}`, `After:  ${now}`, "Nothing was changed."].join("\n"));

      const { error } = await supabase.from("cardio_entries").update(patch).eq("id", e.id);
      if (error) return errorResult(error.code === "23505" ? `There’s already a ${machine} entry on ${patch.logged_on}, so I left this one as it was.` : FRIENDLY);
      await recordChange(supabase, {
        source: "claude", action: "edit_cardio", undoable: true,
        summary: `Corrected cardio: ${was} → ${now}`,
        before: { kind: "edit_cardio", id: e.id, previous: { minutes: e.minutes, params: e.params, feel: e.feel, logged_on: e.logged_on } },
        after: patch as unknown as Json,
      });
      return textResult([`Corrected.`, `Before: ${was}`, `After:  ${now}`, UNDO_NOTE].join("\n"));
    },
  );

  // ---------------------------------------------------------------- edit_plan_cardio
  server.registerTool(
    "edit_plan_cardio",
    {
      title: "Edit a day's cardio in the plan",
      description:
        "Change the cardio of one training day (1 = Monday ... 7 = Sunday): the machine text (it must name a machine: bike, treadmill, stair, rower or cross-trainer; the first one named is what the app starts on), the label shown, and/or the planned minutes (5-60). Only the fields you give change; if you give minutes and no label the label becomes '<minutes> min'. Use dry_run: true to preview. Needs confirm: true. Past workouts are not changed. Recorded in the change log and can be undone with undo_change.",
      inputSchema: {
        weekday: z.number().int().min(1).max(7),
        cardio: z.string().min(2).max(60).optional().describe("e.g. 'Rower or bike'"),
        label: z.string().min(1).max(30).optional().describe("e.g. '10 min' or '8-10 min'"),
        minutes: z.number().int().min(5).max(60).optional(),
        ...PREVIEW,
      },
      annotations: CHANGE,
    },
    async ({ weekday, cardio, label, minutes, dry_run, confirm }) => {
      if (!dry_run && confirm !== true) return errorResult(NEEDS_CONFIRM);
      if (cardio === undefined && label === undefined && minutes === undefined) return errorResult("Nothing to change: give cardio, label or minutes.");
      if (cardio !== undefined && !/(bike|treadmill|stair|rower|cross-trainer)/i.test(cardio)) {
        return errorResult("The cardio text needs to name a machine (bike, treadmill, stair, rower or cross-trainer) so the app knows what to start on.");
      }
      const cx = await loadCx(supabase);
      if (!cx) return errorResult(NO_PROGRAM);
      const { data: tpl } = await supabase.from("program_templates").select("id").eq("user_id", uid).eq("plan_type", cx.state.planType).maybeSingle();
      if (!tpl) return errorResult(NO_PROGRAM);
      const { data: day } = await supabase.from("template_days").select("full_name, cardio_name, cardio_label, cardio_minutes").eq("template_id", tpl.id).eq("weekday", weekday).maybeSingle();
      if (!day) return errorResult(`${longDay(weekday)} isn’t a training day in your plan, so it has no cardio to edit.`);

      const next = {
        cardio_name: cardio?.trim() ?? day.cardio_name,
        cardio_minutes: minutes ?? day.cardio_minutes,
        cardio_label: label?.trim() ?? (minutes !== undefined ? `${minutes} min` : day.cardio_label),
      };
      const line = (c: { cardio_name: string; cardio_label: string; cardio_minutes: number }) => `${c.cardio_name} (${c.cardio_label}, ${c.cardio_minutes} min planned)`;
      const report = [`${longDay(weekday)} (${day.full_name})`, `Before: ${line(day)}`, `After:  ${line(next)}`];
      if (dry_run) return textResult(["Preview:", ...report, "Nothing was changed."].join("\n"));

      const { error } = await supabase.from("template_days").update(next).eq("template_id", tpl.id).eq("weekday", weekday);
      if (error) return errorResult(FRIENDLY);
      await recordChange(supabase, {
        source: "claude", action: "edit_plan_cardio", undoable: true,
        summary: `${longDay(weekday)} cardio: ${line(day)} → ${line(next)}`,
        before: { kind: "edit_plan_cardio", template_id: tpl.id, weekday, previous: { cardio_name: day.cardio_name, cardio_label: day.cardio_label, cardio_minutes: day.cardio_minutes } },
        after: next,
      });
      return textResult(["Updated.", ...report, `The app starts on ${machineById(defaultMachine(next.cardio_name)).name}. ${UNDO_NOTE}`].join("\n"));
    },
  );

  // ---------------------------------------------------------------- swap_plan_exercise
  server.registerTool(
    "swap_plan_exercise",
    {
      title: "Swap one exercise in the plan",
      description:
        "Replace ONE exercise with another in your plan, keeping its place, its sets and (unless you give rep_lo/rep_hi) the new exercise's usual rep range. Give weekday when the exercise is on more than one day; use with: 'backup' to use the exercise's built-in backup. Use dry_run: true to preview. Needs confirm: true. Past workouts are not changed. Recorded in the change log and can be undone with undo_change. (To swap just for today's session, log the sets with log_sets and swapped_to.)",
      inputSchema: {
        exercise: z.string().min(2).max(60).describe("The exercise currently in the plan"),
        with: z.string().min(2).max(60).describe("The exercise to put in its place (any library exercise), or 'backup'"),
        weekday: z.number().int().min(1).max(7).optional().describe("1 = Monday ... 7 = Sunday"),
        rep_lo: z.number().int().min(1).max(100).optional(),
        rep_hi: z.number().int().min(1).max(100).optional(),
        ...PREVIEW,
      },
      annotations: CHANGE,
    },
    async ({ exercise, with: withName, weekday, rep_lo, rep_hi, dry_run, confirm }) => {
      if (!dry_run && confirm !== true) return errorResult(NEEDS_CONFIRM);
      const cx = await loadCx(supabase);
      if (!cx) return errorResult(NO_PROGRAM);
      const pick = (name: string) => {
        const m = findExercises(name, cx.catalog);
        return m.length === 1 ? { ok: true as const, slug: m[0].slug } : { ok: false as const, error: m.length === 0 ? `I don’t know an exercise called “${name}”.` : `“${name}” could be ${m.map((x) => x.name).join(" or ")}. Which one?` };
      };
      const out = pick(exercise);
      if (!out.ok) return errorResult(out.error);

      let inSlug: string;
      if (withName.trim().toLowerCase() === "backup") {
        const { data: ex } = await supabase.from("exercises").select("backup_name").eq("slug", out.slug).maybeSingle();
        if (!ex?.backup_name) return errorResult(`${cx.exercises.get(out.slug)?.name} has no built-in backup. Name the exercise to swap in.`);
        const b = pick(ex.backup_name);
        if (!b.ok) return errorResult(`Its backup is “${ex.backup_name}”, which isn’t in the library as an exercise, so I can’t put it in the plan. Name another exercise to swap in.`);
        inSlug = b.slug;
      } else {
        const i = pick(withName);
        if (!i.ok) return errorResult(i.error);
        inSlug = i.slug;
      }
      if (inSlug === out.slug) return errorResult("That’s the same exercise. Nothing to swap.");

      const { data: tpl } = await supabase.from("program_templates").select("id").eq("user_id", uid).eq("plan_type", cx.state.planType).maybeSingle();
      if (!tpl) return errorResult(NO_PROGRAM);
      const { data: where } = await supabase.from("template_exercises").select("weekday").eq("template_id", tpl.id).eq("exercise_slug", out.slug).order("weekday");
      const days = (where ?? []).map((r) => r.weekday);
      const outName = cx.exercises.get(out.slug)!.name;
      const inInfo = cx.exercises.get(inSlug)!;
      if (!days.length) return errorResult(`${outName} isn’t in your plan, so there’s nothing to swap.`);
      let day = weekday;
      if (day === undefined) {
        if (days.length > 1) return errorResult(`${outName} is on ${days.map(longDay).join(" and ")}. Which weekday should I change? (Give weekday, 1 = Monday.)`);
        day = days[0];
      } else if (!days.includes(day)) {
        return errorResult(`${outName} isn’t on ${longDay(day)}. It’s on ${days.map(longDay).join(" and ")}.`);
      }

      const { data: rows } = await supabase.from("template_exercises").select("exercise_slug, sets, rep_lo, rep_hi").eq("template_id", tpl.id).eq("weekday", day).order("position");
      const before = rows ?? [];
      if (before.some((r) => r.exercise_slug === inSlug)) return errorResult(`${inInfo.name} is already on ${longDay(day)}. Swap it for something else, or use edit_plan_day.`);
      const lo = rep_lo ?? inInfo.repLo;
      const hi = rep_hi ?? inInfo.repHi;
      if (hi < lo) return errorResult("rep_hi must be at least rep_lo.");
      const after = before.map((r) => (r.exercise_slug === out.slug ? { slug: inSlug, sets: r.sets, rep_lo: lo, rep_hi: hi } : { slug: r.exercise_slug, sets: r.sets, rep_lo: r.rep_lo, rep_hi: r.rep_hi }));
      const old = before.find((r) => r.exercise_slug === out.slug)!;
      const report = `${longDay(day)}: ${outName} (${old.sets} × ${old.rep_lo}-${old.rep_hi}) → ${inInfo.name} (${old.sets} × ${lo}-${hi})`;
      if (dry_run) return textResult(["Preview:", report, "Nothing was changed.", `Note: ${inInfo.name} starts with its own history, so its first session shows “First time”.`].join("\n"));

      const { error } = await supabase.rpc("replace_day_exercises", { p_template: tpl.id, p_weekday: day, p_rows: after });
      if (error) return errorResult(FRIENDLY);
      await recordChange(supabase, {
        source: "claude", action: "edit_plan_day", undoable: true,
        summary: `Swapped ${outName} for ${inInfo.name} on ${longDay(day)}`,
        before: { kind: "edit_plan_day", template_id: tpl.id, weekday: day, rows: before.map((r) => ({ slug: r.exercise_slug, sets: r.sets, rep_lo: r.rep_lo, rep_hi: r.rep_hi })) },
        after: { rows: after },
      });
      return textResult([`Swapped. ${report}`, UNDO_NOTE].join("\n"));
    },
  );

  // ---------------------------------------------------------------- schedule_day
  server.registerTool(
    "schedule_day",
    {
      title: "Skip, move or lighten a day",
      description:
        "Change what happens to a session on a date in THIS week: skip it, do a light version (about 20% lighter), move it to a free day (move_to, today or later this week), or clear the choice. A skipped day can still be done later with start_workout. Recorded in the change log and can be undone.",
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
      const { data: prev } = await supabase.from("schedule_overrides").select("planned_date, action, moved_to_date").eq("planned_date", date).maybeSingle();
      const label = `${longDay(weekdayOf(date))} ${date}`;
      let summary: string;
      if (action === "clear") {
        const { error } = await supabase.from("schedule_overrides").delete().eq("planned_date", date);
        if (error) return errorResult(FRIENDLY);
        summary = `Cleared the skip, move or light choice for ${label}`;
      } else {
        const dbAction = action === "skip" ? "skipped" : action === "move" ? "moved" : "light";
        const { error } = await supabase
          .from("schedule_overrides")
          .upsert({ planned_date: date, action: dbAction, moved_to_date: action === "move" ? move_to! : null }, { onConflict: "user_id,planned_date" });
        if (error) return errorResult(FRIENDLY);
        const what = action === "skip" ? "skipped" : action === "light" ? "set to a light version" : `moved to ${longDay(weekdayOf(move_to!))} ${move_to}`;
        summary = `${label} ${what}`;
      }
      await recordChange(supabase, { source: "claude", action: "schedule_day", undoable: true, summary, before: { kind: "schedule_day", planned_date: date, previous: prev ?? null } });
      return textResult(`${summary}. ${UNDO_NOTE}`);
    },
  );

  // ---------------------------------------------------------------- update_settings
  server.registerTool(
    "update_settings",
    {
      title: "Change settings",
      description:
        "Change rest-over alerts, bodyweight tracking, or which programme weeks are deload weeks (half the sets). Only the fields you give are changed. Cannot change the start date or plan type. Use dry_run: true to preview. Recorded in the change log and can be undone.",
      inputSchema: {
        rest_alerts: z.boolean().optional(),
        track_bodyweight: z.boolean().optional(),
        deload_weeks: z.array(z.number().int().min(1).max(12)).max(12).optional().describe("The full list of deload weeks (1-12)"),
        dry_run: PREVIEW.dry_run,
      },
      annotations: CHANGE,
    },
    async ({ rest_alerts, track_bodyweight, deload_weeks, dry_run }) => {
      const patch: { rest_alerts?: boolean; track_bodyweight?: boolean; deload_weeks?: number[] } = {};
      if (rest_alerts !== undefined) patch.rest_alerts = rest_alerts;
      if (track_bodyweight !== undefined) patch.track_bodyweight = track_bodyweight;
      if (deload_weeks !== undefined) patch.deload_weeks = [...new Set(deload_weeks)].sort((a, b) => a - b);
      if (Object.keys(patch).length === 0) return errorResult("Nothing to change: give at least one field.");
      const { data: cur } = await supabase.from("program_state").select("rest_alerts, track_bodyweight, deload_weeks").maybeSingle();
      if (!cur) return errorResult(NO_PROGRAM);
      const fmt = (v: unknown) => (Array.isArray(v) ? (v.length ? v.join(", ") : "none") : String(v));
      const diff = Object.entries(patch).map(([k, v]) => `${k.replace(/_/g, " ")}: ${fmt((cur as Record<string, unknown>)[k])} → ${fmt(v)}`);
      if (dry_run) return textResult(["Preview:", ...diff, "Nothing was changed."].join("\n"));

      const previous = Object.fromEntries(Object.keys(patch).map((k) => [k, (cur as Record<string, unknown>)[k]]));
      const { error } = await supabase.from("program_state").update(patch).not("user_id", "is", null);
      if (error) return errorResult(FRIENDLY);
      await recordChange(supabase, { source: "claude", action: "update_settings", undoable: true, summary: `Settings: ${diff.join("; ")}`, before: { kind: "update_settings", previous } });
      return textResult(`Settings updated: ${diff.join("; ")}. ${UNDO_NOTE}`);
    },
  );

  // ---------------------------------------------------------------- set_exercise_settings
  server.registerTool(
    "set_exercise_settings",
    {
      title: "Per-exercise settings",
      description: "Set one exercise's weight jump (kg), starting weight (kg), machine notes or its Swap-button substitute (backup). Only the fields you give are changed. Pass notes as an empty string to clear them. Recorded in the change log and can be undone.",
      inputSchema: {
        exercise: z.string().min(2).max(60),
        weight_jump_kg: z.number().min(0.5).max(20).optional(),
        start_weight_kg: z.number().min(0).max(400).optional(),
        notes: z.string().max(200).optional(),
        backup: z.string().max(60).optional().describe("The substitute the Swap button offers for this exercise (a library exercise name works best, so its form guide shows). Pass an empty string to go back to the built-in backup."),
      },
      annotations: CHANGE,
    },
    async ({ exercise, weight_jump_kg, start_weight_kg, notes, backup }) => {
      const cx = await loadCx(supabase);
      if (!cx) return errorResult(NO_PROGRAM);
      const m = findExercises(exercise, cx.catalog);
      if (m.length !== 1) return errorResult(m.length === 0 ? `I don’t know an exercise called “${exercise}”.` : `“${exercise}” could be ${m.map((x) => x.name).join(" or ")}. Which one?`);
      const row: { exercise_slug: string; increment_kg?: number; start_weight_kg?: number; notes?: string | null; backup_name?: string | null } = { exercise_slug: m[0].slug };
      if (weight_jump_kg !== undefined) row.increment_kg = weight_jump_kg;
      if (start_weight_kg !== undefined) row.start_weight_kg = start_weight_kg;
      if (notes !== undefined) row.notes = notes.trim() || null;
      if (backup !== undefined) {
        const b = backup.trim();
        if (!b) row.backup_name = null;
        else {
          if (b.length < 2) return errorResult("backup needs at least 2 characters.");
          const hit = findExercises(b, cx.catalog);
          if (hit.length > 1) return errorResult(`“${b}” could be ${hit.map((x) => x.name).join(" or ")}. Which one?`);
          if (hit.length === 1 && hit[0].slug === m[0].slug) return errorResult("That’s the same exercise, so it can’t be its own substitute.");
          row.backup_name = hit.length === 1 ? hit[0].name : b; // a library name keeps the form guide working
        }
      }
      if (Object.keys(row).length === 1) return errorResult("Nothing to change: give weight_jump_kg, start_weight_kg, notes or backup.");
      const { data: prev } = await supabase.from("user_exercise_settings").select("*").eq("exercise_slug", m[0].slug).maybeSingle();
      const { error } = await supabase.from("user_exercise_settings").upsert(row, { onConflict: "user_id,exercise_slug" });
      if (error) return errorResult(FRIENDLY);
      const what = Object.entries(row).filter(([k]) => k !== "exercise_slug").map(([k, v]) => `${k === "backup_name" ? "swap substitute" : k.replace(/_/g, " ")} = ${v ?? "cleared (built-in backup)"}`).join("; ");
      const previous = prev ? (({ user_id: _u, ...r }) => (void _u, r))(prev) : null;
      await recordChange(supabase, { source: "claude", action: "exercise_settings", undoable: true, summary: `${m[0].name}: ${what}`, before: { kind: "exercise_settings", exercise_slug: m[0].slug, previous } });
      return textResult(`${m[0].name} updated: ${what}. ${UNDO_NOTE}`);
    },
  );

  // ---------------------------------------------------------------- get_change_log
  server.registerTool(
    "get_change_log",
    {
      title: "Change log",
      description: "The most recent edits and deletes made by Claude or in the app (plan, settings, schedule, deleted data), newest first, with ids you can pass to undo_change. Read-only.",
      inputSchema: { limit: z.number().int().min(1).max(50).default(15) },
      annotations: READ,
    },
    async ({ limit }) => {
      const rows = await listChanges(supabase, limit);
      if (!rows.length) return textResult("No changes recorded yet.");
      return textResult(
        json(rows.map((r) => ({ id: r.id, when: r.created_at, by: r.source === "claude" ? "Claude" : "the app", what: r.summary, status: r.undone_at ? "undone" : r.undoable ? "can be undone" : "cannot be undone" }))),
      );
    },
  );

  // ---------------------------------------------------------------- undo_change
  server.registerTool(
    "undo_change",
    {
      title: "Undo a change",
      description: "Put back what a logged change replaced or deleted (an id from get_change_log). A change can only be undone once. Returns what was restored.",
      inputSchema: { id: z.string().uuid() },
      annotations: CHANGE,
    },
    async ({ id }) => {
      const r = await undoChange(supabase, id);
      if (!r.ok) return errorResult(r.error);
      return textResult(`Undone: ${r.summary}.`);
    },
  );
}
