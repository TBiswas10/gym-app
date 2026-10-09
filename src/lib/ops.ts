// Operations the phone sends to the server. Each one is idempotent (keyed by ids or natural keys), so the
// offline queue can safely retry them. Validated again on the server before anything is written.

import type { MachineId, Feel } from "./cardio";

export type Source = "app" | "chat" | "mcp"; // "mcp" is set by the server only; phones may not send it

export type Op =
  | { t: "set"; id: string; workoutId: string; slug: string; position: number; n: number; variant: string | null; kg: number | null; reps: number | null; secs: number | null; source: Source }
  | { t: "delset"; workoutId: string; slug: string; n: number }
  | { t: "skips"; workoutId: string; slugs: string[] }
  | { t: "cardio"; id: string; workoutId: string; kind: MachineId; minutes: number; params: Record<string, number>; feel: Feel | null; loggedOn: string }
  | { t: "delcardio"; id: string }
  | { t: "notes"; slug: string; notes: string }
  | { t: "finish"; workoutId: string; endedAt: string };

export const MAX_OPS_PER_CALL = 50;
