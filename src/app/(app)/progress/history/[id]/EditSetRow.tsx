"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { sheetDrag } from "@/components/sheetDrag";
import type { ExerciseKind } from "@/lib/plan";
import { deleteSet, editSet } from "./set-actions";

export interface LoggedSet {
  id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  seconds: number | null;
}

const number = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

/** One logged set on a finished session. Edit opens a sheet to fix the numbers, or delete the set after a second tap. */
export function EditSetRow({ set, kind, exercise, line }: { set: LoggedSet; kind: ExerciseKind; exercise: string; line: string }) {
  const timed = kind === "timed";
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState("");
  const [reps, setReps] = useState("");
  const [secs, setSecs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  // Start from what is saved now, so a sheet opened after an earlier save shows the current numbers.
  const show = () => {
    setKg(String(set.weight_kg ?? 0));
    setReps(set.reps == null ? "" : String(set.reps));
    setSecs(set.seconds == null ? "" : String(set.seconds));
    setError(null);
    setConfirming(false);
    setOpen(true);
  };
  const close = () => {
    if (!pending) setOpen(false);
  };

  const save = () => {
    setError(null);
    const input = timed ? { kg: null, reps: null, secs: number(secs) } : { kg: number(kg), reps: number(reps), secs: null };
    startTransition(async () => {
      const res = await editSet(set.id, input);
      if (res.ok) setOpen(false);
      else setError(res.error);
    });
  };

  const remove = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteSet(set.id);
      if (res.ok) setOpen(false);
      else {
        setError(res.error);
        setConfirming(false);
      }
    });
  };

  return (
    <>
      <div className="row between">
        <span className="t-small c-2">Set {set.set_number}</span>
        <span className="row g2" style={{ alignItems: "center" }}>
          <span className="t-body" style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{line}</span>
          <button type="button" className="btn btn-tertiary" aria-label={`Edit set ${set.set_number} of ${exercise}`} onClick={show}>Edit</button>
        </span>
      </div>

      {open && (
        <>
          <div className="scrim anim-fade" onClick={close} />
          <div className="sheet-wrap" {...sheetDrag(close)}>
            <div className="sheet" role="dialog" aria-label={`Edit set ${set.set_number}, ${exercise}`} style={{ maxHeight: 640, overflowY: "auto" }}>
              <span className="sheet-grab" />
              <div className="row between g3 start">
                <div className="col g1">
                  <h2 className="t-title">{exercise}</h2>
                  <span className="t-small c-2">Set {set.set_number}</span>
                </div>
                <button type="button" className="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button>
              </div>

              {timed ? (
                <SetField label="Seconds" value={secs} onChange={setSecs} max={3600} />
              ) : (
                <div className="row g2 start">
                  <SetField label="Weight (kg)" value={kg} onChange={setKg} max={400} decimal />
                  <SetField label="Reps" value={reps} onChange={setReps} max={100} />
                </div>
              )}

              {error && <p className="field-error" role="alert">{error}</p>}

              <button type="button" className={`btn btn-primary btn-block${pending ? " is-loading" : ""}`} onClick={save}>Save</button>
              <button type="button" className="btn btn-secondary btn-block" onClick={close}>Cancel</button>
              <button type="button" className="btn btn-danger btn-block" onClick={remove}>
                {confirming ? "Tap again to delete this set" : "Delete set"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function SetField({ label, value, onChange, max, decimal = false }: { label: string; value: string; onChange: (v: string) => void; max: number; decimal?: boolean }) {
  return (
    <label className="field" style={{ flex: 1 }}>
      <span className="field-label">{label}</span>
      <input autoComplete="off" className="input" type="number" inputMode={decimal ? "decimal" : "numeric"} min={0} max={max} step={decimal ? "0.01" : "1"} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
