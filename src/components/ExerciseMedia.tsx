import { RENDERED } from "@/lib/rendered-exercises";

// The exercise shown as our own 3D render: a short looping animation of the movement with the working muscle lit
// (public/exercises/<slug>/loop.webp, made by scripts/exercise-renders). People who prefer reduced motion, and the small
// Library thumbnails, get the still poster instead.
// Lifts without a render yet fall back to two photos (start and finish) that swap back and forth:
// free-exercise-db (public domain), saved in /public/exercises/<slug>/0.jpg and 1.jpg.
export function ExerciseMedia({ slug, name, thumb = false }: { slug: string; name: string; thumb?: boolean }) {
  if (RENDERED.has(slug)) {
    return (
      <span className={`media media-render ${thumb ? "media-thumb" : ""}`} role="img" aria-label={`${name}: the movement, with the working muscle highlighted`}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/exercises/${slug}/poster.webp`} width={360} height={360} alt="" loading="lazy" decoding="async" draggable={false} />
        ) : (
          <picture>
            <source media="(prefers-reduced-motion: reduce)" srcSet={`/exercises/${slug}/poster.webp`} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/exercises/${slug}/loop.webp`} width={360} height={360} alt="" loading="lazy" decoding="async" draggable={false} />
          </picture>
        )}
      </span>
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
