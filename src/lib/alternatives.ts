// Swap suggestions: other library exercises that train the same muscle, best match first. No made-up percentages: the
// match is stated in words (same main muscle / same muscle group / shares a muscle).

export interface LibraryItem {
  slug: string;
  name: string;
  kit: string;
  group: string;
  muscles: string[];
}

export type Match = "main" | "group" | "shared";

export interface Alternative extends LibraryItem {
  match: Match;
}

export const MATCH_LABEL: Record<Match, string> = { main: "Same main muscle", group: "Same muscle group", shared: "Shares a muscle" };

const rank = (m: Match): number => (m === "main" ? 3 : m === "group" ? 2 : 1);

function matchOf(target: LibraryItem, c: LibraryItem): Match | null {
  if (target.muscles[0] && c.muscles[0] === target.muscles[0]) return "main";
  if (c.group === target.group) return "group";
  if (c.muscles.some((m) => target.muscles.includes(m))) return "shared";
  return null;
}

/** Up to `limit` stand-ins for `target`: your chosen backup first when it is in the library, then by closeness of match. Skips `exclude` slugs (today's other lifts). */
export function alternativesFor(target: LibraryItem, library: LibraryItem[], backupName: string | null, exclude: string[] = [], limit = 4): Alternative[] {
  const skip = new Set([target.slug, ...exclude]);
  const out: Alternative[] = [];
  for (const c of library) {
    if (skip.has(c.slug)) continue;
    const match = matchOf(target, c);
    if (match) out.push({ ...c, match });
  }
  const b = backupName?.trim().toLowerCase();
  out.sort((x, y) => Number(y.name.toLowerCase() === b) - Number(x.name.toLowerCase() === b) || rank(y.match) - rank(x.match) || x.name.localeCompare(y.name));
  return out.slice(0, limit);
}
