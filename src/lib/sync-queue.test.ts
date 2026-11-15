import { describe, expect, it } from "vitest";
import { afterFlush, takeBatch, unsentLogoutMessage } from "./sync-queue";
import type { Op } from "./ops";

const op = (n: number): Op => ({ t: "delset", workoutId: "w", slug: "chest", n: (n % 2) + 1 });
const q = (len: number): Op[] => Array.from({ length: len }, (_, i) => op(i));

describe("sync queue", () => {
  it("sends in order, in batches", () => {
    expect(takeBatch(q(120))).toHaveLength(50);
    expect(takeBatch(q(3))).toHaveLength(3);
    expect(takeBatch(q(0))).toEqual([]);
    expect(takeBatch(q(10), 4)).toHaveLength(4);
  });
  it("removes everything the server finished", () => {
    expect(afterFlush(q(5), 5, { done: 5, retry: false })).toEqual([]);
  });
  it("keeps what is left after a temporary failure, in order", () => {
    const queue = q(5);
    expect(afterFlush(queue, 5, { done: 2, retry: true })).toEqual(queue.slice(2));
  });
  it("keeps everything when nothing got through (offline)", () => {
    const queue = q(4);
    expect(afterFlush(queue, 4, { done: 0, retry: true })).toEqual(queue);
  });
  it("never removes more than was sent, or a negative amount", () => {
    expect(afterFlush(q(5), 2, { done: 99, retry: false })).toHaveLength(3);
    expect(afterFlush(q(5), 2, { done: -3, retry: true })).toHaveLength(5);
  });
  it("warns before logging out only when changes are unsent", () => {
    expect(unsentLogoutMessage([])).toBeNull();
    expect(unsentLogoutMessage(q(1))).toBe("1 change saved on this phone has not been sent yet. Log out anyway and it is lost.");
    expect(unsentLogoutMessage(q(3))).toBe("3 changes saved on this phone have not been sent yet. Log out anyway and they are lost.");
  });
});
