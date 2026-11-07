/** The first `limit` different exercise slugs, in the order given (pass newest first). */
export function recentSlugs(slugs: string[], limit = 5): string[] {
  return [...new Set(slugs)].slice(0, limit);
}
