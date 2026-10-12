// Plan nudges: small suggestions the app makes from your own numbers. They only ever propose;
// nothing changes until you accept, and an answer sticks for that week.

export type NudgeKind = "deload" | "stalled" | "tired";

export interface Nudge {
  key: string;
  kind: NudgeKind;
  title: string;
  body: string;
  accept: string;
  payload: Record<string, string | number>;
}

export interface NudgeInput {
  week: number;
  setup: boolean;
  inDeload: boolean;
  deloadSuggested: boolean;
  stalls: { slug: string; name: string; title: string; tip: string; smallKg: number }[];
  /** newest first, up to 3 */
  feel: { soreness: number | null; energy: number | null }[];
  /** the next session still to do (date), and whether it is already a light one */
  nextSession: string | null;
  nextSessionLight: boolean;
  answered: ReadonlySet<string>;
}

export const MAX_NUDGES = 2;

export function computeNudges(i: NudgeInput): Nudge[] {
  const out: Nudge[] = [];

  // Two sore or drained check-ins in a row: offer a lighter next session.
  const two = i.feel.slice(0, 2);
  const tired = two.length === 2 && (two.every((f) => f.soreness != null && f.soreness >= 4) || two.every((f) => f.energy != null && f.energy <= 2));
  if (tired && i.nextSession && !i.nextSessionLight) {
    out.push({
      key: `tired:w${i.week}`,
      kind: "tired",
      title: "Take the next one lighter?",
      body: "Your last two check-ins say you're run down. A light session is about 20% lighter and still counts.",
      accept: "Make it a light session",
      payload: { date: i.nextSession },
    });
  }

  if (i.deloadSuggested && !i.inDeload) {
    out.push({
      key: `deload:w${i.week}`,
      kind: "deload",
      title: "Time for a lighter week?",
      body: "Weeks 6 to 8 are a good time. A deload week is half the sets at the same weights, and you come back stronger.",
      accept: "Make this a deload week",
      payload: { week: i.week },
    });
  }

  if (!i.setup) {
    for (const s of i.stalls) {
      out.push({
        key: `stalled:${s.slug}:w${i.week}`,
        kind: "stalled",
        title: `${s.name} has stalled`,
        body: `${s.title}. ${s.tip}`,
        accept: `Use ${s.smallKg} kg jumps`,
        payload: { slug: s.slug, kg: s.smallKg },
      });
    }
  }

  return out.filter((n) => !i.answered.has(n.key)).slice(0, MAX_NUDGES);
}
