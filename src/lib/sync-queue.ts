// Offline-first sync queue. Every change is saved on the phone first, then sent to the server in order.
// If the gym Wi-Fi drops, sets stay in the queue and go up later. Operations are idempotent, so retries are safe.

import { MAX_OPS_PER_CALL, type Op } from "./ops";

const KEY = "wt.queue.v1";

export interface FlushResult {
  done: number; // leading operations that no longer need sending
  retry: boolean;
}

/** The next batch to send. */
export const takeBatch = (queue: Op[], max = MAX_OPS_PER_CALL): Op[] => queue.slice(0, max);

/** The queue after a send: everything the server finished is removed, the rest waits. */
export const afterFlush = (queue: Op[], sent: number, result: FlushResult): Op[] => queue.slice(Math.min(Math.max(0, result.done), sent));

/** The warning before logging out with unsent changes, or null when everything has been sent. */
export function unsentLogoutMessage(queue: Op[]): string | null {
  const n = queue.length;
  if (n === 0) return null;
  if (n === 1) return "1 change saved on this phone has not been sent yet. Log out anyway and it is lost.";
  return `${n} changes saved on this phone have not been sent yet. Log out anyway and they are lost.`;
}

export function loadQueue(): Op[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Op[]) : [];
  } catch {
    return [];
  }
}

export function saveQueue(queue: Op[]): void {
  try {
    if (queue.length) window.localStorage.setItem(KEY, JSON.stringify(queue));
    else window.localStorage.removeItem(KEY);
  } catch {
    // storage full or blocked: the session still works, it just can't survive a reload offline
  }
}
