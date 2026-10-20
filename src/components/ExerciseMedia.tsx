// Two photos of the exercise (start and finish position) that swap back and forth, so it reads as a little animation.
// Photos: free-exercise-db (public domain), saved in /public/exercises/<slug>/0.jpg and 1.jpg.
export function ExerciseMedia({ slug, name, thumb = false }: { slug: string; name: string; thumb?: boolean }) {
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
