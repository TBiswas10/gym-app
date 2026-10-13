import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }), usePathname: () => "/" }));
import { renderToStaticMarkup } from "react-dom/server";
import { ProgressView } from "./(app)/progress/ProgressView";
import { LibraryView } from "./(app)/library/LibraryView";
import { PlanView } from "./(app)/plan/PlanView";
import { ReviewView } from "./review/ReviewView";
import { CompleteView } from "./complete/CompleteView";
import { GuideView } from "./library/[slug]/GuideView";
import { weekCells } from "@/lib/stats";
import type { ProgressData } from "@/lib/server/progress-data";
import type { PlanData } from "@/lib/server/plan-data";
import type { ReviewData } from "@/lib/server/review-data";
import OfflinePage from "./offline/page";
import NotFound from "./not-found";
import ErrorScreen from "./error";

const progress = (over: Partial<ProgressData> = {}): ProgressData => ({
  week: 3, empty: false,
  chips: [
    { slug: "chest", name: "Chest press", kind: "weight", values: [20, 22.5, 22.5, 25, 25, 27.5, 27.5, 30], unit: "kg" },
    { slug: "lat", name: "Lat pulldown", kind: "weight", values: [27.5, 30, 35], unit: "kg" },
  ],
  thisWeek: { sessions: 3, planned: 5, sets: 32, groups: [["Legs", 8], ["Chest", 6], ["Shoulders", 6], ["Arms", 6], ["Back", 4], ["Core", 2]], pbs: [{ name: "Chest press", text: "30 kg × 12" }] },
  trend: [{ soreness: 4, energy: 2 }, { soreness: 3, energy: 3 }, { soreness: 2, energy: 4 }],
  cells: weekCells(3), records: [{ name: "Chest press", text: "32.5 kg × 10" }], consistency: { weeks: Array.from({ length: 12 }, (_, i) => ({ week: i + 1, done: i < 2 ? 5 : i === 2 ? 3 : 0, planned: 5 })), streak: 2 }, next: 4, due: null, ...over,
});

describe("Progress", () => {
  it("renders the design's sections", () => {
    const out = renderToStaticMarkup(<ProgressView data={progress()} />);
    for (const t of ["Week 3 of 12", "Chest press", "30 kg", "+10 kg over", "Top set, last 8 sessions", "lifts are up", "This week", "3/5", "32", "NEW PBS", "Legs", "8 sets", "How you’ve felt", "Lower is better", "Higher is better", "Easing", "12-week program", "Week 4 check-in next"]) expect(out).toContain(t);
    expect(out).toContain("wk-now");
    expect(out).toContain("wk-check");
  });
  it("shows consistency and the run of full weeks", () => {
    const out = renderToStaticMarkup(<ProgressView data={progress()} />);
    expect(out).toContain("Consistency");
    expect(out).toContain("2 full weeks in a row");
  });

  it("lists all-time records", () => {
    const out = renderToStaticMarkup(<ProgressView data={progress()} />);
    expect(out).toContain("Records");
    expect(out).toContain("32.5 kg × 10");
  });

  it("has a friendly empty state", () => {
    const out = renderToStaticMarkup(<ProgressView data={progress({ empty: true, chips: [], trend: [], thisWeek: { sessions: 0, planned: 5, sets: 0, groups: [], pbs: [] } })} />);
    expect(out).toContain("Your first session shows up here");
    expect(out).toContain("After each session you’ll rate soreness and energy");
  });
  it("says a check-in is ready when one is due", () => {
    expect(renderToStaticMarkup(<ProgressView data={progress({ due: 4 })} />)).toContain("Week 4 check-in is ready");
  });
});

describe("Library", () => {
  const items = [
    { slug: "chest", name: "Chest press", group: "Chest", kit: "Machine", muscles: ["Chest"], setup: ["Adjust the seat."], cues: ["Push."], mistakes: ["Locking."] },
    { slug: "lat", name: "Lat pulldown", group: "Back", kit: "Cable", muscles: ["Lats"], setup: ["Set the pad."], cues: ["Pull."], mistakes: ["Swinging."] },
  ];
  it("marks the exercises that are in your plan, with their days and today", () => {
    const out = renderToStaticMarkup(<LibraryView items={items} plan={{ chest: [1, 4] }} todayWeekday={4} />);
    expect(out).toContain("lib-in"); // chest is highlighted
    expect(out).toContain("My plan (1)");
    expect(out).toContain("In your plan: Mon, Thu");
    expect(out).toContain("Today");
    // lat is not in the plan: it has no days
    expect(out.match(/lib-in/g)?.length).toBe(1);
  });
  it("has no My plan filter and no marks when nothing is in the plan", () => {
    const out = renderToStaticMarkup(<LibraryView items={items} plan={{}} />);
    expect(out).not.toContain("My plan");
    expect(out).not.toContain("lib-in");
  });
  it("lists exercises with filters", () => {
    const out = renderToStaticMarkup(<LibraryView items={items} />);
    expect(out).toContain("2 exercises. Tap one for a quick guide.");
    expect(out).toContain("Chest press");
    expect(out).toContain("Chest · Machine");
    for (const g of ["All", "Back", "Shoulders", "Arms", "Legs", "Core"]) expect(out).toContain(`>${g}<`);
  });
  it("has a search box that never zooms the page and no clear button until you type", () => {
    const out = renderToStaticMarkup(<LibraryView items={items} />);
    expect(out).toContain('type="search"');
    expect(out).toContain("Search exercises, muscles, machines");
    expect(out).not.toContain("Clear search");
  });
});

describe("Form guide", () => {
  const props = { slug: "lat", name: "Lat pulldown", kit: "Cable", kind: "weight" as const, muscles: ["Lats", "Biceps"], tabs: [["Set the pad."], ["Pull."], ["Swinging."]], step: 2.5, defaultIncrement: 2.5, increment: null, notes: "Notch 5", hasActive: false };
  it("shows steps, progress, weight jump and notes", () => {
    const out = renderToStaticMarkup(<GuideView {...props} series={[27.5, 30, 35]} />);
    for (const t of ["Lat pulldown", "Set the pad.", "35 kg", "+7.5 kg overall", "Weight jump", "Default", "Machine notes", "Back to Library"]) expect(out).toContain(t);
  });
  it("copes with no history, and uses seconds for planks", () => {
    expect(renderToStaticMarkup(<GuideView {...props} series={[]} />)).toContain("No sessions yet");
    expect(renderToStaticMarkup(<GuideView {...props} kind="timed" series={[30, 35]} />)).toContain("35 s");
  });
});

describe("Plan", () => {
  const data: PlanData = {
    planType: "5day", templateId: "11111111-1111-4111-8111-111111111111", email: "me@example.com", restAlerts: true, trackBodyweight: false,
    library: [{ slug: "chest", name: "Chest press", group: "Chest", kind: "weight", repLo: 8, repHi: 12 }, { slug: "lat", name: "Lat pulldown", group: "Back", kind: "weight", repLo: 8, repHi: 12 }],
    days: [
      { weekday: 1, shortName: "Push", fullName: "Push", cardioName: "Bike or cross-trainer", cardioLabel: "10 min", cardioMinutes: 10, exercises: [{ slug: "chest", name: "Chest press", kind: "weight", sets: 2, repLo: 8, repHi: 12 }] },
      { weekday: 6, shortName: "Lower", fullName: "Lower + Core + Cardio", cardioName: "Incline treadmill walk or stair machine", cardioLabel: "15 min", cardioMinutes: 15, exercises: [] },
    ],
  };
  it("renders the editor and settings", () => {
    const out = renderToStaticMarkup(<PlanView data={data} />);
    for (const t of ["5-day split", "3-day full body", "Mon to Thu and Sat. Fri and Sun are rest days.", "Push · 1 exercises", "About 15 min with cardio first. Cap is 50.", "Chest press", "2 sets × 8–12 reps", "Cardio · Bike or cross-trainer", "Add exercise", "Notify me when rest ends", "Bodyweight tracking", "Export data as CSV", "Log out (me@example.com)"]) expect(out).toContain(t);
    expect(out).not.toContain("Delete my account");
  });
  it("shows the 3-day wording", () => {
    const out = renderToStaticMarkup(<PlanView data={{ ...data, planType: "3day" }} />);
    expect(out).toContain("Mon, Wed and Sat. Everything else is rest.");
  });
});

describe("Review", () => {
  const base: ReviewData = {
    week: 4, available: true, rec: "build", applied: null,
    input: { sessionsDone: 16, sessionsPlanned: 17, avgSoreness: 2.6, avgEnergy: 3.8 },
    why: "You did 16 of 17 sessions and recovery looks good.",
    rows: [{ name: "Chest press", from: 20, to: 30, delta: 10 }],
  };
  it("renders the check-in", () => {
    const out = renderToStaticMarkup(<ReviewView data={base} />);
    for (const t of ["Week 4 check-in", "16/17", "2.6", "3.8", "Strength since week 1", "20 → 30 kg", "+10", "Keep building", "Hold", "Deload", "Apply: Keep building"]) expect(out).toContain(t);
  });
  it("renders the deload and hold styles", () => {
    expect(renderToStaticMarkup(<ReviewView data={{ ...base, rec: "deload", why: "Soreness is high." }} />)).toContain("card-warning");
    expect(renderToStaticMarkup(<ReviewView data={{ ...base, rec: "hold" }} />)).toContain("card-raised");
  });
  it("shows an applied choice and a not-ready note", () => {
    expect(renderToStaticMarkup(<ReviewView data={{ ...base, applied: "hold" }} />)).toContain("Added to your plan: Hold");
    expect(renderToStaticMarkup(<ReviewView data={{ ...base, available: false }} />)).toContain("hasn’t started yet");
  });
});

describe("Session complete", () => {
  const data = { name: "Upper (light)", line: "2 of 5 sessions this week. 3 to go.", sets: 12, time: "46:12", pbs: [{ name: "Chest press", text: "30 kg × 12" }], cardio: "10 min on the bike", soreness: 2, energy: 4, notes: "", trackBodyweight: true, bodyweight: "" };
  it("opens with one big tick, then the check-in", () => {
    const out = renderToStaticMarkup(<CompleteView workoutId="w" data={data} problem={false} />);
    expect(out).toContain("Workout complete");
    expect(out).toContain("done-tick");
    expect(out).toContain("Continue");
    expect(out).not.toContain("How do you feel?");
  });
  it("goes straight to the check-in when saving failed", () => {
    expect(renderToStaticMarkup(<CompleteView workoutId="w" data={data} problem />)).toContain("How do you feel?");
  });
  it("shows the stats, bests and cardio on the tick screen", () => {
    const out = renderToStaticMarkup(<CompleteView workoutId="w" data={data} problem={false} />);
    for (const t of ["Upper (light) · 12 sets · 46:12", "Chest press", "30 kg × 12", "Cardio: 10 min on the bike", "2 of 5 sessions this week. 3 to go."]) expect(out).toContain(t);
  });
  it("renders the check-in", () => {
    const out = renderToStaticMarkup(<CompleteView workoutId="w" data={data} problem={false} initialStage="checkin" />);
    for (const t of ["How do you feel?", "How sore are you?", "A little", "Good", "Bodyweight (kg)", "Save and finish", "Skip the check-in"]) expect(out).toContain(t);
  });
  it("hides bodyweight unless tracking is on, and shows a save problem", () => {
    expect(renderToStaticMarkup(<CompleteView workoutId="w" data={{ ...data, trackBodyweight: false }} problem={false} initialStage="checkin" />)).not.toContain("Bodyweight (kg)");
    expect(renderToStaticMarkup(<CompleteView workoutId="w" data={data} problem />)).toContain("Couldn’t save that");
  });
});

describe("Offline, error and not-found screens", () => {
  it("offline page is calm and says logged sets are safe", () => {
    const out = renderToStaticMarkup(<OfflinePage />);
    expect(out).toContain("You’re offline");
    expect(out).toContain("safe on this phone");
    expect(out).toContain("Try again");
  });
  it("error screen never shows technical text", () => {
    const out = renderToStaticMarkup(<ErrorScreen error={Object.assign(new Error("ECONNRESET stack trace at line 5"), { digest: "abc" })} reset={() => {}} />);
    expect(out).toContain("That didn’t load");
    expect(out).toContain("Back to Today");
    expect(out).not.toContain("ECONNRESET");
    expect(out).not.toContain("stack");
  });
  it("404 sends you home", () => {
    expect(renderToStaticMarkup(<NotFound />)).toContain("We can’t find that");
  });
});
