// Rate limiting for the MCP endpoint.
//  - createLimiter: a small in-memory sliding window, used per IP address before anyone is authenticated
//    (best effort: each serverless instance has its own memory).
//  - overLimit: the authoritative per-user check, from counts read out of the request log table.

export const LIMITS = {
  /** Requests of any kind per user per minute. */
  perMinute: 60,
  /** Tool calls that write (log_sets, log_cardio, log_checkin) per user per minute. */
  writesPerMinute: 20,
  /** Unauthenticated or failed attempts per IP per minute. */
  ipPerMinute: 30,
} as const;

export const WRITE_TOOLS = ["log_sets", "log_cardio", "log_checkin"] as const;
export const isWriteTool = (tool: string | null | undefined): boolean => !!tool && (WRITE_TOOLS as readonly string[]).includes(tool);

export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    /** Records one hit for `key` and says whether it is allowed. */
    hit(key: string, now: number = Date.now()): { ok: boolean; retryAfterS: number } {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return { ok: false, retryAfterS: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
      }
      recent.push(now);
      hits.set(key, recent);
      // keep the map from growing without bound
      if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
      return { ok: true, retryAfterS: 0 };
    },
  };
}

/** Per-user limits from the last minute's request counts. The request being checked is not yet counted. */
export function overLimit(counts: { total: number; writes: number }, isWrite: boolean): { over: boolean; reason: string } {
  if (counts.total >= LIMITS.perMinute) return { over: true, reason: `Too many requests. The limit is ${LIMITS.perMinute} a minute.` };
  if (isWrite && counts.writes >= LIMITS.writesPerMinute) return { over: true, reason: `Too many changes. The limit is ${LIMITS.writesPerMinute} writes a minute.` };
  return { over: false, reason: "" };
}
