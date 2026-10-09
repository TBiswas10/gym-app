"use client";

// The phone's side of push. iPhone only allows web push once the app is on the Home Screen (iOS 16.4+), and
// only after a tap. Everything here fails soft: the on-screen rest timer always works without it.

export type PushStatus = "on" | "denied" | "needs-install" | "unsupported" | "error";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Where things stand right now, without asking for anything. */
export async function pushState(): Promise<PushStatus | "ask"> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  if (typeof Notification === "undefined" || !("PushManager" in window)) return "needs-install";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "default") return "ask";
  try {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.pushManager.getSubscription()) ? "on" : "ask";
  } catch {
    return "error";
  }
}

/** Ask permission (call this from a tap), subscribe this phone, and tell the server about it. */
export async function enableRestAlerts(): Promise<PushStatus> {
  if (!("serviceWorker" in navigator)) return "unsupported";
  if (typeof Notification === "undefined" || !("PushManager" in window)) return "needs-install";
  if (!PUBLIC_KEY) return "error";
  try {
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(PUBLIC_KEY) }));
    const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    return res.ok ? "on" : "error";
  } catch {
    return "error";
  }
}

/** Forget this phone on the server (alerts turned off). */
export async function disableRestAlerts(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
  } catch {
    /* nothing to undo */
  }
}

/** Tell the server a rest started; it sends the alert when it ends. Returns an id to cancel with, or null. */
export async function scheduleRestPush(seconds: number, title: string, body: string): Promise<string | null> {
  try {
    const res = await fetch("/api/push/rest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seconds, title, body }) });
    if (!res.ok) return null;
    return ((await res.json()) as { id: string | null }).id;
  } catch {
    return null;
  }
}

export async function cancelRestPush(id: string): Promise<void> {
  try {
    await fetch("/api/push/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  } catch {
    /* the alert will simply arrive; harmless */
  }
}

/** Friendly wording for each outcome, in the design's tone. */
export const PUSH_MESSAGE: Record<Exclude<PushStatus, "on">, string> = {
  denied: "Notifications are blocked. To turn them on, open iPhone Settings, then Notifications, then Workout.",
  "needs-install": "Add it to your Home Screen first. iPhone only allows notifications from the installed app.",
  unsupported: "This browser can’t send notifications. The timer still counts down on screen.",
  error: "Couldn’t turn notifications on. Check your connection and try again.",
};
