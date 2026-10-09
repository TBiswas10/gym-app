// Cardio machines, defaults and "same as last time". Pure data and helpers.
// Source: the design's active workout (machine picker and per-machine fields).

export type MachineId = "bike" | "treadmill" | "stair" | "rower" | "xtrainer";
export type Feel = "easy" | "moderate" | "hard";

export interface Param {
  k: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  def: number;
}
export interface Machine {
  id: MachineId;
  name: string;
  params: Param[];
  tip?: string;
}

const time = (def: number, unit = "minutes"): Param => ({ k: "min", label: "Time", unit, min: 1, max: 60, step: 1, def });

export const MACHINES: Machine[] = [
  {
    id: "bike", name: "Bike",
    params: [
      { k: "res", label: "Resistance", unit: "level, scale 1–20", min: 1, max: 20, step: 1, def: 5 },
      { k: "rpm", label: "Cadence", unit: "rpm", min: 40, max: 110, step: 5, def: 70 },
      time(10),
    ],
  },
  {
    id: "treadmill", name: "Treadmill",
    params: [
      { k: "speed", label: "Speed", unit: "km/h", min: 2, max: 12, step: 0.5, def: 5.5 },
      { k: "incline", label: "Incline", unit: "%", min: 0, max: 15, step: 1, def: 3 },
      time(10),
    ],
  },
  {
    id: "stair", name: "Stair",
    params: [{ k: "level", label: "Level", unit: "scale 1–20", min: 1, max: 20, step: 1, def: 4 }, time(8, "minutes, start at 5–10")],
  },
  {
    id: "rower", name: "Rower",
    params: [
      { k: "damper", label: "Damper", unit: "scale 1–10", min: 1, max: 10, step: 1, def: 4 },
      { k: "spm", label: "Stroke rate", unit: "strokes per min", min: 14, max: 36, step: 1, def: 22 },
      time(8, "minutes, start at 5–10"),
    ],
    tip: "Legs, then body, then arms. Keep your back flat.",
  },
  {
    id: "xtrainer", name: "Cross-trainer",
    params: [{ k: "res", label: "Resistance", unit: "level", min: 1, max: 20, step: 1, def: 5 }, time(10)],
  },
];

export const machineById = (id: MachineId): Machine => MACHINES.find((m) => m.id === id)!;
export const isMachine = (v: unknown): v is MachineId => MACHINES.some((m) => m.id === v);
export const machineLabel = (id: MachineId): string => (id === "stair" ? "Stair machine" : machineById(id).name);

/** The machine suggested by a plan's cardio line: whichever is named first ("Rower or bike" starts on the rower). */
export function defaultMachine(cardioName: string): MachineId {
  const n = cardioName.toLowerCase();
  const words: [string, MachineId][] = [["bike", "bike"], ["treadmill", "treadmill"], ["stair", "stair"], ["rower", "rower"], ["cross-trainer", "xtrainer"]];
  let best: { at: number; id: MachineId } | null = null;
  for (const [w, id] of words) {
    const at = n.indexOf(w);
    if (at >= 0 && (!best || at < best.at)) best = { at, id };
  }
  return best?.id ?? "bike";
}

export type Params = Record<string, number>;

/** Starting values for a machine: last time's numbers when there are any, otherwise the defaults; the plan sets the time. */
export function initialParams(id: MachineId, opts: { last?: Params | null; plannedMinutes?: number | null } = {}): Params {
  const m = machineById(id);
  const out: Params = {};
  for (const p of m.params) out[p.k] = p.def;
  if (opts.last) for (const p of m.params) if (typeof opts.last[p.k] === "number") out[p.k] = clamp(opts.last[p.k], p);
  // The plan sets the time (Saturday's treadmill is 15 min); last time sets everything else.
  if (opts.plannedMinutes) out.min = clamp(opts.plannedMinutes, m.params.find((p) => p.k === "min")!);
  return out;
}

function clamp(v: number, p: Param): number {
  return Math.min(p.max, Math.max(p.min, Math.round(v * 10) / 10));
}

/** One tap of a stepper, kept inside the machine's range. */
export function adjustParam(id: MachineId, params: Params, key: string, dir: 1 | -1): Params {
  const p = machineById(id).params.find((x) => x.k === key);
  if (!p) return params;
  return { ...params, [key]: clamp((params[key] ?? p.def) + dir * p.step, p) };
}

/** Keep only values this machine knows about (what gets stored). */
export function cleanParams(id: MachineId, params: Params): Params {
  const out: Params = {};
  for (const p of machineById(id).params) if (typeof params[p.k] === "number") out[p.k] = clamp(params[p.k], p);
  return out;
}

/** The little line under the feel chips. */
export function cardioSuggestion(lastMinutes: number | null, feel: Feel | null): string {
  if (lastMinutes == null) return "First time on this one. Start easy and keep it talkable.";
  if (feel === "hard") return `That was tough. Keep it at ${lastMinutes} min next time.`;
  if (feel === "easy") return `Try 1 more minute next time. Last time: ${lastMinutes} min.`;
  return `Try 1 more minute this week. Last time: ${lastMinutes} min.`;
}

export const sameAsLastLabel = (lastMinutes: number): string => `Same as last time · ${lastMinutes} min`;
