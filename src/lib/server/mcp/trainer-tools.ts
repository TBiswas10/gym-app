import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerClient } from "../../supabase/server";
import { longDay, weekdayOf } from "../../dates";
import { loadProgress } from "../progress-data";
import { loadToday } from "../today-data";
import { loadGoals } from "../v2-data";
import { loadCx } from "./context";
import { errorResult, json, textResult } from "./format";

// The personal trainer: one read-only call that gathers what a coach would look at before talking to you, and four
// prompts that start a coaching conversation. The trainer explains, you decide; plan changes only happen after you agree.

interface Ctx {
  supabase: ServerClient;
  uid: string;
}

const NO_PROGRAM = "The programme hasn’t been started yet. Open the app and finish setup first.";
const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

export const TRAINER_RULES = [
  "You are my personal trainer inside this app. I train alone, two sets per exercise, 45 to 50 minutes, on a fixed plan.",
  "Start with get_trainer_brief, then use the other read tools only for what you still need. Use real lifts and real numbers from my data; never invent figures or percentages.",
  "Always say why: every suggestion names the evidence (what I did last time, the trend, how I felt).",
  "The progression rule is fixed: weight goes up only when I hit the top of the rep range on both sets. Do not propose a different rule; you can suggest a rep target, a swap, a rest change or a lighter day.",
  "Sharp or joint pain, dizziness or anything that sounds medical: tell me to stop and see a professional. No diagnosis, no medical advice.",
  "Be warm, direct and short. Three points at most. Ask me before changing the plan, settings or schedule, and use the plan tools only after I agree.",
].join("\n");

export function registerTrainerTools(server: McpServer, { supabase, uid }: Ctx): void {
  const prompt = (name: string, title: string, description: string, steps: string[]) =>
    server.registerPrompt(name, { title, description }, () => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text: [TRAINER_RULES, "", ...steps].join("\n") } }],
    }));

  prompt("personal_trainer", "Personal trainer", "Talk to a personal trainer who has read all your training data.", [
    "Call get_trainer_brief and open with one sentence on where I am in the programme and one thing that is going well.",
    "Then ask what I want help with today (a question, a tough session, a stall, how I feel). Answer it using my numbers.",
  ]);
  prompt("plan_tomorrow", "Plan tomorrow", "A preview of tomorrow's session with what to aim for and what to watch.", [
    "Call get_trainer_brief and get_schedule. Describe tomorrow's session: the lifts, the goal for each (from goal_today), the expected time and cardio.",
    "Flag anything to adjust (high soreness, a stalled lift, a deload week) and propose one change at most. Ask before applying it.",
  ]);
  prompt("post_workout_debrief", "Post-workout debrief", "Review the session I just finished: PBs, misses and what to change.", [
    "Call get_history (days: 1) and get_trainer_brief. Name the best thing I did, any lift that missed its target and why that probably happened, and what I should do next time for the one lift that matters most.",
    "Ask how I felt (soreness and energy) if my check-in is missing, and offer to log it with log_checkin.",
  ]);
  prompt("plateau_detective", "Plateau detective", "Find out why a lift has stalled and what to try.", [
    "Call get_trainer_brief and get_records. Pick the lift that has stalled longest (or the one I name). Look at its numbers across sessions, my soreness and energy, and how many sessions it has had.",
    "Give the most likely cause in one sentence and ONE specific change to try for the next two sessions (rep target, a swap, extra rest, or a smaller weight jump via set_exercise_settings). Ask before changing anything.",
  ]);

  server.registerTool(
    "get_trainer_brief",
    {
      title: "Trainer brief",
      description:
        "Everything a personal trainer would check before talking to you, in one call: where you are in the programme, today's session with the goal for each lift, how you have felt lately, push/pull balance, goals, this week's consistency and the latest weekly review. Read-only.",
      annotations: READ,
    },
    async () => {
      const cx = await loadCx(supabase);
      const t = await loadToday(supabase, uid);
      if (!cx || !t) return errorResult(NO_PROGRAM);
      const [p, goals] = await Promise.all([loadProgress(supabase), loadGoals(supabase).catch(() => [])]);
      const d = t.strip.find((x) => x.date === t.today);
      const plan = d?.sessionOrigin ? t.days[weekdayOf(d.sessionOrigin)] : null;
      const feel = p.trend.map((x) => ({ soreness: x.soreness, energy: x.energy }));
      const avg = (k: "soreness" | "energy") => (feel.length ? Math.round((feel.reduce((n, x) => n + x[k], 0) / feel.length) * 10) / 10 : null);
      return textResult(
        json({
          today: `${longDay(weekdayOf(t.today))} ${t.today}`,
          programme: { week: `${t.week} of 12`, setup_weeks: t.setup, deload_week: t.inDeload, plan: t.planType === "5day" ? "5-day split" : "3-day full body" },
          todays_session: plan ? { name: plan.fullName, status: d?.status, light: d?.light, lifts: plan.exercises.map((e) => e.name), cardio: plan.cardioName } : d?.status === "rest" ? "Rest day" : (d?.status ?? "none"),
          how_i_feel: { recent_checkins: feel.slice(0, 4), average_soreness: avg("soreness"), average_energy: avg("energy"), high_soreness_flag: t.highSoreness },
          this_week: { sessions: `${p.thisWeek.sessions} of ${p.thisWeek.planned}`, sets: p.thisWeek.sets, new_pbs: p.thisWeek.pbs.map((x) => `${x.name} ${x.text}`) },
          consistency: { full_weeks_in_a_row: p.consistency.streak },
          balance_last_4_weeks: p.balance && p.balance.enough ? { push: p.balance.push, pull: p.balance.pull, front: p.balance.front, back: p.balance.back, upper: p.balance.upper, lower: p.balance.lower, notes: p.balance.notes } : "not enough sets yet",
          goals: goals.map((g) => ({ lift: g.name, target: g.target, now: g.current, unit: g.unit, to_go: g.toGo, reached: g.reached })),
          latest_review: p.reviews?.[0] ? { week_of: p.reviews[0].weekStart, headline: p.reviews[0].headline } : null,
          next_checkin_week: p.due ?? p.next ?? null,
        }),
      );
    },
  );
}
