import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BodyMap } from "./BodyMap";
import { muscleLoad } from "@/lib/bodymap";

describe("body map", () => {
  const load = muscleLoad([{ date: "2026-10-22", muscles: ["Chest", "Triceps"] }, { date: "2026-10-22", muscles: ["Chest", "Triceps"] }, { date: "2026-10-12", muscles: ["Quads"] }], "2026-10-22");
  it("lights the muscles trained, with the sets next to each name", () => {
    const out = renderToStaticMarkup(<BodyMap load={load} />);
    expect(out).toContain("/bodymap/front.webp");
    expect(out).toContain("/bodymap/chest.webp");
    expect(out).toContain("Chest · 2");
    expect(out).toContain("Front shoulders · 0");
    expect(out).toContain("/bodymap/quads.webp"); // trained 10 days ago: shown dimmer, in blue
    expect(out).not.toContain("/bodymap/abs.webp"); // not trained in 2 weeks: unlit
  });
});
