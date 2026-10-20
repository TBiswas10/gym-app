import { describe, expect, it } from "vitest";
import { cleanReport, isNoise } from "./error-report";

describe("error reports from the phone", () => {
  it("ignores network blips and browser noise", () => {
    for (const m of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource", "ResizeObserver loop completed with undelivered notifications", "Script error."]) expect(isNoise(m)).toBe(true);
    expect(isNoise("Cannot read properties of undefined (reading 'kind')")).toBe(false);
  });
  it("keeps a real error and trims every field to its limit", () => {
    const r = cleanReport({ message: "x".repeat(500), stack: "s".repeat(3000), path: "/workout", build: "b".repeat(100), agent: "a".repeat(400) });
    expect(r).not.toBeNull();
    expect(r!.message).toHaveLength(300);
    expect(r!.stack).toHaveLength(1500);
    expect(r!.build).toHaveLength(60);
    expect(r!.agent).toHaveLength(160);
  });
  it("drops anything that is not a report", () => {
    expect(cleanReport(null)).toBeNull();
    expect(cleanReport("boom")).toBeNull();
    expect(cleanReport({ message: "" })).toBeNull();
    expect(cleanReport({ message: 42 })).toBeNull();
    expect(cleanReport({ message: "Failed to fetch" })).toBeNull();
  });
  it("has no stack when none was sent", () => {
    expect(cleanReport({ message: "Something broke", path: "/" })!.stack).toBeNull();
  });
});
