import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChangesView } from "./ChangesView";

const row = (over = {}) => ({ id: "11111111-1111-4111-8111-111111111111", created_at: "2026-10-10T03:30:00Z", source: "claude" as const, action: "edit_plan_day", summary: "Edited Monday (Push)", undoable: true, undone_at: null, ...over });

describe("Change log screen", () => {
  it("lists changes with who made them and an undo button", () => {
    const out = renderToStaticMarkup(<ChangesView rows={[row(), row({ id: "22222222-2222-4222-8222-222222222222", source: "app", summary: "Settings: rest alerts off" })]} />);
    expect(out).toContain("Change log");
    expect(out).toContain("Edited Monday (Push)");
    expect(out).toContain("Claude");
    expect(out).toContain("You, in the app");
    expect(out).toContain("Undo this");
  });
  it("shows undone and non-undoable entries without a button", () => {
    const out = renderToStaticMarkup(<ChangesView rows={[row({ undone_at: "2026-10-10T04:00:00Z" }), row({ id: "33333333-3333-4333-8333-333333333333", undoable: false })]} />);
    expect(out).toContain("Undone");
    expect(out).toContain("Can’t be undone automatically");
    expect(out).not.toContain("Undo this");
  });
  it("has a friendly empty state", () => {
    expect(renderToStaticMarkup(<ChangesView rows={[]} />)).toContain("Nothing has changed yet.");
  });
});
