import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("writes plain values and blanks", () => {
    expect(csvCell("Chest press")).toBe("Chest press");
    expect(csvCell(32.5)).toBe("32.5");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(true)).toBe("true");
  });
  it("quotes commas, quotes and new lines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });
  it("defuses spreadsheet formulas in text", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-5 kg felt bad")).toBe("'-5 kg felt bad");
    expect(csvCell("@sum")).toBe("'@sum");
  });
  it("leaves real negative numbers alone", () => {
    expect(csvCell(-2)).toBe("-2");
  });
  it("builds rows", () => {
    expect(toCsv([["a", 1], ["b,c", null]])).toBe('a,1\r\n"b,c",\r\n');
  });
});
