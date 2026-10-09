// CSV export. Cells that start with = + - @ (or a tab/CR) are prefixed with a quote so a spreadsheet can
// never run them as a formula.

export type Cell = string | number | boolean | null | undefined;

export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows: Cell[][]): string => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
