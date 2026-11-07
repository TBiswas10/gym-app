import { describe, expect, it } from "vitest";
import { waitingMessage } from "./sync-status";
import type { Op } from "./ops";

const set = (id: string): Op => ({ t: "set", id, workoutId: "w", slug: "chest", position: 1, n: 1, variant: null, kg: 20, reps: 10, secs: null, source: "app" });
const finish: Op = { t: "finish", workoutId: "w", endedAt: "2026-11-07T08:00:00Z" };

describe("waiting-to-send line", () => {
  it("says nothing when nothing waits", () => {
    expect(waitingMessage([])).toBeNull();
  });
  it("counts sets, with the singular for one", () => {
    expect(waitingMessage([set("a")])).toBe("1 set waiting to send");
    expect(waitingMessage([set("a"), set("b"), set("c")])).toBe("3 sets waiting to send");
  });
  it("counts only sets when a finish is queued with them", () => {
    expect(waitingMessage([set("a"), set("b"), finish])).toBe("2 sets waiting to send");
  });
  it("says the workout is saved when only a start or finish waits", () => {
    expect(waitingMessage([finish])).toBe("Your workout is saved and will send when you are online");
  });
});
