"use client";

import { useRef, useState } from "react";

interface Counts {
  sessions: number;
  sets: number;
  cardio: number;
  checkins: number;
}
type Step = { s: "idle" } | { s: "busy" } | { s: "preview"; text: string; add: Counts; skipped: number } | { s: "done"; add: Counts } | { s: "error"; msg: string };

const words = (c: Counts) => `${c.sessions} ${c.sessions === 1 ? "session" : "sessions"}, ${c.sets} sets, ${c.cardio} cardio, ${c.checkins} check-ins`;
const total = (c: Counts) => c.sessions + c.sets + c.cardio + c.checkins;

/** Choose a backup file, see what it would add, then add it. Adds missing history only; nothing is changed or deleted. */
export function RestoreBackup() {
  const [step, setStep] = useState<Step>({ s: "idle" });
  const input = useRef<HTMLInputElement>(null);

  const send = async (text: string, apply: boolean) => {
    const r = await fetch(`/api/restore${apply ? "?apply=1" : ""}`, { method: "POST", body: text, credentials: "same-origin" });
    return (await r.json().catch(() => ({ ok: false, error: "That didn’t work. Try again in a moment." }))) as { ok: boolean; error?: string; would_add?: Counts; added?: Counts; skipped?: number };
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setStep({ s: "busy" });
    const text = await file.text();
    const j = await send(text, false).catch(() => null);
    if (!j?.ok || !j.would_add) return setStep({ s: "error", msg: j?.error ?? "No connection. Try again with a signal." });
    setStep({ s: "preview", text, add: j.would_add, skipped: j.skipped ?? 0 });
  };

  const apply = async (text: string) => {
    setStep({ s: "busy" });
    const j = await send(text, true).catch(() => null);
    if (!j?.ok || !j.added) return setStep({ s: "error", msg: j?.error ?? "No connection. Try again with a signal." });
    setStep({ s: "done", add: j.added });
  };

  return (
    <div className="col g2">
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => void pick(e.target.files?.[0])} />
      {step.s === "idle" && (
        <button type="button" className="btn btn-secondary btn-block" onClick={() => input.current?.click()}>
          Restore from a backup file
        </button>
      )}
      {step.s === "busy" && (
        <p className="t-small c-2" role="status">
          Working…
        </p>
      )}
      {step.s === "preview" && (
        <div className="col g2" role="status">
          {total(step.add) === 0 ? (
            <p className="t-small">Everything in that file is already in your account. Nothing to add.</p>
          ) : (
            <p className="t-small">
              This would add {words(step.add)}.{step.skipped ? ` ${step.skipped} rows in the file were not usable and are left out.` : ""} Nothing you already have is changed or deleted, and your plan and settings are not touched.
            </p>
          )}
          <div className="grid2">
            <button type="button" className="btn btn-secondary" onClick={() => setStep({ s: "idle" })}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={total(step.add) === 0} onClick={() => void apply(step.text)}>
              Add them
            </button>
          </div>
        </div>
      )}
      {step.s === "done" && (
        <p className="t-small" role="status">
          Added {words(step.add)}. Open Progress to see them.
        </p>
      )}
      {step.s === "error" && (
        <div className="col g2" role="alert">
          <p className="t-small c-danger">{step.msg}</p>
          <button type="button" className="btn btn-secondary" onClick={() => setStep({ s: "idle" })}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
