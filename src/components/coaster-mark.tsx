/**
 * Placeholder wordmark: a track that climbs, throws a loop, and runs out.
 * Stroke based, so it scales to a favicon without turning to mush.
 *
 * TODO: replace with the finished mark. The traced SVG in the prototype folder
 * renders inverted (potrace kept the background rectangle as the first subpath and
 * evenodd flips it), and the brief for the real one is a heavier cart that runs the
 * loop on hover.
 */
export function CoasterMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 26" fill="none" className={className} aria-hidden="true">
      <path
        d="M1.5 23.5c4.5 0 5.5-8.5 9-15 1.6-3 4.2-3 5.6 0 1.3 2.8 2.2 6.4 3.1 9.2"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M19.2 17.7c1 2.9 2.4 5.8 5.3 5.8 3.4 0 4.6-3.2 3.2-5.2-1.3-1.9-4.2-1.6-4.9.9-.8 2.7 1.2 5.5 4.3 6.1"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M27.6 23.5h11" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}
