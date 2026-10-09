"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { completeOnboarding } from "@/lib/auth-actions";

type Answer = "ask" | "yes" | "no" | "needs-install" | "blocked";

export function NotifyForm({ saveProblem }: { saveProblem: boolean }) {
  const [answer, setAnswer] = useState<Answer>("ask");

  // Ask only after a tap, never on load. A web page can only ask once the app is on the Home Screen.
  async function allow() {
    if (typeof Notification === "undefined") return setAnswer("needs-install");
    if (Notification.permission === "denied") return setAnswer("blocked");
    try {
      const result = await Notification.requestPermission();
      setAnswer(result === "granted" ? "yes" : "no");
    } catch {
      setAnswer("no");
    }
  }

  const asking = answer === "ask";
  const wantsAlerts = answer === "yes";

  return (
    <form className="screen fill" action={completeOnboarding}>
      <input type="hidden" name="restAlerts" value={String(wantsAlerts)} />
      <div className="scroll">
        <div className="col g2" style={{ paddingTop: "var(--space-4)" }}>
          <span className="t-eyebrow c-accent">Rest timer</span>
          <h1 className="t-display">Know when rest is over.</h1>
          <p className="t-body c-2">
            Between sets you’ll check your phone or lock it. A notification tells you when your 60 to 90 seconds are up, so rests stay short and the session stays under 50 minutes.
          </p>
        </div>

        <section className="card">
          <span className="t-eyebrow c-2">What you’ll see</span>
          <div className="row g3 inset" style={{ flexDirection: "row", alignItems: "center", padding: "var(--space-3)" }}>
            <span className="round round-accent" style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)" }}>
              <Icon name="bell" />
            </span>
            <span className="col grow">
              <strong className="t-small">Rest’s up. Lat pulldown, set 2</strong>
              <span className="t-small c-2">35 kg × 10. Ready when you are.</span>
            </span>
            <span className="t-caption c-2" style={{ fontWeight: 600 }}>now</span>
          </div>
          <div className="col g3">
            <span className="row g3 start"><span className="c-info"><Icon name="info" size={20} /></span><span className="t-small">One kind only: rest ended. No marketing.</span></span>
            <span className="row g3 start"><span className="c-info"><Icon name="info" size={20} /></span><span className="t-small">Only during a workout. Turn it off any time in Plan.</span></span>
            <span className="row g3 start"><span className="c-info"><Icon name="info" size={20} /></span><span className="t-small">The timer runs inside the app and pings you at the end. iPhone doesn’t allow lock-screen timers or Dynamic Island for web apps.</span></span>
          </div>
        </section>

        {answer === "yes" && (
          <div className="banner banner-success anim-in" role="status">
            <Icon name="circle-check" />
            <span><b>Notifications are on.</b> You can change this in Plan.</span>
          </div>
        )}
        {answer === "no" && (
          <div className="banner banner-info anim-in" role="status">
            <Icon name="bell-off" />
            <span><b>No problem.</b> The timer still counts down on screen. Turn alerts on later in Plan.</span>
          </div>
        )}
        {answer === "blocked" && (
          <div className="banner banner-info anim-in" role="status">
            <Icon name="bell-off" />
            <span><b>Notifications are blocked.</b> The timer still counts down on screen. To turn them on, open iPhone Settings, then Notifications, then Workout.</span>
          </div>
        )}
        {answer === "needs-install" && (
          <div className="banner banner-info anim-in" role="status">
            <Icon name="info" />
            <span><b>Add it to your Home Screen first.</b> iPhone only allows notifications from the installed app. The timer still counts down on screen. You can turn alerts on later in Plan.</span>
          </div>
        )}
        {saveProblem && (
          <div className="banner banner-danger" role="alert">
            <Icon name="circle-alert" />
            <span>Couldn’t set things up. Check your connection and tap Let’s go again.</span>
          </div>
        )}
      </div>

      <div className="bottom-bar">
        {asking ? (
          <>
            <button type="button" className="btn btn-primary btn-cta" onClick={allow}>Allow notifications</button>
            <button type="button" className="btn btn-tertiary btn-block" style={{ color: "var(--text-2)" }} onClick={() => setAnswer("no")}>Not now</button>
          </>
        ) : (
          <button type="submit" className="btn btn-primary btn-cta">Let’s go</button>
        )}
      </div>
    </form>
  );
}
