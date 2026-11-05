// Restoring from a backup file (the JSON from Plan > Your data > Download full backup). It only ADDS history that is missing
// (finished sessions, their sets, cardio and check-ins); it never changes or deletes anything, and never touches your plan or settings.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 200): v is string => typeof v === "string" && v.length <= max;
const numN = (v: unknown, lo: number, hi: number): boolean => v === null || (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi);
const ts = (v: unknown): boolean => typeof v === "string" && !Number.isNaN(Date.parse(v));
const uuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const date = (v: unknown): boolean => typeof v === "string" && DATE.test(v);

type Row = Record<string, unknown>;

export interface RestoreRows {
  workouts: Row[];
  sets: Row[];
  cardio_entries: Row[];
  checkins: Row[];
}

export type Parsed = { ok: true; rows: RestoreRows; skipped: number } | { ok: false; error: string };

const pick = (o: Row, keys: string[]): Row => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

/** Read a backup and keep only the rows that are well formed. `skipped` counts rows that were left out. */
export function parseBackup(text: string): Parsed {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    return { ok: false, error: "That doesn’t look like a backup file." };
  }
  if (!isObj(j) || j.app !== "workout-tracker" || j.version !== 1) return { ok: false, error: "That isn’t a backup from this app." };
  const list = (k: string): unknown[] => (Array.isArray(j[k]) ? (j[k] as unknown[]) : []);
  let skipped = 0;
  const keep = (rows: unknown[], ok: (r: Row) => boolean, cols: string[]): Row[] => {
    const out: Row[] = [];
    for (const r of rows) {
      if (isObj(r) && ok(r)) out.push(pick(r, cols));
      else skipped++;
    }
    return out;
  };
  const workouts = keep(
    list("workouts"),
    (r) => uuid(r.id) && r.status === "completed" && r.is_test !== true && date(r.planned_date) && Number.isInteger(r.weekday) && Number.isInteger(r.week) && (r.plan_type === "5day" || r.plan_type === "3day") && str(r.day_name, 60) && ts(r.started_at),
    ["id", "planned_date", "week", "plan_type", "weekday", "day_name", "is_light", "started_at", "ended_at", "notes", "skipped_exercises", "status"],
  );
  const ids = new Set(workouts.map((w) => w.id as string));
  const inSet = (v: unknown): boolean => uuid(v) && ids.has(v);
  const sets = keep(
    list("sets"),
    (r) => uuid(r.id) && inSet(r.workout_id) && typeof r.exercise_slug === "string" && /^[a-z]{2,20}$/.test(r.exercise_slug) && Number.isInteger(r.position) && (r.set_number === 1 || r.set_number === 2) && numN(r.weight_kg, 0, 400) && numN(r.reps, 0, 100) && numN(r.seconds, 0, 3600) && (r.source === "app" || r.source === "chat" || r.source === "mcp"),
    ["id", "workout_id", "exercise_slug", "position", "set_number", "variant", "weight_kg", "reps", "seconds", "source", "logged_at"],
  );
  const cardio = keep(
    list("cardio_entries"),
    (r) => uuid(r.id) && (r.workout_id === null || inSet(r.workout_id)) && str(r.kind, 20) && typeof r.minutes === "number" && r.minutes >= 1 && r.minutes <= 180 && date(r.logged_on) && isObj(r.params),
    ["id", "workout_id", "kind", "minutes", "params", "feel", "logged_on", "logged_at", "source"],
  );
  const checkins = keep(
    list("checkins"),
    (r) => uuid(r.id) && (r.workout_id === null || inSet(r.workout_id)) && date(r.checked_on) && numN(r.soreness, 1, 5) && numN(r.energy, 1, 5) && numN(r.bodyweight_kg, 20, 400),
    ["id", "workout_id", "checked_on", "soreness", "energy", "notes", "bodyweight_kg", "created_at"],
  );
  return { ok: true, rows: { workouts, sets, cardio_entries: cardio, checkins }, skipped };
}

/** What a restore would add: rows whose id is not already in the account. */
export function missingRows(rows: RestoreRows, have: { [K in keyof RestoreRows]: Set<string> }): RestoreRows {
  const f = (k: keyof RestoreRows) => rows[k].filter((r) => !have[k].has(r.id as string));
  return { workouts: f("workouts"), sets: f("sets"), cardio_entries: f("cardio_entries"), checkins: f("checkins") };
}

export const counts = (r: RestoreRows) => ({ sessions: r.workouts.length, sets: r.sets.length, cardio: r.cardio_entries.length, checkins: r.checkins.length });
