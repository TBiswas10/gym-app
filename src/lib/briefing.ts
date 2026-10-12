// The Today briefing: what today's session asks of you, in a few plain lines. Pure; the server feeds it.

export interface BriefLift {
  name: string;
  /** "Go up to 32.5 kg" / "Hold at 30 kg" / "No suggestion yet" */
  next: string;
  up: boolean;
  first: boolean; // no history yet
}

export interface BriefInput {
  sessionName: string;
  minutes: number;
  light: boolean;
  setup: boolean;
  deload: boolean;
  highSoreness: boolean;
  lifts: BriefLift[];
  cardio: { plan: string; label: string; last: string | null };
  feel: { soreness: number | null; energy: number | null } | null;
  goal: { name: string; toGo: string } | null;
}

export interface Briefing {
  headline: string;
  sub: string;
  tries: string[];
  notes: string[];
}

export function buildBriefing(i: BriefInput): Briefing {
  const n = i.lifts.length;
  const headline = `${i.sessionName}, about ${i.minutes} min`;
  const sub = `Start with ${i.cardio.plan.toLowerCase()} (${i.cardio.label}), then ${n} ${n === 1 ? "lift" : "lifts"}.`;

  const tries: string[] = [];
  if (i.setup) {
    tries.push("Weeks 1 and 2: pick a weight you can lift about 10 times with 1 or 2 left.");
  } else {
    for (const l of i.lifts) if (l.up && tries.length < 3) tries.push(`${l.name}: ${l.next.charAt(0).toLowerCase()}${l.next.slice(1)}`);
    const fresh = i.lifts.filter((l) => l.first).map((l) => l.name);
    if (fresh.length && tries.length < 3) tries.push(`First time on ${fresh.slice(0, 2).join(" and ")}. Start light.`);
  }

  const notes: string[] = [];
  if (i.deload) notes.push("Deload week: half the sets, same weights.");
  if (i.light) notes.push("Light day: about 20% lighter than usual.");
  if (i.highSoreness) notes.push("Soreness has been high. Hold your weights today.");
  else if (i.feel?.soreness != null && i.feel.soreness >= 4) notes.push("You were quite sore last time. Warm up well and move smoothly.");
  if (i.feel?.energy != null && i.feel.energy <= 2) notes.push("Energy was low last time. Stop a rep short if it drags.");
  if (i.cardio.last) notes.push(`Last cardio: ${i.cardio.last}.`);
  if (i.goal) notes.push(`Goal: ${i.goal.name}, ${i.goal.toGo} to go.`);

  return { headline, sub, tries, notes: notes.slice(0, 4) };
}
