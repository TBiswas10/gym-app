export interface Searchable {
  name: string;
  group: string;
  kit: string;
  muscles: string[];
}

/** Common gym shorthand people type, mapped to the words used in the library. */
const ALIASES: Record<string, string> = { db: "dumbbell", dbs: "dumbbells", bb: "barbell", bw: "bodyweight", rdl: "romanian", ez: "ez", abs: "core", quads: "quads" };

const norm = (s: string): string => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Every typed word must appear in the name, group, kit or muscles (as the start of a word). Empty query matches all. */
export function matchesQuery(item: Searchable, query: string): boolean {
  const words = norm(query).split(" ").filter(Boolean).map((w) => ALIASES[w] ?? w);
  if (words.length === 0) return true;
  const hay = norm([item.name, item.group, item.kit, ...item.muscles].join(" "));
  const tokens = hay.split(" ");
  return words.every((w) => tokens.some((t) => t.startsWith(w)));
}
