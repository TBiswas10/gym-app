// The one warm line on the finish screen. Plain, specific, never pushy.
export function encouragement(c: { totalSessions: number; doneThisWeek: number; plannedThisWeek: number; streakWeeks: number; pbs: number }): string {
  if (c.totalSessions <= 1) return "First session done. The hardest one is behind you.";
  const weekDone = c.doneThisWeek >= c.plannedThisWeek;
  if (weekDone) {
    return c.streakWeeks >= 2 ? `That’s every session this week. ${c.streakWeeks} full weeks in a row.` : "That’s every session this week. Well done.";
  }
  if (c.pbs > 0) return c.pbs === 1 ? "A new best today. That’s the work paying off." : `${c.pbs} new bests today. That’s the work paying off.`;
  const left = c.plannedThisWeek - c.doneThisWeek;
  return `${c.doneThisWeek} of ${c.plannedThisWeek} sessions this week. ${left} to go.`;
}
