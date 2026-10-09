import { describe, expect, it } from "vitest";
import { createLimiter, isWriteTool, LIMITS, overLimit } from "./rate-limit";

describe("in-memory limiter", () => {
  it("allows up to the limit, then says how long to wait", () => {
    const l = createLimiter(3, 60_000);
    expect([1, 2, 3].map(() => l.hit("ip", 1000).ok)).toEqual([true, true, true]);
    const r = l.hit("ip", 1000);
    expect(r.ok).toBe(false);
    expect(r.retryAfterS).toBe(60);
  });
  it("counts each key separately", () => {
    const l = createLimiter(1, 60_000);
    expect(l.hit("a", 0).ok).toBe(true);
    expect(l.hit("b", 0).ok).toBe(true);
    expect(l.hit("a", 1).ok).toBe(false);
  });
  it("lets requests through again once the window has passed", () => {
    const l = createLimiter(2, 60_000);
    l.hit("k", 0);
    l.hit("k", 10_000);
    expect(l.hit("k", 20_000).ok).toBe(false);
    expect(l.hit("k", 60_001).ok).toBe(true); // the first hit has aged out
  });
  it("reports a retry time that shrinks as the window moves", () => {
    const l = createLimiter(1, 60_000);
    l.hit("k", 0);
    expect(l.hit("k", 45_000).retryAfterS).toBe(15);
  });
  it("does not count blocked attempts against you", () => {
    const l = createLimiter(1, 1000);
    l.hit("k", 0);
    for (let i = 0; i < 10; i++) l.hit("k", 500);
    expect(l.hit("k", 1001).ok).toBe(true);
  });
});

describe("per-user limits", () => {
  it("allows normal use", () => {
    expect(overLimit({ total: 10, writes: 2 }, true).over).toBe(false);
  });
  it("stops at the overall limit", () => {
    expect(overLimit({ total: LIMITS.perMinute, writes: 0 }, false)).toMatchObject({ over: true });
  });
  it("has a tighter limit for writes, which does not affect reads", () => {
    expect(overLimit({ total: 25, writes: LIMITS.writesPerMinute }, true).over).toBe(true);
    expect(overLimit({ total: 25, writes: LIMITS.writesPerMinute }, false).over).toBe(false);
  });
  it("knows which tools write", () => {
    expect(isWriteTool("log_sets")).toBe(true);
    expect(isWriteTool("get_history")).toBe(false);
    expect(isWriteTool(null)).toBe(false);
  });
});
