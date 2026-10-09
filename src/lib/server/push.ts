import webpush from "web-push";
import type { ServerClient } from "../supabase/server";

let ready = false;

/** True when the VAPID keys are set. The private key lives only in server environment variables. */
export const pushConfigured = (): boolean => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);

function configure() {
  if (ready) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
}

/** Send a notification to every subscribed device of the signed-in user. Dead subscriptions are removed. */
export async function sendToUser(supabase: ServerClient, payload: { title: string; body: string; url?: string }): Promise<{ sent: number; removed: number; failed: { status: number | null; detail: string }[] }> {
  if (!pushConfigured()) return { sent: 0, removed: 0, failed: [] };
  configure();
  const { data: subs } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
  let sent = 0;
  let removed = 0;
  const failed: { status: number | null; detail: string }[] = [];
  const message = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/workout" });
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, { TTL: 120, urgency: "high" });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode ?? null;
        const detail = String((e as { body?: string }).body ?? (e as Error).message ?? "").slice(0, 160);
        failed.push({ status, detail });
        // Visible in the Vercel logs; never includes keys or workout data.
        console.error(JSON.stringify({ evt: "push-failed", status, detail }));
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
          removed++;
        }
      }
    }),
  );
  return { sent, removed, failed };
}
