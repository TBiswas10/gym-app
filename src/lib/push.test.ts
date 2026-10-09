import { describe, expect, it } from "vitest";
import { restAlertText, validateRestRequest, validateSubscription, waitMs } from "./push";

describe("rest request validation", () => {
  it("accepts a sensible request and tidies the text", () => {
    expect(validateRestRequest({ seconds: 90, title: "Rest’s up.  Lat pulldown,\nset 2", body: "35 kg × 10. Ready when you are." })).toEqual({ seconds: 90, title: "Rest’s up. Lat pulldown, set 2", body: "35 kg × 10. Ready when you are." });
  });
  it("allows an empty body but not an empty title", () => {
    expect(validateRestRequest({ seconds: 60, title: "Rest’s up" })).toMatchObject({ body: "" });
    expect(validateRestRequest({ seconds: 60, title: "  " })).toBeNull();
  });
  it("limits the delay to 10-300 whole seconds", () => {
    for (const seconds of [0, 9, 301, 90.5, -5, NaN, "90"]) expect(validateRestRequest({ seconds, title: "x" })).toBeNull();
    expect(validateRestRequest({ seconds: 10, title: "x" })).not.toBeNull();
    expect(validateRestRequest({ seconds: 300, title: "x" })).not.toBeNull();
  });
  it("rejects over-long text and junk", () => {
    expect(validateRestRequest({ seconds: 60, title: "x".repeat(101) })).toBeNull();
    expect(validateRestRequest({ seconds: 60, title: "x", body: "y".repeat(161) })).toBeNull();
    for (const bad of [null, 5, "x", [], { title: "x" }]) expect(validateRestRequest(bad)).toBeNull();
  });
});

describe("subscription validation", () => {
  const good = { endpoint: "https://web.push.apple.com/abc123", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ", auth: "tBHItJI5svbpez7KI4CCXg" } };
  it("accepts a real-looking subscription", () => {
    expect(validateSubscription(good)).toEqual({ endpoint: good.endpoint, p256dh: good.keys.p256dh, auth: good.keys.auth });
  });
  it("only takes https push services", () => {
    expect(validateSubscription({ ...good, endpoint: "http://push.example/x" })).toBeNull();
    expect(validateSubscription({ ...good, endpoint: "javascript:alert(1)" })).toBeNull();
    expect(validateSubscription({ ...good, endpoint: "https://" + "a".repeat(600) })).toBeNull();
  });
  it("rejects bad keys and junk", () => {
    expect(validateSubscription({ ...good, keys: { p256dh: "not base64!!", auth: "x" } })).toBeNull();
    expect(validateSubscription({ ...good, keys: { p256dh: good.keys.p256dh } })).toBeNull();
    for (const bad of [null, 5, "x", {}, { endpoint: "https://x.example" }]) expect(validateSubscription(bad)).toBeNull();
  });
});

describe("alert wording (the design's notification)", () => {
  it("says what's next after the first set", () => {
    expect(restAlertText({ name: "Lat pulldown", setsLogged: 1, planned: 2, kind: "weight", kg: 35, reps: 10, secs: null, nextName: "Seated row" })).toEqual({
      title: "Rest’s up. Lat pulldown, set 2", body: "35 kg × 10. Ready when you are.",
    });
  });
  it("handles planks and bodyweight", () => {
    expect(restAlertText({ name: "Plank", setsLogged: 1, planned: 2, kind: "timed", kg: null, reps: null, secs: 30, nextName: null }).body).toBe("30 s. Ready when you are.");
    expect(restAlertText({ name: "Back extension", setsLogged: 1, planned: 2, kind: "bodyweight", kg: 0, reps: 12, secs: null, nextName: null }).body).toBe("Bodyweight × 12. Ready when you are.");
  });
  it("points to the next exercise after the last set", () => {
    expect(restAlertText({ name: "Lat pulldown", setsLogged: 2, planned: 2, kind: "weight", kg: 35, reps: 10, secs: null, nextName: "Seated row" })).toEqual({ title: "Rest’s up. Next: Seated row", body: "Ready when you are." });
    expect(restAlertText({ name: "Plank", setsLogged: 2, planned: 2, kind: "timed", kg: null, reps: null, secs: 30, nextName: null }).title).toBe("Rest’s up");
  });
});

describe("server wait", () => {
  it("waits until the end time, never negative, never past the limit", () => {
    expect(waitMs(10_000, 4_000)).toBe(6_000);
    expect(waitMs(1_000, 4_000)).toBe(0);
    expect(waitMs(10_000_000, 0)).toBe(300_000);
  });
});
