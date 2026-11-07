import type { Op } from "./ops";

/** The line about saved work that has not reached the server yet, or null when the queue is empty. */
export function waitingMessage(queue: Op[]): string | null {
  if (queue.length === 0) return null;
  const sets = queue.filter((op) => op.t === "set").length;
  if (sets === 0) return "Your workout is saved and will send when you are online";
  return `${sets} ${sets === 1 ? "set" : "sets"} waiting to send`;
}
