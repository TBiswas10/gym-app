"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { fmtNum } from "@/lib/format";
import type { MachineId } from "@/lib/cardio";
import { NumField } from "@/components/NumField";
import { useSwipeUp } from "@/components/useSwipeUp";
import { haptic } from "@/lib/haptics";
import { cardioGuard, extendRest, mmss, restPercent, restRemaining, restSecondsAfter, sessionClock } from "@/lib/timers";
import { isPB, verdict as verdictFor } from "@/lib/progression";
import type { Source } from "@/lib/ops";
import {
  addKg, adjust, adjustCardio, advance, buildState, cancelEdit, chooseMachine, currentStep, deleteSet, diffOps, exSpec, exercises,
  finishCardio, goTo, logSet, nextIndex, sameAsLast, setCardioMinutes, setFeel, setNotes, setValue, skip, startEdit, swap,
  moveExercise, updateSet, restoreLast, wrapUp, type ExStep, type Step, type WState,
} from "@/lib/workout-state";
import type { Guide, WorkoutPage } from "@/lib/server/workout-data";
import { CardioCard } from "./CardioCard";
import { GuideSheet } from "./GuideSheet";
import { SetTip } from "./SetTip";
import { useSync } from "./useSync";
import { cancelRestPush, disableRestAlerts, enableRestAlerts, PUSH_MESSAGE, pushState, scheduleRestPush } from "@/lib/push-client";
import { restAlertText } from "@/lib/push";
import { saveSettings } from "@/app/(app)/plan/actions";
import { loadQueue } from "@/lib/sync-queue";

const WS_KEY = (id: string) => `wt.ws.${id}`;
const REST_KEY = "wt.rest";

interface Toast {
  text: string;
  until: number;
  undo: { prev: WState; next: WState } | null;
}

const targetLabel = (e: ExStep): string => `${e.range[0]}–${e.range[1]}${e.exKind === "timed" ? " s" : ""}`;
const setText = (e: ExStep, v: { kg: number | null; reps: number | null; secs: number | null }): string =>
  e.exKind === "timed" ? `${v.secs} s` : e.exKind === "bodyweight" && !v.kg ? `BW × ${v.reps}` : `${fmtNum(v.kg ?? 0)} kg × ${v.reps}`;
/** Last time's number for set `i`, shown faintly in the tile so you can see what you are trying to beat. */
const ghostText = (e: ExStep, i: number): string | null => {
  if (!e.last || e.swapped) return null;
  if (e.exKind === "timed") return e.last.secs[i] != null ? `${e.last.secs[i]} s` : null;
  const r = e.last.reps[i];
  if (r == null) return null;
  return e.exKind === "bodyweight" && !e.last.kg ? `BW × ${r}` : `${fmtNum(e.last.kg ?? 0)} kg × ${r}`;
};
const lastLabel = (e: ExStep): string => {
  if (!e.last) return "";
  if (e.exKind === "timed") return e.last.secs.map((s) => `${s} s`).join(", ");
  return `${e.exKind === "bodyweight" ? "Bodyweight" : `${fmtNum(e.last.kg ?? 0)} kg`} · ${e.last.reps.join(", ")}`;
};
const dispName = (e: ExStep): string => (e.swapped ? e.backup : e.name);

export function WorkoutView({ page }: { page: WorkoutPage }) {
  const router = useRouter();
  const { init, meta, guides, lastCardio } = page;
  const id = meta.workoutId;
  const { pending, online, signedOut, enqueue } = useSync();

  // ---- state: starts from the server, then prefers what is saved on this phone (it may hold newer sets)
  const [ws, setWs] = useState<WState>(() => buildState(init));
  const wsRef = useRef(ws);
  const commit = useCallback((next: WState) => {
    wsRef.current = next;
    setWs(next);
  }, []);
  useEffect(() => {
    try {
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const k = window.localStorage.key(i);
        if (k?.startsWith("wt.ws.") && k !== WS_KEY(id)) window.localStorage.removeItem(k);
      }
      const raw = window.localStorage.getItem(WS_KEY(id));
      if (raw) {
        const saved = JSON.parse(raw) as WState;
        if (saved.workoutId === id && Array.isArray(saved.steps)) commit(saved);
      }
    } catch {
      /* no storage: the server copy is used */
    }
  }, [id, commit]);
  useEffect(() => {
    try {
      window.localStorage.setItem(WS_KEY(id), JSON.stringify(ws));
    } catch {
      /* ignore */
    }
  }, [id, ws]);

  // ---- clocks (start time and rest end time are stored; every tick recalculates from the real clock)
  const startMs = useMemo(() => Date.parse(meta.startedAt), [meta.startedAt]);
  const [now, setNow] = useState<number | null>(null);
  const [rest, setRest] = useState<{ end: number; total: number } | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const tick = () => setNow(Date.now());
    const iv = window.setInterval(tick, 1000);
    const vis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", vis);
    try {
      const raw = JSON.parse(window.localStorage.getItem(REST_KEY) ?? "null");
      if (raw?.workoutId === id && raw.end > Date.now()) setRest({ end: raw.end, total: raw.total });
    } catch {
      /* ignore */
    }
    return () => {
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [id]);
  const nowMs = now ?? startMs;
  const clock = sessionClock(startMs, nowMs);
  const restLeft = rest ? restRemaining(rest.end, nowMs) : 0;
  const resting = !!rest && restLeft > 0;

  // Rest finished while you're looking at the app: a tap on the haptic engine.
  const wasResting = useRef(false);
  useEffect(() => {
    if (wasResting.current && !resting && rest === null) return;
    if (wasResting.current && !resting) haptic("success");
    wasResting.current = resting;
  }, [resting, rest]);

  // Keep the screen on during the session so the timer never goes dark mid-set (iPhone 16.4+, Home Screen app).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const get = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (wl && document.visibilityState === "visible") lock = await wl.request("screen");
      } catch {
        /* not allowed here: fine */
      }
    };
    void get();
    const vis = () => document.visibilityState === "visible" && void get();
    document.addEventListener("visibilitychange", vis);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      void lock?.release().catch(() => {});
    };
  }, []);

  // ---- rest alert (push). The on-screen timer works without it; this only adds the notification.
  const [notify, setNotify] = useState(false);
  const [notifyNote, setNotifyNote] = useState<string | null>(null);
  const pushId = useRef<string | null>(null);
  useEffect(() => {
    void pushState().then((st) => st === "on" && meta.restAlerts && setNotify(true));
  }, [meta.restAlerts]);
  const cancelPush = () => {
    const p = pushId.current;
    pushId.current = null;
    if (p) void cancelRestPush(p);
  };

  const lastAlert = useRef<{ title: string; body: string } | null>(null);
  const startRest = (seconds: number, alert?: { title: string; body: string }) => {
    lastAlert.current = alert ?? null;
    const r = { end: Date.now() + seconds * 1000, total: seconds };
    setRest(r);
    try {
      window.localStorage.setItem(REST_KEY, JSON.stringify({ ...r, workoutId: id }));
    } catch {
      /* ignore */
    }
    cancelPush();
    if (notify && alert) void scheduleRestPush(seconds, alert.title, alert.body).then((pid) => { pushId.current = pid; });
  };
  // +15 s / -15 s on a running rest; the phone alert moves with it.
  const nudgeRest = (seconds: number) => {
    if (!rest) return;
    haptic("tap");
    const r = extendRest(rest, seconds, Date.now());
    setRest(r);
    try {
      window.localStorage.setItem(REST_KEY, JSON.stringify({ ...r, workoutId: id }));
    } catch {
      /* ignore */
    }
    cancelPush();
    const left = Math.ceil((r.end - Date.now()) / 1000);
    if (notify && lastAlert.current && left >= 10) void scheduleRestPush(left, lastAlert.current.title, lastAlert.current.body).then((pid) => { pushId.current = pid; });
  };
  const stopRest = () => {
    setRest(null);
    try {
      window.localStorage.removeItem(REST_KEY);
    } catch {
      /* ignore */
    }
    cancelPush();
  };
  const toggleNotify = async () => {
    setNotifyNote(null);
    if (notify) {
      setNotify(false);
      cancelPush();
      void saveSettings({ restAlerts: false });
      void disableRestAlerts();
      return;
    }
    const r = await enableRestAlerts();
    if (r === "on") {
      setNotify(true);
      void saveSettings({ restAlerts: true });
    } else setNotifyNote(PUSH_MESSAGE[r]);
  };

  // ---- toast + undo
  const [toast, setToast] = useState<Toast | null>(null);
  const toastSwipe = useSwipeUp(() => setToast(null));
  const toastLive = toast && nowMs < toast.until ? toast : null;
  const flash = (text: string, undo: Toast["undo"] = null) => setToast({ text, until: Date.now() + 5000, undo });

  /** Apply a change: update the screen, queue what the server needs, and optionally offer Undo. */
  const run = (next: WState, o: { toast?: string; undoable?: boolean; source?: Source } = {}) => {
    const prev = wsRef.current;
    commit(next);
    enqueue(diffOps(prev, next, o.source));
    if (o.toast) flash(o.toast, o.undoable ? { prev, next } : null);
  };
  /** A change that is only on screen (steppers, picking things). */
  const local = (next: WState) => commit(next);

  const doUndo = () => {
    if (!toast?.undo) return;
    const { prev, next } = toast.undo;
    commit(prev);
    enqueue(diffOps(next, prev));
    stopRest();
    setToast(null);
  };

  // ---- derived
  const steps = ws.steps;
  const s: Step = currentStep(ws);
  const exs = exercises(ws);
  const cardioStep = steps.find((x) => x.kind === "cardio")!;
  const cardioIdx = steps.findIndex((x) => x.kind === "cardio");
  const ex = s.kind === "ex" ? s : null;
  const editing = !!ex && ws.editIdx >= 0 && ws.editIdx < ex.sets.length;
  const complete = !!ex && ex.sets.length >= ex.planned;
  const exNo = steps.slice(0, ws.cur + 1).filter((x) => x.kind === "ex").length;
  const ni = nextIndex(steps, ws.cur);
  const next = steps[ni] && steps[ni].status === "todo" && ni > ws.cur ? steps[ni] : null;
  const level = clock.level;
  const todoLifts = exs.filter((e) => e.status === "todo").length;
  const cardioMin = ws.cardio.params[ws.cardio.machine].min ?? 10;
  const [guardOff, setGuardOff] = useState(false);
  const guard = cardioGuard({ elapsedS: clock.elapsed, todoLifts, cardioMinutes: cardioMin, cardioDone: cardioStep.status === "done", dismissed: true || guardOff }); // cardio is first now, so there is nothing to shorten late
  const showAmber = level === "warn" && !guard.show;
  const [guideOpen, setGuideOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  // The set that was just logged gets a quick pop, so you can tell it registered without reading.
  const [just, setJust] = useState(-1);

  // After the last set of a lift, when the rest runs out, move on by itself (with a moment to say no).
  const [autoAt, setAutoAt] = useState<number | null>(null);
  const autoOff = useRef(-1);
  const restOver = !!rest && restLeft === 0;
  const wantAuto = restOver && complete && !!next && !editing && autoOff.current !== ws.cur;
  useEffect(() => {
    if (wantAuto) setAutoAt((a) => a ?? Date.now() + 3000);
    else setAutoAt(null);
  }, [wantAuto]);
  const autoGo = useRef<() => void>(() => {});
  useEffect(() => {
    if (autoAt === null) return;
    const t = window.setTimeout(() => autoGo.current(), Math.max(0, autoAt - Date.now()));
    return () => window.clearTimeout(t);
  }, [autoAt]);
  const [reorder, setReorder] = useState(false);
  // Drag a lift by its handle: the row follows your finger and swaps places as it passes its neighbours.
  const [drag, setDrag] = useState<{ slug: string; startY: number; h: number; emitted: number } | null>(null);
  const [dragDy, setDragDy] = useState(0);

  const verdictInfo = ex && complete && !editing ? verdictFor(exSpec(ex), ex.sets, { setup: meta.setup, highSoreness: meta.highSoreness, hold: meta.hold }) : null;
  const pb = ex && complete && !editing && !ex.swapped ? isPB(ex.exKind, ex.last, ex.sets) : false;

  // A new best gets a moment of its own: before -> after, a haptic, then it clears itself.
  const [pbCard, setPbCard] = useState<{ name: string; text: string } | null>(null);
  const pbSwipe = useSwipeUp(() => setPbCard(null));
  const shownPb = useRef<Set<string>>(new Set());
  const pbSlug = pb && ex ? ex.slug : null;
  useEffect(() => {
    if (!pbSlug || !ex || shownPb.current.has(pbSlug)) return;
    shownPb.current.add(pbSlug);
    const v = ex.sets[ex.sets.length - 1];
    const now = ex.exKind === "timed" ? `${v?.secs} s` : ex.exKind === "bodyweight" && !v?.kg ? `BW × ${v?.reps}` : `${fmtNum(v?.kg ?? 0)} kg × ${v?.reps}`;
    setPbCard({ name: dispName(ex), text: ex.last ? `${lastLabel(ex)}  →  ${now}` : now });
    haptic("success");
    const t = window.setTimeout(() => setPbCard(null), 2800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pbSlug]);

  // Swipe sideways on the card (not on a control) to go to the next or previous lift.
  const mainRef = useRef<HTMLElement>(null);
  const liveWs = useRef(ws);
  liveWs.current = ws;
  const localRef = useRef(local);
  localRef.current = local;
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    let sx = 0, sy = 0, ok = false;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
      ok = e.touches.length === 1 && !(e.target as Element).closest("input, textarea, select, button, a, [data-no-swipe]");
    };
    const end = (e: TouchEvent) => {
      if (!ok) return;
      ok = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      const w = liveWs.current;
      const lifts = w.steps.map((x, i) => (x.kind === "ex" ? i : -1)).filter((i) => i >= 0);
      const target = dx < 0 ? lifts.find((i) => i > w.cur) : [...lifts].reverse().find((i) => i < w.cur);
      if (target !== undefined) {
        haptic("tap");
        localRef.current(goTo(w, target));
      }
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchend", end);
    };
  }, []);

  const nextLabel = next ? (next.kind === "ex" ? dispName(next) : next.kind === "cardio" ? "Cardio" : next.kind === "cool" ? "Cool-down" : "Warm-up") : null;
  const nextSub = (n: Step): string =>
    n.kind === "ex"
      ? `${n.planned} × ${targetLabel(n)}${n.last && !n.swapped ? ` · Last ${lastLabel(n)}` : " · First time"}`
      : n.kind === "cardio" ? meta.cardioLabel : "2–3 min · optional";

  const restNext =
    ex && !complete
      ? `Then set ${ex.sets.length + 1} of ${ex.planned}`
      : next && nextLabel
        ? `Next: ${nextLabel}${next.kind === "ex" ? ` · ${next.planned} × ${targetLabel(next)}` : ""}`
        : "Then finish up";
  autoGo.current = () => {
    stopRest();
    run(advance(wsRef.current));
  };

  // ---- actions
  const onLog = () => {
    if (!ex) return;
    const n = ex.sets.length + 1;
    haptic("tap");
    run(logSet(ws, crypto.randomUUID()), { toast: `Nice work. Set ${n} logged.`, undoable: true });
    setJust(n - 1);
    window.setTimeout(() => setJust(-1), 700);
    startRest(restSecondsAfter(n), restAlertText({ name: dispName(ex), setsLogged: n, planned: ex.planned, kind: ex.exKind, kg: ex.kg, reps: ex.reps, secs: ex.secs, nextName: nextLabel }));
  };
  const onUpdate = () => {
    const i = ws.editIdx;
    run(updateSet(ws), { toast: `Set ${i + 1} updated.`, undoable: true });
  };
  const onDelete = () => run(deleteSet(ws), { toast: "Set deleted.", undoable: true });
  const onSkip = () => {
    const label = ex ? dispName(ex) : s.kind === "warm" ? "Warm-up" : s.kind === "cardio" ? "Cardio" : "Cool-down";
    run(skip(ws), { toast: `Skipped ${label}.`, undoable: true });
    stopRest();
  };
  const onFinish = async () => {
    setFinishing(true);
    enqueue([{ t: "finish", workoutId: id, endedAt: new Date().toISOString() }]);
    for (let i = 0; i < 20 && loadQueue().length > 0; i++) await new Promise((r) => setTimeout(r, 200));
    router.push(`/complete?w=${id}`);
  };

  // primary button
  let primaryLabel = "";
  let primaryAct: () => void = () => {};
  if (s.kind === "warm") { primaryLabel = "Warm-up done"; primaryAct = () => { local(advance(ws)); }; }
  else if (ex) {
    if (editing) { primaryLabel = `Update set ${ws.editIdx + 1}`; primaryAct = onUpdate; }
    else if (ex.sets.length < ex.planned) { primaryLabel = `Log set ${ex.sets.length + 1} · ${setText(ex, { kg: ex.kg, reps: ex.reps, secs: ex.secs })}`; primaryAct = onLog; }
    else { primaryLabel = nextLabel ? `Next: ${nextLabel}` : "Next"; primaryAct = () => { stopRest(); run(advance(ws)); }; }
  } else if (s.kind === "cardio") { primaryLabel = "Cardio done"; primaryAct = () => run(finishCardio(ws), { toast: "Cardio logged.", undoable: true }); }
  else { primaryLabel = "Finish session"; primaryAct = onFinish; }

  return (
    <div className="screen fill">
      <header className="head" style={{ paddingBottom: "var(--space-3)" }}>
        <div className="topbar" style={{ alignItems: "center" }}>
          <button type="button" className="icon-btn" aria-label="Pause or end workout" onClick={() => setLeaveOpen(true)}><Icon name="x" /></button>
          <div className="col" style={{ alignItems: "center" }}>
            <span className="t-eyebrow c-2" style={{ fontSize: ".75rem" }}>{meta.sessionName}</span>
            <span className={`timer ${level === "warn" ? "warn" : level === "over" ? "over" : ""}`} role="timer" aria-label="Elapsed time">{clock.label}</span>
          </div>
          <div className="col" style={{ width: 64, alignItems: "flex-end" }}>
            <span className="t-caption c-2">{s.kind === "ex" ? "Lift" : s.kind === "warm" ? "Start" : s.kind === "cardio" ? "Warm-up" : "Last bit"}</span>
            <span className="t-body bold tnum">
              {s.kind === "ex" ? `${exNo} of ${exs.length}` : s.kind === "warm" ? "Warm-up" : s.kind === "cardio" ? `Cardio ${cardioMin} min` : "Cool-down"}
            </span>
          </div>
        </div>
        <div className="segs" aria-hidden="true">
          {steps.map((x, i) => (
            <i key={i} className={x.status === "done" ? "done" : x.status === "skipped" ? "skip" : i === ws.cur ? "now" : ""} />
          ))}
        </div>

        {showAmber && (
          <div className="timer-note warn" role="status"><Icon name="clock" size={16} />40 min in. Aim to wrap up by 50:00.</div>
        )}
        {guard.show && (
          <div className="card card-warning anim-in" role="alert" style={{ gap: "var(--space-2)", padding: "var(--space-3)" }}>
            <span className="t-small row g2 start">
              <Icon name="triangle-alert" size={16} />
              <span>
                <b className="c-warning">You’re at {Math.floor(clock.elapsed / 60)} min.</b>{" "}
                {guard.roomLeft ? `Shorten cardio to ${guard.guardMinutes} min and you’ll finish by 50:00.` : "Not much time left. Do 3 easy minutes of cardio, then wrap up."}
              </span>
            </span>
            <div className="grid2">
              <button type="button" className="btn btn-warning" onClick={() => { run(goTo(setCardioMinutes(ws, guard.guardMinutes), cardioIdx)); setGuardOff(true); }}>
                Set cardio to {guard.guardMinutes} min
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setGuardOff(true)}>Keep {cardioMin} min</button>
            </div>
          </div>
        )}
        {level === "over" && (
          <div className="banner banner-danger anim-in" role="alert" style={{ alignItems: "center" }}>
            <Icon name="triangle-alert" size={16} />
            <span className="grow"><b>50 min.</b> Time to wrap up.</span>
            {todoLifts > 0 && s.kind !== "cool" ? (
              <button type="button" className="btn btn-danger" onClick={() => run(wrapUp(ws))}>Wrap up</button>
            ) : (
              <button type="button" className="btn btn-danger" onClick={onFinish}>Finish up</button>
            )}
          </div>
        )}

        {resting && rest && (
          <div className="col g2 anim-in">
            <div className="row g3">
              <div className={`rest-ring ${restLeft <= 5 ? "is-final" : ""}`} role="progressbar" aria-label="Rest remaining" aria-valuenow={restLeft} aria-valuemin={0} aria-valuemax={rest.total}>
                <svg viewBox="0 0 72 72" aria-hidden="true">
                  <circle className="rest-ring-track" cx="36" cy="36" r="31" />
                  <circle className="rest-ring-fill" cx="36" cy="36" r="31" style={{ strokeDashoffset: `${(1 - Math.min(1, restLeft / Math.max(1, rest.total))) * 194.8}` }} />
                </svg>
                <span className="num-m">{mmss(restLeft)}</span>
              </div>
              <div className="col grow g1">
                <span className="t-eyebrow c-accent">Rest</span>
                <strong className="t-body">{restNext}</strong>
                <span className="t-caption c-2" style={{ fontWeight: 600 }}>{notify ? "Alert when rest ends: on" : "Alert when rest ends: off"}</span>
              </div>
              <button type="button" className={`icon-btn ${notify ? "is-on" : ""}`} aria-pressed={notify} aria-label="Notify me when rest ends" onClick={toggleNotify}>
                <Icon name={notify ? "bell" : "bell-off"} />
              </button>
            </div>
            <div className="row g2">
              <button type="button" className="btn btn-secondary grow" onClick={() => nudgeRest(-15)}>−15 s</button>
              <button type="button" className="btn btn-secondary grow" onClick={() => nudgeRest(15)}>+15 s</button>
              <button type="button" className="btn btn-tertiary" onClick={stopRest}>Skip</button>
            </div>
            {notifyNote && <div className="banner banner-info" role="status"><Icon name="info" /><span>{notifyNote}</span></div>}
          </div>
        )}
        {autoAt !== null && next && nextLabel && (
          <div className="banner banner-info anim-in" role="status" style={{ alignItems: "center" }}>
            <Icon name="skip-forward" size={16} />
            <span className="grow"><b>Next up: {nextLabel}.</b> Moving on.</span>
            <button type="button" className="btn btn-secondary" onClick={() => { autoOff.current = ws.cur; setAutoAt(null); }}>Stay here</button>
          </div>
        )}
      </header>

      <main ref={mainRef} className="scroll under-bar" style={{ paddingTop: "var(--space-1)" }}>
        {!online && pending > 0 && (
          <div className="banner banner-warning" role="status">
            <Icon name="triangle-alert" />
            <span><b>Offline.</b> Your {pending} {pending === 1 ? "change is" : "changes are"} saved on this phone. We’ll sync when you’re back online.</span>
          </div>
        )}
        {signedOut && (
          <div className="banner banner-danger" role="alert">
            <Icon name="circle-alert" />
            <span><b>You’ve been signed out.</b> Your sets are safe on this phone. <Link className="link" href="/login">Log in</Link> to sync them.</span>
          </div>
        )}
        <div className="banner banner-warning"><Icon name="triangle-alert" /><span>Sharp or joint pain? Stop and tell someone.</span></div>

        {s.kind === "warm" && (
          <section className="card anim-in" style={{ padding: "var(--space-6)" }}>
            <span className="t-eyebrow c-accent">Step 1 · 7 min</span>
            <h1 className="t-title">Warm-up</h1>
            <ul className="list" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              <li className="list-row"><span>Easy bike or cross-trainer</span><strong>5 min</strong></li>
              <li className="list-row"><span>Arm circles, band pull-aparts</span><strong>2 min</strong></li>
              <li className="list-row c-2"><span>Then one light practice set of your first exercise.</span></li>
            </ul>
          </section>
        )}

        {ex && (
          <section className="card">
            <div className="row between start g3">
              <div className="col g2 grow">
                <h1 className="t-title">{dispName(ex)}</h1>
                <div className="row g2 wrap">
                  <span className="tag tag-accent">{ex.planned} {ex.planned === 1 ? "set" : "sets"} · {targetLabel(ex)}</span>
                  {ex.swapped && <span className="tag">Swapped from {ex.name}</span>}
                  {ex.light && !ex.swapped && <span className="tag tag-info">Light, 20% off</span>}
                </div>
              </div>
              <button type="button" className="icon-btn" aria-label={`Form guide for ${dispName(ex)}`} onClick={() => setGuideOpen(true)}><Icon name="info" /></button>
            </div>

            {ex.last && !ex.swapped && <p className="t-small c-2">Last time: <strong className="c-text">{lastLabel(ex)}</strong></p>}
            {(!complete || editing) && <SetTip key={`${ex.slug}-${ex.swapped}`} range={ex.range} kind={ex.exKind} planned={ex.planned} swapped={ex.swapped} first={!ex.last} />}

            <div className="grid2">
              {Array.from({ length: ex.planned }, (_, i) => {
                const v = ex.sets[i];
                const isCur = !v && i === ex.sets.length && !editing;
                const isEd = editing && ws.editIdx === i;
                const value = v ? setText(ex, v) : isCur ? "Now" : "";
                const cls = isEd ? "logged editing" : v ? "logged" : isCur ? "now" : "todo";
                return v ? (
                  <button key={i} type="button" className={`set ${cls}${just === i ? " anim-pop" : ""}`} aria-label={`Edit set ${i + 1}: ${value}`} onClick={() => local(startEdit(ws, i))}>
                    <span className="set-n">Set {i + 1}</span><span className="set-v">{value}</span>
                  </button>
                ) : (
                  <div key={i} className={`set ${cls}`}>
                    <span className="set-n">Set {i + 1}</span>
                    <span className="col" style={{ alignItems: "flex-end", gap: 0 }}>
                      <span className="set-v">{value}</span>
                      {ghostText(ex, i) && <span className="set-ghost">Last {ghostText(ex, i)}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            {editing && <p className="t-small c-accent bold anim-in">Editing set {ws.editIdx + 1}. Change the numbers, then update.</p>}

            {(!complete || editing) && (
              <div className="card card-raised" style={{ gap: "var(--space-2)", padding: "var(--space-3)" }}>
                {ex.exKind !== "timed" && (
                  <>
                    <div className="stepper">
                      <span className="t-caption c-2" style={{ width: 40 }}>KG</span>
                      <button type="button" className="step-btn" aria-label="Decrease weight" onClick={() => local(adjust(ws, "kg", -1))}><Icon name="minus" /></button>
                      <NumField label="Weight in kilograms" decimal hero onScrub={(d) => local(adjust(ws, "kg", d))} value={ex.kg} shown={ex.exKind === "bodyweight" && !ex.kg ? "BW" : fmtNum(ex.kg)} onCommit={(v) => local(setValue(ws, "kg", v))} />
                      <button type="button" className="step-btn" aria-label="Increase weight" onClick={() => local(adjust(ws, "kg", 1))}><Icon name="plus" /></button>
                    </div>
                    <hr className="divider" />
                    <div className="stepper">
                      <span className="t-caption c-2" style={{ width: 40 }}>REPS</span>
                      <button type="button" className="step-btn" aria-label="One fewer rep" onClick={() => local(adjust(ws, "reps", -1))}><Icon name="minus" /></button>
                      <NumField label="Reps" hero onScrub={(d) => local(adjust(ws, "reps", d))} value={ex.reps} onCommit={(v) => local(setValue(ws, "reps", v))} />
                      <button type="button" className="step-btn" aria-label="One more rep" onClick={() => local(adjust(ws, "reps", 1))}><Icon name="plus" /></button>
                    </div>
                  </>
                )}
                {ex.exKind === "timed" && (
                  <div className="stepper">
                    <span className="t-caption c-2" style={{ width: 40 }}>SEC</span>
                    <button type="button" className="step-btn" aria-label="Five seconds less" onClick={() => local(adjust(ws, "secs", -1))}><Icon name="minus" /></button>
                    <NumField label="Seconds" hero onScrub={(d) => local(adjust(ws, "secs", d))} value={ex.secs} onCommit={(v) => local(setValue(ws, "secs", v))} />
                    <button type="button" className="step-btn" aria-label="Five seconds more" onClick={() => local(adjust(ws, "secs", 1))}><Icon name="plus" /></button>
                  </div>
                )}
                {!editing && (ex.last || ex.exKind === "weight") && (
                  <div className="chip-row-tight">
                    {ex.last && <button type="button" className="chip" onClick={() => local(restoreLast(ws))}>Same as last time</button>}
                    {ex.exKind === "weight" && ex.increment > 0 && <button type="button" className="chip" onClick={() => local(addKg(ws, ex.increment))}>+{fmtNum(ex.increment)} kg</button>}
                  </div>
                )}
              </div>
            )}

            {editing && (
              <div className="grid2">
                <button type="button" className="btn btn-secondary" onClick={() => local(cancelEdit(ws))}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={onDelete}><Icon name="trash" />Delete set</button>
              </div>
            )}

            {verdictInfo && (
              <div className={`verdict ${verdictInfo.up ? "verdict-up" : ""} anim-pop`}>
                <span className={`round ${verdictInfo.up ? "round-accent" : ""}`}><Icon name={verdictInfo.up ? "arrow-up" : "equal"} /></span>
                <span className="col grow">
                  <span className="row g2 wrap">
                    <strong className="t-heading" style={{ fontSize: "1.0625rem" }}>{verdictInfo.title}</strong>
                    {pb && <span className="badge-pb"><Icon name="trophy" size={16} />PB</span>}
                  </span>
                  <span className="t-small c-2">{verdictInfo.sub}</span>
                </span>
              </div>
            )}

            {!complete && ex.stall && (
              <div className="banner banner-info" role="status">
                <Icon name="info" />
                <span><b>{ex.stall.title}.</b> {ex.stall.tip}</span>
              </div>
            )}

            <div className="grid2">
              <button type="button" className="btn btn-secondary" onClick={() => run(swap(ws), { toast: ex.swapped ? "Swap undone." : `Swapped to ${ex.backup}.`, undoable: true })}>
                <Icon name="repeat" />{ex.swapped ? "Undo swap" : "Swap"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={onSkip}><Icon name="skip-forward" />Skip</button>
            </div>
            {ex.swapped && <p className="t-small c-2">Machine busy? Backup: {ex.backup}. Tap Undo swap when the machine frees up.</p>}

            <div className="field">
              <label className="field-label" htmlFor="notes">Machine notes</label>
              <input
                className="input" id="notes" value={ex.notes} placeholder="Seat height, pad position…"
                onChange={(e) => local(setNotes(ws, e.target.value))}
                onBlur={() => enqueue([{ t: "notes", slug: ex.slug, notes: ex.notes.slice(0, 200) }])}
              />
            </div>
          </section>
        )}

        {s.kind === "cardio" && (
          <CardioCard
            cardio={ws.cardio}
            planLabel={meta.cardioLabel}
            planName={meta.cardioName}
            last={lastCardio}
            onMachine={(m: MachineId) => local(chooseMachine(ws, m))}
            onAdjust={(k, d) => local(adjustCardio(ws, k, d))}
            onSame={(p) => local(sameAsLast(ws, p))}
            onFeel={(f) => local(setFeel(ws, f))}
          />
        )}

        {s.kind === "cool" && (
          <section className="card anim-in" style={{ padding: "var(--space-6)" }}>
            <span className="t-eyebrow c-2">Optional · 2 to 3 min</span>
            <h1 className="t-title">Cool-down</h1>
            <p className="t-body c-2">Slow breaths and one easy stretch for the muscles you used most. 30 seconds each side.</p>
            <button type="button" className="btn btn-secondary btn-block" onClick={onFinish}>Skip cool-down</button>
          </section>
        )}

        {nextLabel && next && (
          <div className="card card-dashed" style={{ flexDirection: "row", alignItems: "center", gap: "var(--space-3)" }}>
            <span className="t-eyebrow c-2" style={{ flex: "none" }}>Up next</span>
            <span className="col grow"><strong>{nextLabel}</strong><span className="t-small c-2">{nextSub(next)}</span></span>
          </div>
        )}

        <section className="col g1" aria-label="Session checklist">
          <div className="row between" style={{ margin: "var(--space-2) var(--space-1)" }}>
            <h2 className="t-eyebrow c-2">Checklist</h2>
            <button type="button" className="link" aria-pressed={reorder} onClick={() => setReorder(!reorder)}>{reorder ? "Done" : "Reorder lifts"}</button>
          </div>
          {steps.map((x, i) => {
            const title = x.kind === "ex" ? dispName(x) : x.kind === "warm" ? "Warm-up" : x.kind === "cardio" ? "Cardio" : "Cool-down";
            const sub =
              x.kind === "ex"
                ? x.sets.length ? x.sets.map((v) => (x.exKind === "timed" ? `${v.secs} s` : `${x.exKind === "bodyweight" && !v.kg ? "BW" : fmtNum(v.kg ?? 0)}×${v.reps}`)).join(", ") : x.status === "skipped" ? "Skipped" : `${x.planned} × ${targetLabel(x)}`
                : x.status === "skipped" ? "Skipped" : x.kind === "warm" ? "7 min" : x.kind === "cardio" ? `${meta.cardioLabel}` : "2–3 min · optional";
            const dotCls = x.status === "done" ? "dot-done" : i === ws.cur ? "dot-today" : x.status === "skipped" ? "dot-rest" : "";
            const row = (
              <button type="button" className={`check-row ${i === ws.cur ? "cur" : ""}`} style={{ flex: 1, minWidth: 0 }} onClick={() => local(goTo(ws, i))}>
                <span className={`dot ${dotCls}`}>{x.status === "done" && <Icon name="check" size={16} />}{x.status === "skipped" && <Icon name="skip-forward" size={16} />}</span>
                <span className="col grow"><strong className={x.status === "done" || x.status === "skipped" ? "c-2" : ""}>{title}</strong><span className="t-small c-2">{sub}</span></span>
              </button>
            );
            const rowKey = x.kind === "ex" ? x.slug : x.kind;
            if (!reorder || x.kind !== "ex") return <div key={rowKey} className="row g2">{row}</div>;
            const dragging = drag?.slug === x.slug;
            return (
              <div
                key={rowKey}
                className={`row g2 ${dragging ? "is-dragging" : ""}`}
                style={dragging ? { transform: `translateY(${dragDy - drag!.emitted * drag!.h}px)`, position: "relative", zIndex: 5 } : undefined}
              >
                {row}
                <button
                  type="button"
                  className="icon-btn grip"
                  aria-label={`Drag ${title} to change its order`}
                  onPointerDown={(e) => {
                    const rowEl = e.currentTarget.parentElement as HTMLElement;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDrag({ slug: x.slug, startY: e.clientY, h: rowEl.offsetHeight + 4, emitted: 0 });
                    setDragDy(0);
                    haptic("tap");
                  }}
                  onPointerMove={(e) => {
                    if (!drag || drag.slug !== x.slug) return;
                    const dy = e.clientY - drag.startY;
                    setDragDy(dy);
                    const want = Math.round(dy / drag.h);
                    if (want === drag.emitted) return;
                    let w = liveWs.current;
                    let emitted = drag.emitted;
                    while (emitted !== want) {
                      const dir = want > emitted ? 1 : -1;
                      const at = w.steps.findIndex((t) => t.kind === "ex" && t.slug === x.slug);
                      const next = moveExercise(w, at, dir);
                      if (next === w) break; // a neighbour that is not a lift (cardio / cool-down)
                      w = next;
                      emitted += dir;
                      haptic("tap");
                    }
                    if (emitted !== drag.emitted) {
                      local(w);
                      setDrag({ ...drag, emitted });
                    }
                  }}
                  onPointerUp={() => {
                    setDrag(null);
                    setDragDy(0);
                  }}
                  onPointerCancel={() => {
                    setDrag(null);
                    setDragDy(0);
                  }}
                  style={{ touchAction: "none" }}
                >
                  <Icon name="grip-vertical" />
                </button>
              </div>
            );
          })}
          {ws.extras.length > 0 && (
            <>
              <h2 className="t-eyebrow c-2" style={{ margin: "var(--space-3) var(--space-1) var(--space-1)" }}>Also logged</h2>
              {ws.extras.map((x) => (
                <div key={x.slug} className="check-row">
                  <span className="dot dot-done"><Icon name="check" size={16} /></span>
                  <span className="col grow"><strong>{x.name}</strong><span className="t-small c-2">{x.sets.map((v) => (x.exKind === "timed" ? `${v.secs} s` : `${fmtNum(v.kg ?? 0)} kg × ${v.reps}`)).join(", ")}</span></span>
                </div>
              ))}
            </>
          )}
        </section>
      </main>

      {toastLive && (
        <div className="toast toast-top" role="status" style={toastSwipe.style} {...toastSwipe.handlers}>
          <div className="toast-body">
            <span className="row g2"><Icon name="circle-check" />{toastLive.text}</span>
            {toastLive.undo && (
              <button type="button" className="btn" aria-label="Undo last change" onClick={doUndo}><Icon name="undo" />Undo</button>
            )}
          </div>
          <span className="toast-time" style={{ transform: `scaleX(${Math.max(0, Math.min(100, Math.round((toastLive.until - nowMs) / 50))) / 100})` }} />
        </div>
      )}

      <footer className="bottom-bar">
        <button type="button" className={`btn btn-primary btn-cta ${finishing ? "is-loading" : ""}`} onClick={primaryAct} disabled={finishing}>{primaryLabel}</button>
      </footer>

      {pbCard && (
        <button type="button" className="pb-card toast-top-pos" style={pbSwipe.style} {...pbSwipe.handlers} onClick={() => setPbCard(null)} aria-live="polite">
          <span className="done-mini"><Icon name="trophy" /></span>
          <span className="col" style={{ alignItems: "flex-start", textAlign: "left", minWidth: 0 }}>
            <span className="t-eyebrow c-accent">New best · {pbCard.name}</span>
            <strong className="t-heading tnum">{pbCard.text}</strong>
          </span>
        </button>
      )}

      {leaveOpen && (
        <>
          <div className="scrim anim-fade" onClick={() => setLeaveOpen(false)} />
          <div className="sheet-wrap">
            <div className="sheet" role="dialog" aria-label="Pause or end workout">
              <span className="sheet-grab" />
              <h2 className="t-title">Workout in progress</h2>
              <p className="t-body c-2">{clock.label} in · {exs.reduce((n, e) => n + e.sets.length, 0)} sets logged. Your sets are saved either way.</p>
              <button type="button" className="btn btn-primary btn-block" onClick={() => setLeaveOpen(false)}>Resume workout</button>
              <button type="button" className={`btn btn-danger btn-block ${finishing ? "is-loading" : ""}`} disabled={finishing} onClick={onFinish}>End workout and check in</button>
              <Link className="btn btn-tertiary btn-block" href="/">Leave for now, resume later</Link>
            </div>
          </div>
        </>
      )}

      {guideOpen && ex && guides[ex.slug] && (() => {
        // After a swap the info button shows the exercise you are actually doing (its library guide if there is one).
        const base = guides[ex.slug];
        const sw = ex.swapped ? page.backupGuides?.[ex.slug] ?? null : null;
        if (!ex.swapped) return <GuideSheet guide={base} slug={ex.slug} onClose={() => setGuideOpen(false)} />;
        if (sw) return <GuideSheet guide={sw.guide} slug={sw.slug} onClose={() => setGuideOpen(false)} />;
        const plain: Guide = {
          name: ex.backup,
          group: base.group,
          muscles: base.muscles,
          setup: [`There is no saved guide for ${ex.backup} yet.`],
          cues: [`It stands in for ${ex.name}, so aim for the same muscles: ${base.muscles.join(", ")}.`],
          mistakes: ["Starting too heavy on a new movement. Go light and use the steppers."],
        };
        return <GuideSheet guide={plain} slug={ex.slug} bare onClose={() => setGuideOpen(false)} />;
      })()}
      <span className="sr" aria-live="polite">{online ? "" : "Offline"}</span>
    </div>
  );
}
