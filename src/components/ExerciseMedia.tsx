"use client";

import { useEffect, useRef, useState } from "react";
import { RENDER_META } from "@/lib/rendered-exercises";
import { muscleLabel, tempoHint } from "@/lib/render-text";

// The exercise as our own 3D render: a looping clip of one rep (lift, squeeze, slow lower) with the working muscle lit
// (public/exercises/<slug>/loop.mp4 + poster.webp, made by scripts/exercise-renders). Tap the clip for the big viewer.
// Small Library thumbnails and people who prefer reduced motion get the still poster.
// Lifts without a render fall back to two photos (start and finish) that swap: free-exercise-db (public domain), /public/exercises/<slug>/0.jpg and 1.jpg.
export function ExerciseMedia({ slug, name, thumb = false }: { slug: string; name: string; thumb?: boolean }) {
  const meta = RENDER_META[slug];
  const [reduce, setReduce] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(q.matches);
    const on = () => setReduce(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  if (meta) {
    const poster = `/exercises/${slug}/poster.webp`;
    if (thumb || reduce) {
      return (
        <span className={`media media-render ${thumb ? "media-thumb" : ""}`} role="img" aria-label={`${name}: the working muscle highlighted`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} width={480} height={480} alt="" loading="lazy" decoding="async" draggable={false} />
        </span>
      );
    }
    return (
      <>
        <button type="button" className="media media-render media-play" aria-label={`${name}: play the movement larger`} onClick={() => setOpen(true)}>
          <video src={`/exercises/${slug}/loop.mp4`} poster={poster} muted loop autoPlay playsInline preload="metadata" disablePictureInPicture />
          <span className="media-hint">Tap to enlarge</span>
        </button>
        {open && <Viewer slug={slug} name={name} onClose={() => setOpen(false)} />}
      </>
    );
  }
  return (
    <span className={`media ${thumb ? "media-thumb" : ""}`} role="img" aria-label={`${name}: start and finish positions`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/exercises/${slug}/0.jpg`} width={600} height={400} alt="" loading="lazy" decoding="async" draggable={false} />
      {!thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/exercises/${slug}/1.jpg`} width={600} height={400} alt="" loading="lazy" decoding="async" draggable={false} />
      )}
    </span>
  );
}

function Viewer({ slug, name, onClose }: { slug: string; name: string; onClose: () => void }) {
  const meta = RENDER_META[slug];
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (v) v.playbackRate = slow ? 0.5 : 1;
  }, [slow]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
    setPlaying(!v.paused);
  };
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet-wrap">
        <div className="sheet" role="dialog" aria-label={`${name} movement`}>
          <span className="sheet-grab" />
          <h2 className="t-title">{name}</h2>
          <video ref={ref} className="viewer-video" src={`/exercises/${slug}/loop.mp4`} poster={`/exercises/${slug}/poster.webp`} muted loop autoPlay playsInline disablePictureInPicture />
          <div className="row g2 wrap">
            <span className="tag tag-accent">{muscleLabel(meta.main)}</span>
            {meta.helpers.length > 0 && <span className="tag">Also: {muscleLabel(meta.helpers)}</span>}
          </div>
          <p className="t-small c-2">{tempoHint(meta.tempo)}</p>
          <div className="row g2">
            <button type="button" className="btn btn-secondary grow" aria-pressed={!playing} onClick={toggle}>{playing ? "Pause" : "Play"}</button>
            <button type="button" className="btn btn-secondary grow" aria-pressed={slow} onClick={() => setSlow((s) => !s)}>{slow ? "Half speed: on" : "Half speed"}</button>
          </div>
          <button type="button" className="btn btn-tertiary btn-block" onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}
