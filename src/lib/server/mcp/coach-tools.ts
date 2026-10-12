import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ServerClient } from "../../supabase/server";
import { sydneyDate, weekDates } from "../../dates";
import { fmtNum } from "../../format";
import { goalUnit, recordNumber } from "../../goals";
import { findExercises } from "../../parser";
import { records } from "../../stats";
import { loadCx } from "./context";
import { errorResult, json, textResult } from "./format";
import { loadGoals, loadReviews } from "../v2-data";

// The weekly coach and goals. Claude writes the review (it can read everything else), the app shows it; goals are
// targets Claude or you set per exercise. Reviews and goals are the only things written here.

interface Ctx {
  supabase: ServerClient;
  uid: string;
}

const FRIENDLY = "That didn’t save. Try again in a moment.";
const NO_PROGRAM = "The programme hasn’t been started yet. Open the app and finish setup first.";
const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const CHANGE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const DESTROY = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } as const;
const LINE = z.string().min(2).max(200);

export function registerCoachTools(server: McpServer, { supabase }: Ctx): void {
  // ---------------------------------------------------------------- the prompt that starts a weekly review
  server.registerPrompt(
    "weekly_review",
    {
      title: "Weekly review",
      description: "Write this week's review: gather the numbers, then save it so it shows in the app.",
    },
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Write my weekly training review.",
              "1. Call get_week_summary for the plan against what I did, get_progress and get_records for strength and stalled lifts, get_history (days: 7) for the sets, get_cardio, get_bodyweight and get_goals.",
              "2. Be specific and kind. Name real lifts and real numbers. No more than three wins, three things to watch and three things for next week, each one short sentence.",
              "3. Call save_weekly_review with a one-line headline and those lists. It shows on my Progress tab and on Today.",
              "4. Tell me the headline and anything you want me to decide (use the plan tools only if I agree).",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  // ---------------------------------------------------------------- save_weekly_review
  server.registerTool(
    "save_weekly_review",
    {
      title: "Save the weekly review",
      description:
        "Save the weekly review so it appears in the app (Progress tab, and a pointer on Today). One review per week: saving again for the same week replaces it. Give a one-line headline and up to 6 short lines each for wins, things to watch and next week. week_of is any date in the week (default this week).",
      inputSchema: {
        week_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        headline: z.string().min(3).max(200),
        wins: z.array(LINE).max(6).default([]),
        watch: z.array(LINE).max(6).default([]),
        next_week: z.array(LINE).max(6).default([]),
      },
      annotations: CHANGE,
    },
    async ({ week_of, headline, wins, watch, next_week }) => {
      const weekStart = weekDates(week_of ?? sydneyDate())[0];
      const { error } = await supabase
        .from("coach_reviews")
        .upsert({ week_start: weekStart, headline: headline.trim(), wins, watch, next_week, source: "claude" }, { onConflict: "user_id,week_start" });
      if (error) return errorResult(FRIENDLY);
      return textResult(`Saved the review for the week of ${weekStart}: “${headline.trim()}”. It shows on the Progress tab and Today.`);
    },
  );

  // ---------------------------------------------------------------- get_weekly_reviews
  server.registerTool(
    "get_weekly_reviews",
    {
      title: "Earlier weekly reviews",
      description: "The weekly reviews saved so far, newest first. Read-only.",
      inputSchema: { limit: z.number().int().min(1).max(12).default(4) },
      annotations: READ,
    },
    async ({ limit }) => {
      const rows = await loadReviews(supabase, limit);
      if (!rows.length) return textResult("No weekly reviews saved yet.");
      return textResult(json(rows.map((r) => ({ week_of: r.weekStart, headline: r.headline, wins: r.wins, watch: r.watch, next_week: r.nextWeek }))));
    },
  );

  // ---------------------------------------------------------------- get_goals
  server.registerTool(
    "get_goals",
    {
      title: "Goals",
      description: "Your goals with the best number so far and how far to go. Read-only.",
      annotations: READ,
    },
    async () => {
      const goals = await loadGoals(supabase);
      if (!goals.length) return textResult("No goals set yet. Use set_goal to add one.");
      return textResult(
        json(
          goals.map((g) => ({
            exercise: g.name,
            target: `${fmtNum(g.target)} ${g.unit}`,
            best_so_far: `${fmtNum(g.current)} ${g.unit}`,
            to_go: g.reached ? "reached" : `${fmtNum(g.toGo)} ${g.unit}`,
            progress: `${Math.round(g.fraction * 100)}%`,
          })),
        ),
      );
    },
  );

  // ---------------------------------------------------------------- set_goal
  server.registerTool(
    "set_goal",
    {
      title: "Set a goal",
      description:
        "Set or change the goal for one exercise: a target top weight in kg, a hold in seconds (planks) or bodyweight reps. It must be above your current best. One goal per exercise; setting it again replaces it.",
      inputSchema: {
        exercise: z.string().min(2).max(60),
        target: z.number().positive().max(1000),
      },
      annotations: CHANGE,
    },
    async ({ exercise, target }) => {
      const cx = await loadCx(supabase);
      if (!cx) return errorResult(NO_PROGRAM);
      const m = findExercises(exercise, cx.catalog);
      if (m.length !== 1) return errorResult(m.length === 0 ? `I don’t know an exercise called “${exercise}”.` : `“${exercise}” could be ${m.map((x) => x.name).join(" or ")}. Which one?`);
      const info = cx.exercises.get(m[0].slug)!;

      const { data: done } = await supabase.from("workouts").select("id").eq("status", "completed").eq("is_test", false);
      const ids = (done ?? []).map((w) => w.id);
      let start = 0;
      if (ids.length) {
        const { data: sets } = await supabase.from("sets").select("workout_id, exercise_slug, set_number, weight_kg, reps, seconds, variant").in("workout_id", ids).eq("exercise_slug", info.slug);
        const rec = records(sets ?? [], { [info.slug]: info.kind })[0];
        if (rec) start = recordNumber(info.kind, rec.value);
      }
      const unit = goalUnit(info.kind);
      if (target <= start) return errorResult(`${info.name} is already at ${fmtNum(start)} ${unit}. Pick a target above that.`);

      const { error } = await supabase.from("goals").upsert({ exercise_slug: info.slug, target: Math.round(target * 10) / 10, start_value: start }, { onConflict: "user_id,exercise_slug" });
      if (error) return errorResult(FRIENDLY);
      return textResult(`Goal set: ${info.name} to ${fmtNum(target)} ${unit} (best so far ${fmtNum(start)} ${unit}).`);
    },
  );

  // ---------------------------------------------------------------- remove_goal
  server.registerTool(
    "remove_goal",
    {
      title: "Remove a goal",
      description: "Remove the goal for one exercise. Needs confirm: true. The exercise and its history are not touched.",
      inputSchema: {
        exercise: z.string().min(2).max(60),
        confirm: z.literal(true).optional().describe("Must be true to actually remove it"),
      },
      annotations: DESTROY,
    },
    async ({ exercise, confirm }) => {
      const cx = await loadCx(supabase);
      if (!cx) return errorResult(NO_PROGRAM);
      const m = findExercises(exercise, cx.catalog);
      if (m.length !== 1) return errorResult(m.length === 0 ? `I don’t know an exercise called “${exercise}”.` : `“${exercise}” could be ${m.map((x) => x.name).join(" or ")}. Which one?`);
      const { data: g } = await supabase.from("goals").select("id, target").eq("exercise_slug", m[0].slug).maybeSingle();
      if (!g) return textResult(`There’s no goal for ${cx.exercises.get(m[0].slug)!.name}.`);
      if (confirm !== true) return errorResult(`Nothing was changed. Run it again with confirm: true to remove the ${cx.exercises.get(m[0].slug)!.name} goal (${fmtNum(Number(g.target))}).`);
      const { error } = await supabase.from("goals").delete().eq("id", g.id);
      if (error) return errorResult(FRIENDLY);
      return textResult(`Removed the goal for ${cx.exercises.get(m[0].slug)!.name}.`);
    },
  );
}
