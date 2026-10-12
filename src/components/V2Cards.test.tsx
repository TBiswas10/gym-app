import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BriefingCard, GoalsCard, NudgeCard, ReviewCard, ReviewTeaser } from "./V2Cards";

describe("v2 cards", () => {
  it("shows the briefing: headline, what to try and the notes", () => {
    const out = renderToStaticMarkup(
      <BriefingCard briefing={{ headline: "Push, about 38 min", sub: "Start with bike (10 min), then 5 lifts.", tries: ["Chest press: go up to 32.5 kg"], notes: ["Last cardio: 10 min bike."] }} />,
    );
    for (const t of ["Today’s briefing", "Push, about 38 min", "Chest press: go up to 32.5 kg", "Last cardio: 10 min bike."]) expect(out).toContain(t);
  });
  it("shows a suggestion with a clear accept and a not now", () => {
    const out = renderToStaticMarkup(<NudgeCard nudge={{ key: "deload:w6", kind: "deload", title: "Time for a lighter week?", body: "Half the sets.", accept: "Make this a deload week", payload: { week: 6 } }} />);
    for (const t of ["Suggestion", "Time for a lighter week?", "Not now", "Make this a deload week"]) expect(out).toContain(t);
  });
  it("shows goals with progress and what is left, and an add button when there is a free lift", () => {
    const out = renderToStaticMarkup(
      <GoalsCard
        goals={[{ id: "g1", slug: "legpress", name: "Leg press", unit: "kg", start: 60, current: 80, target: 100, fraction: 0.5, toGo: 20, reached: false }]}
        choices={[{ slug: "legpress", name: "Leg press", unit: "kg" }, { slug: "chest", name: "Chest press", unit: "kg" }]}
      />,
    );
    for (const t of ["Goals", "Leg press", "80 of 100 kg", "20 kg to go", "Add a goal"]) expect(out).toContain(t);
  });
  it("shows the weekly review and a teaser for it", () => {
    const r = { id: "r1", weekStart: "2026-10-05", headline: "Four of five done and legs are moving", wins: ["Leg press up 5 kg"], watch: ["Energy dipped Thursday"], nextWeek: ["Keep Thursday light"], createdAt: "2026-10-11T00:00:00Z" };
    const out = renderToStaticMarkup(<ReviewCard reviews={[r]} />);
    for (const t of ["Weekly review", "Four of five done", "WINS", "Leg press up 5 kg", "WATCH", "NEXT WEEK"]) expect(out).toContain(t);
    expect(renderToStaticMarkup(<ReviewTeaser review={r} />)).toContain("Your weekly review");
  });
});
