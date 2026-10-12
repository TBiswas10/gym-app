import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SetTip } from "./SetTip";

describe("set tip", () => {
  it("uses the exercise's own rep range and the wording for both sets", () => {
    const out = renderToStaticMarkup(<SetTip range={[10, 12]} kind="weight" planned={2} swapped={false} first />);
    for (const t of [
      "For most exercises in your plan, the goal is the same for both sets: 10-12 reps, stopping with about 2 reps left in the tank.",
      "Set 1:", "aim for 10-12 reps. This sets the weight for the session.",
      "Set 2:", "using the same weight. Some drop-off is normal, so if you get 1-2 fewer reps than set 1, that’s fine.",
    ]) expect(out).toContain(t);
    expect(out).not.toMatch(/<details[^>]* open/); // collapsed until you tap it
  });
  it("reads in seconds for holds, drops set 2 on a one-set deload, and says so for swaps", () => {
    const hold = renderToStaticMarkup(<SetTip range={[20, 40]} kind="timed" planned={1} swapped first={false} />);
    expect(hold).toContain("20-40 seconds");
    expect(hold).not.toContain("Set 2:");
    expect(hold).toContain("No history for this one");
  });
  it("is collapsed whether or not you have history", () => {
    const out = renderToStaticMarkup(<SetTip range={[8, 12]} kind="weight" planned={2} swapped={false} first={false} />);
    expect(out).not.toMatch(/<details[^>]* open/);
  });
});
