// Strict validation of operations sent from the phone. Anything that does not match exactly is rejected.
// This runs on the server before any write, in addition to row-level security and database constraints.

import { MACHINES, isMachine, type Feel } from "./cardio";
import type { Op } from "./ops";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z]{2,20}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PARAM_KEYS = new Set(MACHINES.flatMap((m) => m.params.map((p) => p.k)));

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const slug = (v: unknown): v is string => typeof v === "string" && SLUG.test(v);
const int = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
const num = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const nullable = <T>(v: unknown, ok: (x: unknown) => x is T): v is T | null => v === null || ok(v);

export function validateOp(raw: unknown): Op | null {
  if (!isObj(raw) || typeof raw.t !== "string") return null;
  switch (raw.t) {
    case "set": {
      const { id, workoutId, slug: sl, position, n, variant, kg, reps, secs, source } = raw;
      if (!uuid(id) || !uuid(workoutId) || !slug(sl) || !int(position, 1, 200) || !int(n, 1, 2)) return null;
      if (!(variant === null || (typeof variant === "string" && variant.length <= 60))) return null;
      if (!nullable(kg, (x): x is number => num(x, 0, 400))) return null;
      if (!nullable(reps, (x): x is number => int(x, 0, 100))) return null;
      if (!nullable(secs, (x): x is number => int(x, 0, 3600))) return null;
      if (reps === null && secs === null) return null;
      if (source !== "app" && source !== "chat") return null;
      return { t: "set", id, workoutId, slug: sl, position, n, variant, kg, reps, secs, source };
    }
    case "delset": {
      const { workoutId, slug: sl, n } = raw;
      if (!uuid(workoutId) || !slug(sl) || !int(n, 1, 2)) return null;
      return { t: "delset", workoutId, slug: sl, n };
    }
    case "skips": {
      const { workoutId, slugs } = raw;
      if (!uuid(workoutId) || !Array.isArray(slugs) || slugs.length > 30 || !slugs.every(slug)) return null;
      return { t: "skips", workoutId, slugs: [...new Set(slugs as string[])] };
    }
    case "cardio": {
      const { id, workoutId, kind, minutes, params, feel, loggedOn } = raw;
      if (!uuid(id) || !uuid(workoutId) || !isMachine(kind) || !int(minutes, 1, 180)) return null;
      if (!(feel === null || feel === "easy" || feel === "moderate" || feel === "hard")) return null;
      if (typeof loggedOn !== "string" || !DATE.test(loggedOn) || Number.isNaN(Date.parse(loggedOn))) return null;
      if (!isObj(params)) return null;
      const clean: Record<string, number> = {};
      for (const [k, v] of Object.entries(params)) {
        if (!PARAM_KEYS.has(k) || !num(v, 0, 1000)) return null;
        clean[k] = v;
      }
      return { t: "cardio", id, workoutId, kind, minutes, params: clean, feel: feel as Feel | null, loggedOn };
    }
    case "delcardio": {
      return uuid(raw.id) ? { t: "delcardio", id: raw.id } : null;
    }
    case "notes": {
      const { slug: sl, notes } = raw;
      if (!slug(sl) || typeof notes !== "string" || notes.length > 200) return null;
      return { t: "notes", slug: sl, notes: notes.trim() };
    }
    case "finish": {
      const { workoutId, endedAt } = raw;
      if (!uuid(workoutId) || typeof endedAt !== "string") return null;
      const ms = Date.parse(endedAt);
      if (Number.isNaN(ms) || ms > Date.now() + 5 * 60_000 || ms < Date.now() - 30 * 86_400_000) return null;
      return { t: "finish", workoutId, endedAt: new Date(ms).toISOString() };
    }
    default:
      return null;
  }
}
