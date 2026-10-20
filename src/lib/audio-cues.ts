// Rest countdown sounds, synthesized with the Web Audio API (no audio files). A short tick for 3, 2 and 1, and a
// slightly longer two-note chime when the rest is over, so you can time your next set without looking at the phone.
//
// iPhone only lets a page make sound after you have touched it, so `primeAudio()` is called from a tap (logging a set,
// or switching the sounds on). A phone on silent can mute Web Audio; the vibration still works.

export type Cue = "tick" | "go";

/** Which cue a countdown step calls for: a tick as you enter 3, 2, 1; the chime as you reach 0. Never twice for one second. */
export function cueFor(prevLeft: number | null, left: number): Cue | null {
  if (prevLeft === left) return null;
  if (left === 0) return prevLeft !== null && prevLeft > 0 ? "go" : null;
  if (left >= 1 && left <= 3) return "tick";
  return null;
}

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

/** Call from a tap. Unlocks audio on iPhone; harmless anywhere else. */
export function primeAudio(): void {
  try {
    const c = context();
    if (c && c.state === "suspended") void c.resume().catch(() => undefined);
  } catch {
    /* no audio here: fine */
  }
}

function note(c: AudioContext, freq: number, start: number, length: number, peak: number): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  // A quick attack and an exponential fade: a soft tick, never a click.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

export function playCue(cue: Cue): void {
  try {
    const c = context();
    if (!c || c.state !== "running") return;
    const t = c.currentTime;
    if (cue === "tick") note(c, 880, t, 0.07, 0.18);
    else {
      note(c, 660, t, 0.13, 0.22);
      note(c, 990, t + 0.12, 0.22, 0.22);
    }
  } catch {
    /* never let a sound break a workout */
  }
}
