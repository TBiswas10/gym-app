import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormCheck, KeyCue } from "./FormCheck";

const guide = {
  name: "Chest press", group: "Chest", muscles: ["Chest"],
  setup: ["Seat at mid-chest."],
  cues: ["Push until your arms are almost straight.", "Keep your shoulder blades back.", "Lower for 2 seconds.", "Breathe out as you press."],
  mistakes: ["Locking your elbows.", "Lifting your back off the pad.", "Letting the stack crash."],
};

describe("form help in the workout", () => {
  it("shows the most important cue all the time", () => {
    const out = renderToStaticMarkup(<KeyCue guide={guide} />);
    expect(out).toContain("Cue:");
    expect(out).toContain("Push until your arms are almost straight.");
  });
  it("collapsed form check: photos, three cues, two mistakes, and a way to the full guide", () => {
    const out = renderToStaticMarkup(<FormCheck guide={guide} slug="chest" onFullGuide={() => {}} />);
    expect(out).toContain("Form check");
    expect(out).toContain("/exercises/chest/0.jpg");
    expect(out).toContain("Keep your shoulder blades back.");
    expect(out).toContain("Lower for 2 seconds.");
    expect(out).not.toContain("Breathe out as you press."); // only the top three
    expect(out).toContain("Locking your elbows.");
    expect(out).not.toContain("Letting the stack crash."); // only the top two
    expect(out).toContain("Full guide");
    expect(out).not.toMatch(/<details[^>]* open/);
  });
  it("can leave the photos out (a swapped exercise with no photos of its own)", () => {
    expect(renderToStaticMarkup(<FormCheck guide={guide} slug="chest" showPhotos={false} onFullGuide={() => {}} />)).not.toContain("/exercises/");
  });
  it("shows nothing for an exercise with no cues", () => {
    expect(renderToStaticMarkup(<KeyCue guide={{ ...guide, cues: [] }} />)).toBe("");
  });
  it("shows your own cue first, above the lift's main cue", () => {
    const out = renderToStaticMarkup(<KeyCue guide={guide} mine="Elbows in, don’t flare" />);
    expect(out).toContain("My cue:");
    expect(out.indexOf("My cue:")).toBeLessThan(out.indexOf("Cue:</strong> Push"));
  });
  it("lets you set your cue from the form check", () => {
    const withField = renderToStaticMarkup(<FormCheck guide={guide} slug="chest" note="Elbows in" onFullGuide={() => {}} onSaveNote={() => {}} />);
    expect(withField).toContain("MY CUE FOR THIS LIFT");
    expect(withField).toContain("Elbows in");
    expect(renderToStaticMarkup(<FormCheck guide={guide} slug="chest" onFullGuide={() => {}} />)).not.toContain("MY CUE FOR THIS LIFT");
  });
});
