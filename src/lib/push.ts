// Push notification helpers. Pure: wording of the rest-timer alert, and validation of what the phone sends.

import { fmtNum } from "./format";
import type { ExerciseKind } from "./plan";

export const REST_MIN_S = 10;
export const REST_MAX_S = 300;

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return s.length <= max ? s : null;
};

export interface RestRequest {
  seconds: number;
  title: string;
  body: string;
}

export function validateRestRequest(raw: unknown): RestRequest | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.seconds !== "number" || !Number.isInteger(r.seconds) || r.seconds < REST_MIN_S || r.seconds > REST_MAX_S) return null;
  const title = clean(r.title, 100);
  const body = clean(r.body ?? "", 160);
  if (!title || body === null) return null;
  return { seconds: r.seconds, title, body };
}

export interface SubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** What the browser's PushSubscription.toJSON() looks like. Only https push services are accepted. */
export function validateSubscription(raw: unknown): SubscriptionInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const b64 = /^[A-Za-z0-9_-]+={0,2}$/;
  if (typeof r.endpoint !== "string" || r.endpoint.length > 600 || !r.endpoint.startsWith("https://")) return null;
  try {
    new URL(r.endpoint);
  } catch {
    return null;
  }
  const p256dh = r.keys?.p256dh;
  const auth = r.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100 || !b64.test(p256dh) || !b64.test(auth)) return null;
  return { endpoint: r.endpoint, p256dh, auth };
}

/** The notification shown when rest ends (design: "Rest's up. Lat pulldown, set 2" / "35 kg × 10. Ready when you are."). */
export function restAlertText(i: {
  name: string;
  setsLogged: number;
  planned: number;
  kind: ExerciseKind;
  kg: number | null;
  reps: number | null;
  secs: number | null;
  nextName: string | null;
}): { title: string; body: string } {
  if (i.setsLogged < i.planned) {
    const target = i.kind === "timed" ? `${i.secs ?? 0} s` : `${i.kg ? `${fmtNum(i.kg)} kg` : "Bodyweight"} × ${i.reps ?? 0}`;
    return { title: `Rest’s up. ${i.name}, set ${i.setsLogged + 1}`, body: `${target}. Ready when you are.` };
  }
  return i.nextName
    ? { title: `Rest’s up. Next: ${i.nextName}`, body: "Ready when you are." }
    : { title: "Rest’s up", body: "Nice work. Finish up when you’re ready." };
}

/** How long the server waits before sending: until the stored end time, never more than the limit. */
export const waitMs = (endsAtMs: number, nowMs: number): number => Math.min(REST_MAX_S * 1000, Math.max(0, endsAtMs - nowMs));
