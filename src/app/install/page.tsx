"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

const STEPS = [
  { title: "Tap the Share button", body: "It’s the square with an arrow in the bar at the bottom of Safari.", alt: "Safari with the Share button highlighted" },
  { title: "Choose Add to Home Screen", body: "Scroll down the share sheet until you see it, then tap.", alt: "Share sheet with Add to Home Screen highlighted" },
  { title: "Tap Add", body: "Keep the name as Workout, or rename it. Then tap Add at the top right.", alt: "Add to Home Screen dialog with Add highlighted" },
  { title: "Open it from your Home Screen", body: "Find the Workout icon and open it from there. That’s the installed app.", alt: "Home Screen with the Workout icon highlighted" },
];

const skel = (w: string, h: number) => <span className="skeleton" style={{ height: h, width: w, animation: "none" }} />;

export default function InstallPage() {
  const [step, setStep] = useState(0);
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);
  const t = STEPS[step];
  const last = step === 3;

  return (
    <div className="screen fill">
      <div className="scroll">
        <div className="row between">
          <span className="t-eyebrow c-accent">Step {step + 1} of 4</span>
          <Link className="btn btn-tertiary" href="/notifications" style={{ color: "var(--text-2)" }}>
            Skip for now
          </Link>
        </div>
        <div className="col g2">
          <h1 className="t-title">Put it on your Home Screen</h1>
          <p className="t-small c-2">It opens full screen like an app. You need it for rest-timer notifications. Use Safari on iPhone.</p>
        </div>
        <div className="dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <i key={i} className={i === step ? "on" : ""} />
          ))}
        </div>

        <div className="card stage" role="img" aria-label={t.alt}>
          {step === 0 && (
            <div className="anim-in" style={{ position: "absolute", inset: 0 }}>
              <div style={{ position: "absolute", left: 36, right: 36, top: 24, bottom: 0, borderRadius: "var(--radius-lg) var(--radius-lg) 0 0", background: "var(--bg)", border: "2px solid var(--border-strong)", borderBottom: 0, overflow: "hidden" }}>
                <div className="col g2" style={{ padding: "var(--space-4)" }}>
                  {skel("60%", 14)}
                  {skel("85%", 10)}
                  {skel("70%", 10)}
                </div>
                <div className="ios-bar" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
                  <Icon name="chevron-left" />
                  <span style={{ position: "relative", width: 44, height: 44, borderRadius: "50%", background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="ring" />
                    <Icon name="share" />
                  </span>
                  <Icon name="chevron-right" />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="anim-in" style={{ position: "absolute", inset: 0, padding: "var(--space-4) var(--space-4) 0", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div className="col g2" style={{ background: "var(--raised)", borderRadius: "var(--radius-md) var(--radius-md) 0 0", padding: "var(--space-3) var(--space-3) 0" }}>
                <span className="sheet-grab" style={{ marginBottom: "var(--space-1)" }} />
                <div className="ios-row"><span>Copy</span></div>
                <div className="ios-row"><span>Add to Bookmarks</span></div>
                <div className="ios-row hot">
                  <span>Add to Home Screen</span>
                  <Icon name="square-plus" />
                  <span className="ring" style={{ borderRadius: "var(--radius-sm)" }} />
                </div>
                <div className="ios-row" style={{ borderRadius: "var(--radius-sm) var(--radius-sm) 0 0" }}><span>Find on Page</span></div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="anim-in col g3" style={{ position: "absolute", inset: 0, padding: "var(--space-4)" }}>
              <div className="row between">
                <span className="t-small c-2 bold">Cancel</span>
                <strong className="t-small">Add to Home Screen</strong>
                <span className="bold" style={{ position: "relative", padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-full)", background: "var(--accent)", color: "var(--on-accent)", fontSize: ".9375rem" }}>
                  Add<span className="ring" />
                </span>
              </div>
              <div className="row g3 inset" style={{ padding: "var(--space-3)" }}>
                <span className="app-tile ours"><Icon name="dumbbell" size={32} /></span>
                <span className="col grow">
                  <span className="t-heading" style={{ fontSize: "1.125rem" }}>Workout</span>
                  <span className="t-small c-2">{host || "your-app-address"}</span>
                </span>
              </div>
              <p className="t-small c-2">An icon will be added to your Home Screen so you can open this like an app.</p>
            </div>
          )}

          {step === 3 && (
            <div className="anim-in col g4" style={{ position: "absolute", inset: 0, padding: "var(--space-6) var(--space-6) 0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "var(--space-4) var(--space-2)", justifyItems: "center" }}>
                {["Mail", "Maps", "Notes", "Clock", "Photos"].map((n) => (
                  <span key={n} className="col center g1"><span className="app-tile" /><span className="t-caption c-2" style={{ fontWeight: 600 }}>{n}</span></span>
                ))}
                <span className="col center g1">
                  <span className="app-tile ours"><Icon name="dumbbell" size={32} /><span className="ring" style={{ borderRadius: 13 }} /></span>
                  <span className="t-caption" style={{ color: "var(--accent)" }}>Workout</span>
                </span>
                {["Health", "Wallet"].map((n) => (
                  <span key={n} className="col center g1"><span className="app-tile" /><span className="t-caption c-2" style={{ fontWeight: 600 }}>{n}</span></span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="col g1">
          <h2 className="t-heading">{t.title}</h2>
          <p className="t-small c-2">{t.body}</p>
        </div>
      </div>

      <div className="bottom-bar" style={{ display: "grid", gridTemplateColumns: step > 0 ? "112px minmax(0, 1fr)" : "minmax(0, 1fr)", gap: "var(--space-2)", flexDirection: "unset" }}>
        {step > 0 && (
          <button type="button" className="btn btn-secondary btn-cta" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        {!last && (
          <button type="button" className="btn btn-primary btn-cta" onClick={() => setStep(step + 1)}>
            Next
          </button>
        )}
        {last && (
          <Link className="btn btn-primary btn-cta" href="/notifications">
            I’ve added it
          </Link>
        )}
      </div>
    </div>
  );
}
