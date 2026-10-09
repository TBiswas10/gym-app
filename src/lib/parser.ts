// Chat-style quick log: a rule-based parser. Pure functions, no clock, no database, no network.
// It NEVER saves anything: it returns either an entry to confirm, or a problem with ways to fix it.
//
//   "lat pulldown 35kg 10 10"      weight, then reps for each set
//   "chest press 30 12,12"         commas or spaces between sets
//   "plank 30 sec 30 sec"          timed holds, seconds per set
//   "same as last time"            the exercise you have open (or "seated row same as last time")
//   "glute bridge 40 12 12"        weight without a unit is kg
//   "leg press 80lb 10 10"         pounds are offered for conversion, never converted silently

import type { LastTime } from "./progression";
import type { ExerciseKind } from "./plan";

export interface CatalogItem {
  slug: string;
  name: string;
  kind: ExerciseKind;
  aliases?: string[];
}

export interface ParseContext {
  catalog: CatalogItem[];
  last: (slug: string) => LastTime | null;
  /** The exercise currently open, used for "same as last time" and for ambiguous names. */
  currentSlug?: string | null;
  plannedSets?: number;
}

export interface Entry {
  slug: string;
  name: string;
  kind: ExerciseKind;
  kg: number | null; // null for timed holds; 0 for bodyweight
  reps: number[];
  secs: number[];
  total: number; // sets typed, before any trimming
  same: boolean;
  pounds?: { raw: number; kg: number };
}

export type ParseError =
  | { code: "empty" }
  | { code: "generic" }
  | { code: "unknown"; name: string; tail: string; suggestions: string[] }
  | { code: "ambiguous"; name: string; tail: string; options: string[] }
  | { code: "missing"; slug: string }
  | { code: "missingReps"; slug: string; kg: number }
  | { code: "nolast"; slug: string };

export type ParseResult = { ok: true; entry: Entry } | { ok: false; error: ParseError };

const MAX_KG = 400;
const MAX_REPS = 100;
const MAX_SECS = 3600;
const LB_TO_KG = 0.45359237;

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
export const lbToKg = (lb: number): number => Math.round(lb * LB_TO_KG * 10) / 10;

// ---------------------------------------------------------------- matching

const nameWords = (item: CatalogItem): string[][] =>
  [item.name, ...(item.aliases ?? [])].map((n) => n.toLowerCase().replace(/[/\-]/g, " ").split(/\s+/).filter(Boolean));

/** Every typed word must start a word of the name (or be a plural of one: "planks", "laterals"). */
function matches(typed: string[], item: CatalogItem): boolean {
  return nameWords(item).some((words) =>
    typed.every((t) => words.some((w) => w.startsWith(t) || (w.length >= 4 && t.startsWith(w)))),
  );
}

const HINTS: Record<string, string[]> = {
  bench: ["chest", "incline", "shoulder"],
  squat: ["legpress", "legext", "glute"],
  pull: ["lat", "row", "reardelt"],
  press: ["chest", "shoulder", "legpress"],
  curl: ["cablecurl", "hammer", "legcurl"],
  raise: ["lateral", "calf"],
  fly: ["reardelt", "chest"],
  deadlift: ["back", "glute", "legcurl"],
  crunch: ["plank"],
  bicep: ["cablecurl", "hammer"],
  tricep: ["triceps"],
  pushdown: ["triceps"],
  extension: ["legext", "back", "triceps"],
};

const trigrams = (s: string): Set<string> => {
  const x = ` ${s.toLowerCase().replace(/[^a-z]/g, " ")} `;
  const out = new Set<string>();
  for (let i = 0; i < x.length - 2; i++) out.add(x.slice(i, i + 3));
  return out;
};

/** The closest exercises to something we could not place (slugs, best first, at most 3). */
export function closest(text: string, catalog: CatalogItem[]): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  for (const [hint, slugs] of Object.entries(HINTS)) {
    if (t.includes(hint)) for (const s of slugs) if (!out.includes(s) && catalog.some((c) => c.slug === s)) out.push(s);
  }
  const ti = trigrams(t);
  const scored = catalog
    .map((c) => {
      const ci = trigrams(c.name);
      let n = 0;
      ti.forEach((g) => ci.has(g) && n++);
      return { slug: c.slug, score: n / Math.max(1, ti.size + ci.size - n) };
    })
    .sort((a, b) => b.score - a.score);
  for (const s of scored) if (out.length < 3 && s.score > 0.08 && !out.includes(s.slug)) out.push(s.slug);
  if (out.length === 0) return ["chest", "lat", "legpress"].filter((s) => catalog.some((c) => c.slug === s));
  return out.slice(0, 3);
}

/** Exercises a typed name could mean: exact slug or name first, otherwise every word-prefix match. Never guesses. */
export function findExercises(text: string, catalog: CatalogItem[]): CatalogItem[] {
  const t = text.trim().toLowerCase();
  const exact = catalog.filter((c) => c.slug === t || c.name.toLowerCase() === t);
  if (exact.length === 1) return exact;
  const typed = t.split(/[\s/\-]+/).filter(Boolean);
  return typed.length ? catalog.filter((c) => matches(typed, c)) : [];
}

// ---------------------------------------------------------------- parsing

const SAME = /^(.*?)\s*\b(?:same as last time|same as last|as last time|same again|same)$/;
const NUMBER = /\d+(?:\.\d+)?/g;

function normalise(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[×✕]/g, "x")
    .replace(/(\d|kgs?|lbs?)\s*x\s*(?=\d)/g, "$1 ") // 35kg x 10 x 10
    .replace(/\b(reps?|sets?|each)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numbers(s: string): number[] {
  return (s.match(NUMBER) ?? []).map(Number);
}

function pick(name: string, tail: string, ctx: ParseContext): { item: CatalogItem } | { error: ParseError } {
  const typed = name.split(/[\s/\-]+/).filter(Boolean);
  const found = typed.length ? ctx.catalog.filter((c) => matches(typed, c)) : [];
  if (found.length === 1) return { item: found[0] };
  if (found.length > 1) {
    const exact = found.find((c) => c.name.toLowerCase() === name.trim());
    if (exact) return { item: exact };
    const current = found.find((c) => c.slug === ctx.currentSlug);
    if (current) return { item: current };
    return { error: { code: "ambiguous", name, tail, options: found.slice(0, 3).map((c) => c.slug) } };
  }
  return { error: { code: "unknown", name, tail, suggestions: closest(name, ctx.catalog) } };
}

export function parseQuickLog(text: string, ctx: ParseContext): ParseResult {
  const s = normalise(text);
  if (!s) return { ok: false, error: { code: "empty" } };
  const fail = (error: ParseError): ParseResult => ({ ok: false, error });

  // "same as last time", optionally after an exercise name
  const same = s.match(SAME);
  if (same) {
    const name = same[1].trim();
    let item: CatalogItem | undefined;
    if (!name) item = ctx.catalog.find((c) => c.slug === ctx.currentSlug);
    else {
      const p = pick(name, "", ctx);
      if ("error" in p) return fail(p.error);
      item = p.item;
    }
    if (!item) return fail({ code: "generic" });
    const last = ctx.last(item.slug);
    if (!last) return fail({ code: "nolast", slug: item.slug });
    const planned = ctx.plannedSets ?? 2;
    return {
      ok: true,
      entry: {
        slug: item.slug, name: item.name, kind: item.kind,
        kg: item.kind === "timed" ? null : (last.kg ?? 0),
        reps: item.kind === "timed" ? [] : last.reps.slice(0, planned),
        secs: item.kind === "timed" ? last.secs.slice(0, planned) : [],
        total: item.kind === "timed" ? last.secs.length : last.reps.length,
        same: true,
      },
    };
  }

  // Everything before the first number or sign is the exercise name; the rest are the numbers.
  const cut = s.search(/[\d+]/);
  const name = (cut === -1 ? s : s.slice(0, cut)).trim();
  const tail = cut === -1 ? "" : s.slice(cut).trim();
  if (!/^[a-z][a-z /\-]*$/.test(name)) return fail({ code: "generic" });

  const picked = pick(name, tail, ctx);
  if ("error" in picked) return fail(picked.error);
  const item = picked.item;
  if (!tail) return fail({ code: "missing", slug: item.slug });

  const base = { slug: item.slug, name: item.name, kind: item.kind, same: false as const };

  // Timed holds: every number is one set, seconds unless it says minutes.
  if (item.kind === "timed") {
    const secs = [...tail.matchAll(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|m\b|seconds?|secs?|s\b)?/g)].map((m) =>
      /^m/.test(m[2] ?? "") ? Math.round(Number(m[1]) * 60) : Math.round(Number(m[1])),
    );
    if (!secs.length) return fail({ code: "missing", slug: item.slug });
    if (secs.some((v) => v < 1 || v > MAX_SECS)) return fail({ code: "generic" });
    return { ok: true, entry: { ...base, kg: null, reps: [], secs, total: secs.length } };
  }

  const unit = tail.match(/(\d+(?:\.\d+)?)\s*(kgs?|kilos?|kilograms?|lbs?|pounds?)\b/);
  const isLb = !!unit && /^(lb|pound)/.test(unit[2]);
  let kg: number | null = null;
  let reps: number[];

  if (item.kind === "bodyweight" && !unit) {
    reps = numbers(tail);
    kg = 0;
  } else {
    const all = numbers(tail.replace(/\+/g, ""));
    // The first number is the weight; the rest are reps for each set.
    kg = unit ? Number(unit[1]) : all[0];
    const rest = unit ? all.filter((_, i) => i !== all.indexOf(Number(unit[1]))) : all.slice(1);
    reps = rest;
    if (!reps.length) return fail({ code: "missingReps", slug: item.slug, kg: isLb ? lbToKg(kg) : kg });
  }

  if (!reps.length) return fail({ code: "missing", slug: item.slug });
  if (reps.some((r) => !Number.isInteger(r) || r < 1 || r > MAX_REPS)) return fail({ code: "generic" });
  if (kg < 0 || kg > MAX_KG * (isLb ? 2.3 : 1)) return fail({ code: "generic" });

  const entry: Entry = { ...base, kg, reps, secs: [], total: reps.length };
  if (isLb) {
    entry.pounds = { raw: kg, kg: lbToKg(kg) };
    entry.kg = entry.pounds.kg;
  }
  return { ok: true, entry };
}

// ---------------------------------------------------------------- confirmation

/** "35 kg × 10, 35 kg × 10" / "bodyweight × 12, bodyweight × 12" / "30 s, 30 s" */
export function summarise(e: Pick<Entry, "kind" | "kg" | "reps" | "secs">, limit = 2): string {
  if (e.kind === "timed") return e.secs.slice(0, limit).map((v) => `${v} s`).join(", ");
  return e.reps.slice(0, limit).map((r) => `${e.kg ? `${fmt(e.kg)} kg` : "bodyweight"} × ${r}`).join(", ");
}

export interface Confirm {
  mode: "normal" | "same" | "pounds" | "tooMany" | "tooFew";
  text: string;
  altLabel: string;
  goLabel: string;
}

/** The plain-words card shown before anything is saved. */
export function confirmCopy(e: Entry, planned = 2): Confirm {
  const n = e.total;
  if (e.pounds) {
    return {
      mode: "pounds",
      text: `${fmt(e.pounds.raw)} lb is about ${fmt(e.pounds.kg)} kg. Log ${e.name}: ${summarise(e)}?`,
      altLabel: `Keep ${fmt(e.pounds.raw)} kg`,
      goLabel: "Convert",
    };
  }
  if (n > planned) {
    return { mode: "tooMany", text: `That’s ${n} sets and the plan has ${planned}. Log the first ${planned}? ${e.name}: ${summarise(e, planned)}.`, altLabel: "Edit", goLabel: `Log first ${planned}` };
  }
  if (n < planned && !e.same) {
    return { mode: "tooFew", text: `That’s ${n} set and the plan has ${planned}. Log it as set 1? ${e.name}: ${summarise(e)}.`, altLabel: "Edit", goLabel: "Log it" };
  }
  if (e.same) return { mode: "same", text: `${e.name}, ${n} set${n === 1 ? "" : "s"}: ${summarise(e)} (same as last time). Save?`, altLabel: "Edit", goLabel: "Save" };
  return { mode: "normal", text: `${e.name}, ${n} sets: ${summarise(e)}. Save?`, altLabel: "Edit", goLabel: "Save" };
}

/** The sets that will be saved once confirmed (trimmed to the plan). */
export function finalSets(e: Entry, planned = 2): { kg: number | null; reps: number | null; secs: number | null }[] {
  const count = Math.min(e.total, planned);
  return Array.from({ length: count }, (_, i) =>
    e.kind === "timed" ? { kg: null, reps: null, secs: e.secs[i] } : { kg: e.kg ?? 0, reps: e.reps[i], secs: null },
  );
}

/** Keep the typed number as kilos instead of converting pounds. */
export function keepAsKilos(e: Entry): Entry {
  if (!e.pounds) return e;
  const { raw } = e.pounds;
  const { pounds: _drop, ...rest } = e;
  void _drop;
  return { ...rest, kg: raw };
}

// ---------------------------------------------------------------- error copy

export interface ErrorCopy {
  title: string;
  body: string;
  /** Slugs to offer as one-tap chips (names), when the fix is choosing an exercise. */
  chips?: string[];
  /** Ready-made entries to offer when the fix is filling in numbers. */
  fills?: string[];
}

/** Friendly wording for each problem, in the design's tone. Never blames. */
export function errorCopy(err: ParseError, ctx: ParseContext): ErrorCopy {
  const name = (slug: string) => ctx.catalog.find((c) => c.slug === slug)?.name ?? slug;
  const lastOf = (slug: string) => ctx.last(slug);
  switch (err.code) {
    case "unknown":
      return { title: `Not sure which exercise “${err.name}” is`, body: "Did you mean one of these? Tap one and your sets carry over.", chips: err.suggestions };
    case "ambiguous":
      return { title: `“${err.name}” could be a few exercises`, body: "Which one did you mean? Tap one and your sets carry over.", chips: err.options };
    case "missing": {
      const item = ctx.catalog.find((c) => c.slug === err.slug);
      if (item?.kind === "timed") {
        return { title: `How long was each ${name(err.slug).toLowerCase()}?`, body: "Plank is timed, so there’s no weight. Add seconds for each set.", fills: ["30 sec 30 sec", "20 sec 20 sec", "40 sec 40 sec"] };
      }
      const l = lastOf(err.slug);
      const kg = l?.kg ?? 20;
      const reps = l?.reps[0] ?? 10;
      return {
        title: `What weight for ${name(err.slug)}?`,
        body: "Add the weight and your reps for each set. Or tap one:",
        fills: [`${fmt(kg)}kg ${reps} ${reps}`, `${fmt(kg + 2.5)}kg ${reps} ${reps}`],
      };
    }
    case "missingReps": {
      const reps = lastOf(err.slug)?.reps[0] ?? 10;
      return { title: "How many reps?", body: "Add your reps for each set. Or tap one:", fills: [`${fmt(err.kg)}kg ${reps} ${reps}`, `${fmt(err.kg)}kg ${reps + 1} ${reps}`] };
    }
    case "nolast":
      return { title: `No last time for ${name(err.slug)}`, body: "This is your first time, so there is nothing to copy. Add the numbers instead." };
    default:
      return { title: "Couldn’t understand that", body: "Try: lat pulldown 35kg 10 10, glute bridge 40kg 12 12 or plank 30 sec 30 sec." };
  }
}
