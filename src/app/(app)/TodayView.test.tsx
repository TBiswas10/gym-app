import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TodayView } from "./TodayView";
import { buildStrip, freeDays, missedCard, type Override } from "@/lib/schedule";
import { programmeWeek, isSetupWeek, longDay } from "@/lib/dates";
import type { DayExercise, PlanDay, TodayData } from "@/lib/server/today-data";

const ex = (slug: string, name: string, kind: DayExercise["kind"] = "weight", lo = 8, hi = 12): DayExercise => ({
  slug, name, kind, sets: 2, repLo: lo, repHi: hi, hasStartWeight: true,
});
const day = (weekday: number, shortName: string, fullName: string, cardioName: string, cardioLabel: string, cardioMinutes: number, exercises: DayExercise[], isLightDay = false): PlanDay => ({
  weekday, shortName, fullName, isLightDay, cardioName, cardioLabel, cardioMinutes, exercises,
});

const DAYS: Record<number, PlanDay> = {
  1: day(1, "Push", "Push", "Bike or cross-trainer", "10 min", 10, [ex("chest", "Chest press"), ex("incline", "Incline dumbbell press"), ex("shoulder", "Shoulder press"), ex("lateral", "Lateral raise"), ex("triceps", "Triceps pushdown")]),
  2: day(2, "Pull", "Pull", "Rower or bike", "8–10 min", 9, [ex("lat", "Lat pulldown"), ex("row", "Seated row"), ex("reardelt", "Rear delt fly"), ex("hammer", "Hammer curl"), ex("cablecurl", "Cable curl")]),
  3: day(3, "Legs", "Legs + Core", "Easy treadmill walk", "10 min", 10, [ex("legpress", "Leg press"), ex("legcurl", "Seated leg curl", "weight", 10, 12), ex("legext", "Leg extension"), ex("calf", "Calf raise", "weight", 12, 15), ex("plank", "Plank", "timed", 20, 40)]),
  4: day(4, "Upper", "Upper (light)", "Bike or treadmill", "10 min", 10, [ex("chest", "Chest press"), ex("lat", "Lat pulldown"), ex("shoulder", "Shoulder press"), ex("row", "Seated row"), ex("triceps", "Triceps pushdown"), ex("cablecurl", "Cable curl")], true),
  6: day(6, "Lower", "Lower + Core + Cardio", "Incline treadmill walk or stair machine", "15 min", 15, [ex("legpress", "Leg press"), ex("legcurl", "Seated leg curl", "weight", 10, 12), ex("back", "Back extension", "bodyweight", 10, 12), ex("glute", "Glute bridge / hip thrust", "weight", 10, 12), ex("calf", "Calf raise", "weight", 12, 15), ex("plank", "Plank", "timed", 20, 40)]),
};

function make(opts: { today: string; start: string; completed?: string[]; overrides?: Override[]; totalDone?: number; weekDone?: number; weekSets?: number; toGo?: string[] }): TodayData {
  const completed = new Set(opts.completed ?? []);
  const overrides = opts.overrides ?? [];
  const strip = buildStrip({ today: opts.today, startDate: opts.start, liftWeekdays: [1, 2, 3, 4, 6], completed, overrides });
  const week = programmeWeek(opts.start, opts.today);
  return {
    today: opts.today, startDate: opts.start, week, complete: false, setup: isSetupWeek(week), planType: "5day", days: DAYS, strip,
    missed: missedCard(strip, overrides, completed, opts.today),
    free: freeDays(strip, opts.today).map((d) => ({ date: d.date, label: longDay(d.weekday) })),
    restLogs: {}, totalDone: opts.totalDone ?? 0, weekDone: opts.weekDone ?? 0, weekPlan: 5, weekSets: opts.weekSets ?? 0, toGo: opts.toGo ?? [], highSoreness: false, checkIn: null, deloadSuggested: false, inDeload: false,
  };
}
const html = (d: TodayData) => renderToStaticMarkup(<TodayView data={d} />);
const htmlWith = (d: TodayData, v2: NonNullable<Parameters<typeof TodayView>[0]["v2"]>) => renderToStaticMarkup(<TodayView data={d} v2={v2} />);

describe("Today header and list", () => {
  const base = make({ today: "2026-10-08", start: "2026-09-21", completed: ["2026-10-05", "2026-10-07"], totalDone: 9, weekDone: 2, weekSets: 20 });
  it("says it is a rest day on a rest day", () => {
    expect(html(make({ today: "2026-10-09", start: "2026-09-21", completed: ["2026-10-05", "2026-10-07"], totalDone: 9 }))).toContain("Rest day.");
  });
  it("says it is done once today is ticked", () => {
    expect(html(make({ today: "2026-10-08", start: "2026-09-21", completed: ["2026-10-05", "2026-10-07", "2026-10-08"], totalDone: 10 }))).toContain("Done for today. Nice work.");
  });
  it("shows last time's number under each lift when it has one", () => {
    const out = htmlWith(base, { lasts: { chest: "30 kg", plank: "40 s" }, briefing: null, nudges: [], review: null });
    expect(out).toContain("Last 30 kg");
    expect(out).not.toContain("Last undefined");
  });
});

describe("Today screen", () => {
  it("renders the week 3 example from the design", () => {
    const out = html(make({ today: "2026-10-08", start: "2026-09-21", completed: ["2026-10-05", "2026-10-07"], totalDone: 9, weekDone: 2, weekSets: 20, toGo: ["Thursday", "Saturday"] }));
    expect(out).toContain("Thursday 8 October · Week 3 of 12");
    expect(out).toContain("Upper (light) today"); // the header says what today is
    expect(out).toContain("Today · Thursday");
    expect(out).toContain("Upper (light)");
    expect(out).toContain("6 exercises · 2 sets each");
    expect(out).toContain("~40"); // 30 lifts + 10 cardio (cardio is the warm-up)
    expect(out).toContain("Start workout");
    expect(out).toContain("Go light today");
    expect(out).toContain("Cardio · Bike or treadmill");
    // the missed day is one row until you open it
    expect(out).toContain("MISSED WORKOUT");
    expect(out).toContain("Tuesday’s Pull didn’t happen");
    expect(out).not.toContain("Setup mode");
    expect(out).toContain("Sets");
    expect(out).toContain("This week");
    expect(out).toContain("Sessions");
    expect(out).toContain("Sessions 2 of 5");
  });

  it("renders the first-run state (week 1, setup mode)", () => {
    const out = html(make({ today: "2026-10-08", start: "2026-10-08", toGo: ["Thursday", "Saturday"] }));
    expect(out).toContain("Welcome. Let’s find your weights.");
    expect(out).toContain("Setup mode · weeks 1 and 2");
    expect(out).toContain("Your first session is today.");
    expect(out).toContain("Thursday and Saturday to go");
    expect(out).not.toContain("Missed workout");
    expect(out).not.toContain("didn’t happen");
  });

  it("starts the workout directly in setup weeks: no separate find-weight step", () => {
    const d = make({ today: "2026-10-08", start: "2026-10-08" });
    d.days[4] = { ...d.days[4], exercises: d.days[4].exercises.map((e) => ({ ...e, hasStartWeight: false })) };
    const out = html(d);
    expect(out).not.toContain("Find weight");
    expect(out).not.toContain("/find-weight");
    expect(out).toContain("/workout?date=");
  });

  it("never asks to find a weight for planks or bodyweight moves", () => {
    const d = make({ today: "2026-10-08", start: "2026-10-08" });
    d.days[4] = { ...d.days[4], exercises: d.days[4].exercises.map((e) => ({ ...e, kind: "timed" as const, hasStartWeight: false })) };
    expect(html(d)).not.toContain("Find weight");
  });

  it("shows the test-mode card with every day and an exit, only when test mode is on", () => {
    const d = make({ today: "2026-10-08", start: "2026-09-21" });
    expect(html(d)).not.toContain("Test mode");
    const on = html({ ...d, testMode: true });
    expect(on).toContain("Test mode");
    expect(on).toContain("/workout?test=1");
    expect(on).toContain("/workout?test=6");
    expect(on).toContain("Exit test mode");
    expect(on).toContain("/review?week=4");
  });

  it("renders a rest day with walk and stretch", () => {
    const out = html(make({ today: "2026-10-09", start: "2026-09-21", completed: ["2026-10-05", "2026-10-07", "2026-10-08"] }));
    expect(out).toContain("Rest day");
    expect(out).toContain("Easy walk");
    expect(out).toContain("Stretch");
    expect(out).not.toContain("Start workout");
  });

  it("shows the light confirmation with a start button", () => {
    const o: Override[] = [{ plannedDate: "2026-10-06", action: "light", movedToDate: null, createdOn: "2026-10-07" }];
    const out = html(make({ today: "2026-10-08", start: "2026-09-21", completed: ["2026-10-05", "2026-10-07"], overrides: o }));
    expect(out).toContain("Light Pull is ready");
    expect(out).toContain("Start light Pull");
    expect(out).not.toContain("didn’t happen");
  });

  it("shows moved and skipped confirmations with Undo", () => {
    const moved: Override[] = [{ plannedDate: "2026-10-06", action: "moved", movedToDate: "2026-10-09", createdOn: "2026-10-08" }];
    const m = html(make({ today: "2026-10-08", start: "2026-09-21", completed: ["2026-10-05", "2026-10-07"], overrides: moved }));
    expect(m).toContain("Pull moved to Friday");
    expect(m).toContain("Undo");
    const skipped: Override[] = [{ plannedDate: "2026-10-06", action: "skipped", movedToDate: null, createdOn: "2026-10-08" }];
    const s = html(make({ today: "2026-10-08", start: "2026-09-21", completed: ["2026-10-05", "2026-10-07"], overrides: skipped, toGo: ["Thursday", "Saturday"] }));
    expect(s).toContain("Pull skipped");
    expect(s).toContain("Back to the plan on Thursday.");
  });

  it("lists every weekday in the strip with accessible labels", () => {
    const out = html(make({ today: "2026-10-08", start: "2026-09-21", completed: ["2026-10-05", "2026-10-07"] }));
    expect(out).toContain('aria-label="Monday Push, done"');
    expect(out).toContain('aria-label="Tuesday Pull, missed"');
    expect(out).toContain('aria-label="Thursday Upper, today"');
    expect(out).toContain('aria-label="Friday Rest, rest day"');
  });
});
