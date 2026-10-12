import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BriefingCard, BriefingInline, GoalsCard, NudgeCard, NudgeStack, ReviewCard, ReviewTeaser } from "./V2Cards";

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
  it("inside the day card the briefing shows only what to try and the notes", () => {
    const out = renderToStaticMarkup(<BriefingInline briefing={{ headline: "Push, about 38 min", sub: "x", tries: ["Chest press: go up to 32.5 kg"], notes: ["Last cardio: 10 min bike."] }} />);
    expect(out).toContain("For today");
    expect(out).toContain("Chest press: go up to 32.5 kg");
    expect(out).not.toContain("Push, about 38 min");
    expect(renderToStaticMarkup(<BriefingInline briefing={{ headline: "h", sub: "s", tries: [], notes: [] }} />)).toBe("");
  });
  it("shows suggestions one at a time with a position", () => {
    const mk = (k: string) => ({ key: k, kind: "stalled" as const, title: `Title ${k}`, body: "b", accept: "Use 1 kg jumps", payload: { slug: "chest", kg: 1 } });
    const out = renderToStaticMarkup(<NudgeStack nudges={[mk("a"), mk("b")]} />);
    expect(out).toContain("Title a");
    expect(out).not.toContain("Title b");
    expect(out).toContain("1 of 2");
  });
  it("empty states say what to do next", () => {
    const review = renderToStaticMarkup(<ReviewCard reviews={[]} />);
    for (const t of ["Weekly review", "Write my weekly review", "Copy that to ask Claude"]) expect(review).toContain(t);
    const goals = renderToStaticMarkup(<GoalsCard goals={[]} choices={[{ slug: "chest", name: "Chest press", unit: "kg" }]} />);
    expect(goals).toContain("Add your first goal");
    expect(renderToStaticMarkup(<GoalsCard goals={[]} choices={[]} />)).toContain("Finish a workout first");
  });
  it("shows the weekly review and a teaser for it", () => {
    const r = { id: "r1", weekStart: "2026-10-05", headline: "Four of five done and legs are moving", wins: ["Leg press up 5 kg"], watch: ["Energy dipped Thursday"], nextWeek: ["Keep Thursday light"], createdAt: "2026-10-11T00:00:00Z" };
    const out = renderToStaticMarkup(<ReviewCard reviews={[r]} />);
    for (const t of ["Weekly review", "Four of five done", "WINS", "Leg press up 5 kg", "WATCH", "NEXT WEEK"]) expect(out).toContain(t);
    expect(renderToStaticMarkup(<ReviewTeaser review={r} />)).toContain("Your weekly review");
  });
});
