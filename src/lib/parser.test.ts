import { describe, expect, it } from "vitest";
import { closest, confirmCopy, errorCopy, finalSets, findExercises, keepAsKilos, lbToKg, parseQuickLog, summarise, type CatalogItem, type ParseContext } from "./parser";
import type { LastTime } from "./progression";

const catalog: CatalogItem[] = [
  { slug: "chest", name: "Chest press", kind: "weight" },
  { slug: "incline", name: "Incline dumbbell press", kind: "weight" },
  { slug: "shoulder", name: "Shoulder press", kind: "weight" },
  { slug: "lateral", name: "Lateral raise", kind: "weight" },
  { slug: "triceps", name: "Triceps pushdown", kind: "weight" },
  { slug: "lat", name: "Lat pulldown", kind: "weight" },
  { slug: "row", name: "Seated row", kind: "weight" },
  { slug: "reardelt", name: "Rear delt fly", kind: "weight" },
  { slug: "hammer", name: "Hammer curl", kind: "weight" },
  { slug: "cablecurl", name: "Cable curl", kind: "weight" },
  { slug: "legpress", name: "Leg press", kind: "weight" },
  { slug: "legcurl", name: "Seated leg curl", kind: "weight" },
  { slug: "legext", name: "Leg extension", kind: "weight" },
  { slug: "calf", name: "Calf raise", kind: "weight" },
  { slug: "glute", name: "Glute bridge / hip thrust", kind: "weight", aliases: ["hip thrust machine"] },
  { slug: "back", name: "Back extension", kind: "bodyweight" },
  { slug: "plank", name: "Plank", kind: "timed" },
];
const history: Record<string, LastTime> = {
  row: { kg: 35, reps: [10, 10], secs: [] },
  plank: { kg: null, reps: [], secs: [30, 35] },
  chest: { kg: 30, reps: [12, 12], secs: [] },
};
const ctx = (over: Partial<ParseContext> = {}): ParseContext => ({ catalog, last: (s) => history[s] ?? null, ...over });
const ok = (text: string, c = ctx()) => {
  const r = parseQuickLog(text, c);
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.entry;
};
const err = (text: string, c = ctx()) => {
  const r = parseQuickLog(text, c);
  if (r.ok) throw new Error(`expected an error, got ${JSON.stringify(r.entry)}`);
  return r.error;
};

describe("the examples from the brief", () => {
  it("lat pulldown 35kg 10 10", () => {
    expect(ok("lat pulldown 35kg 10 10")).toMatchObject({ slug: "lat", kg: 35, reps: [10, 10], total: 2, same: false });
  });
  it("chest press 30 12,12", () => {
    expect(ok("chest press 30 12,12")).toMatchObject({ slug: "chest", kg: 30, reps: [12, 12] });
  });
  it("plank 30 sec 30 sec", () => {
    expect(ok("plank 30 sec 30 sec")).toMatchObject({ slug: "plank", kind: "timed", kg: null, secs: [30, 30] });
  });
  it("same as last time (the open exercise)", () => {
    expect(ok("same as last time", ctx({ currentSlug: "row" }))).toMatchObject({ slug: "row", kg: 35, reps: [10, 10], same: true });
  });
  it("glute bridge 40 12 12", () => {
    expect(ok("glute bridge 40 12 12")).toMatchObject({ slug: "glute", kg: 40, reps: [12, 12] });
  });
});

describe("formats", () => {
  it("handles decimals, 'x' separators, capitals and extra words", () => {
    expect(ok("Chest Press 32.5kg x 10 x 9")).toMatchObject({ kg: 32.5, reps: [10, 9] });
    expect(ok("lat pulldown 35 kg 10 reps 10 reps")).toMatchObject({ kg: 35, reps: [10, 10] });
    expect(ok("LAT PULLDOWN 35KG 10, 10")).toMatchObject({ kg: 35, reps: [10, 10] });
  });
  it("accepts shortened names and plurals", () => {
    expect(ok("pulldown 35kg 10 10").slug).toBe("lat");
    expect(ok("planks 30 30").slug).toBe("plank");
    expect(ok("leg curl 30kg 12 12").slug).toBe("legcurl");
  });
  it("names an exercise followed by 'same as last time'", () => {
    expect(ok("seated row same as last time")).toMatchObject({ slug: "row", kg: 35, same: true });
    expect(ok("plank same")).toMatchObject({ slug: "plank", secs: [30, 35], same: true });
  });
  it("reads minutes for planks", () => {
    expect(ok("plank 1 min").secs).toEqual([60]);
    expect(ok("plank 45s 40s").secs).toEqual([45, 40]);
  });
  it("logs bodyweight lifts with reps only, or with added weight", () => {
    expect(ok("back extension 12 12")).toMatchObject({ kind: "bodyweight", kg: 0, reps: [12, 12] });
    expect(ok("back extension 5kg 12 12")).toMatchObject({ kg: 5, reps: [12, 12] });
  });
});

describe("unknown exercises", () => {
  it("suggests the closest matches and never guesses", () => {
    const e = err("bench 40kg 10 10");
    expect(e).toMatchObject({ code: "unknown", name: "bench", tail: "40kg 10 10" });
    expect((e as { suggestions: string[] }).suggestions).toEqual(["chest", "incline", "shoulder"]);
  });
  it("suggests by similarity when there is no hint word", () => {
    expect(closest("lat pull", catalog)).toContain("lat");
    expect(closest("zzzz", catalog)).toEqual(["chest", "lat", "legpress"]);
  });
  it("asks which one when a name fits several", () => {
    const e = err("press 30kg 10 10");
    expect(e).toMatchObject({ code: "ambiguous" });
    expect((e as { options: string[] }).options.length).toBeGreaterThan(1);
    expect(err("curl 10kg 10 10")).toMatchObject({ code: "ambiguous" });
  });
  it("uses the open exercise to settle an ambiguous name", () => {
    expect(ok("curl 10kg 10 10", ctx({ currentSlug: "cablecurl" })).slug).toBe("cablecurl");
  });
  it("prefers an exact name", () => {
    expect(ok("leg press 80kg 10 10").slug).toBe("legpress");
  });
});

describe("missing pieces", () => {
  it("asks for the weight and offers chips from last time", () => {
    expect(err("chest press")).toMatchObject({ code: "missing", slug: "chest" });
    const c = errorCopy(err("chest press"), ctx());
    expect(c.title).toBe("What weight for Chest press?");
    expect(c.fills).toEqual(["30kg 12 12", "32.5kg 12 12"]);
  });
  it("asks for reps when only a weight was given", () => {
    expect(err("chest press 30kg")).toMatchObject({ code: "missingReps", slug: "chest", kg: 30 });
    expect(err("chest press 30")).toMatchObject({ code: "missingReps" });
    expect(errorCopy(err("lat pulldown 35kg"), ctx()).title).toBe("How many reps?");
  });
  it("asks for seconds for a plank", () => {
    expect(err("plank")).toMatchObject({ code: "missing", slug: "plank" });
    const c = errorCopy(err("plank"), ctx());
    expect(c.title).toBe("How long was each plank?");
    expect(c.fills).toEqual(["30 sec 30 sec", "20 sec 20 sec", "40 sec 40 sec"]);
  });
  it("says so when there is no last time to copy", () => {
    expect(err("lat pulldown same as last time")).toMatchObject({ code: "nolast", slug: "lat" });
    expect(err("same as last time", ctx({ currentSlug: "lat" }))).toMatchObject({ code: "nolast" });
  });
  it("does not understand a sentence", () => {
    expect(err("did pulldowns, felt good")).toMatchObject({ code: "generic" });
    expect(err("")).toMatchObject({ code: "empty" });
    expect(err("same as last time")).toMatchObject({ code: "generic" }); // nothing is open
    expect(errorCopy(err("did pulldowns, felt good"), ctx()).title).toBe("Couldn’t understand that");
  });
  it("rejects silly numbers", () => {
    expect(err("chest press 30kg 500 10")).toMatchObject({ code: "generic" });
    expect(err("chest press 900kg 10 10")).toMatchObject({ code: "generic" });
    expect(err("plank 99999")).toMatchObject({ code: "generic" });
  });
});

describe("wrong number of sets", () => {
  it("offers to log the first 2 when there are more", () => {
    const e = ok("chest press 20kg 12 12 10");
    expect(e.total).toBe(3);
    const c = confirmCopy(e);
    expect(c.mode).toBe("tooMany");
    expect(c.text).toBe("That’s 3 sets and the plan has 2. Log the first 2? Chest press: 20 kg × 12, 20 kg × 12.");
    expect(c.goLabel).toBe("Log first 2");
    expect(finalSets(e)).toEqual([{ kg: 20, reps: 12, secs: null }, { kg: 20, reps: 12, secs: null }]);
  });
  it("asks before logging a single set", () => {
    const e = ok("chest press 30kg 12");
    const c = confirmCopy(e);
    expect(c.mode).toBe("tooFew");
    expect(c.text).toContain("That’s 1 set and the plan has 2.");
    expect(finalSets(e)).toHaveLength(1);
  });
});

describe("pounds", () => {
  it("offers to convert and never converts silently", () => {
    const e = ok("leg press 80lb 10 10");
    expect(e.pounds).toEqual({ raw: 80, kg: 36.3 });
    expect(e.kg).toBe(36.3);
    const c = confirmCopy(e);
    expect(c.mode).toBe("pounds");
    expect(c.text).toBe("80 lb is about 36.3 kg. Log Leg press: 36.3 kg × 10, 36.3 kg × 10?");
    expect([c.altLabel, c.goLabel]).toEqual(["Keep 80 kg", "Convert"]);
  });
  it("can keep the number as kilos instead", () => {
    const kept = keepAsKilos(ok("leg press 80lb 10 10"));
    expect(kept.kg).toBe(80);
    expect(kept.pounds).toBeUndefined();
    expect(confirmCopy(kept).mode).toBe("normal");
  });
  it("understands lbs and pounds", () => {
    expect(ok("chest press 45lbs 10 10").pounds?.kg).toBe(20.4);
    expect(ok("chest press 45 pounds 10 10").pounds?.raw).toBe(45);
    expect(lbToKg(100)).toBe(45.4);
  });
});

describe("confirmation card wording", () => {
  it("matches the design", () => {
    expect(confirmCopy(ok("lat pulldown 35kg 10 10")).text).toBe("Lat pulldown, 2 sets: 35 kg × 10, 35 kg × 10. Save?");
    expect(confirmCopy(ok("seated row same as last time")).text).toBe("Seated row, 2 sets: 35 kg × 10, 35 kg × 10 (same as last time). Save?");
    expect(confirmCopy(ok("plank 30 sec 30 sec")).text).toBe("Plank, 2 sets: 30 s, 30 s. Save?");
    expect(confirmCopy(ok("back extension 12 12")).text).toBe("Back extension, 2 sets: bodyweight × 12, bodyweight × 12. Save?");
  });
  it("summarises", () => {
    expect(summarise({ kind: "weight", kg: 32.5, reps: [8, 9], secs: [] })).toBe("32.5 kg × 8, 32.5 kg × 9");
  });
});

describe("findExercises", () => {
  it("finds an exact slug or name, a unique partial, or lists the candidates", () => {
    const f = (t: string) => findExercises(t, catalog).map((c) => c.slug);
    expect(f("chest")).toEqual(["chest"]);
    expect(f("Lat Pulldown")).toEqual(["lat"]);
    expect(f("pulldown")).toEqual(["lat"]);
    expect(f("press").length).toBeGreaterThan(1);
    expect(f("nonsense words")).toEqual([]);
    expect(f("")).toEqual([]);
  });
});
