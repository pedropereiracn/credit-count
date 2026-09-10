/**
 * The Credit Count mark: an inverted-U of coaster track, and a car that runs it.
 *
 * On hover the car climbs the left leg, rounds the top and drops down the right,
 * following the track with CSS offset-path and turning with the curve
 * (offset-rotate: auto), so it leans into the arc instead of sliding flat. It rests
 * still and honours reduced-motion. transform-box: fill-box is what makes offset-path
 * anchor to the car's own box inside an SVG rather than the whole viewBox.
 *
 * The track is currentColor, so the mark takes the colour of wherever it sits: brand
 * red in the header, muted grey in an empty state. The car is a real coaster car (a
 * side-on gondola with a hollow seat and two wheels), not a dot. The favicon size
 * uses the arc alone, since a car turns to mush at 16px.
 *
 * The style is scoped by a per-instance id so two marks on a page never drive each other.
 */
const TRACK = 'M28 84 L28 46 A22 22 0 0 1 72 46 L72 84'

export function CoasterMark({ className, animate = false }: { className?: string; animate?: boolean }) {
  const id = 'cc-mark'
  return (
    <svg viewBox="0 0 100 96" className={className} role="img" aria-label="Credit Count" fill="none">
      {animate && (
        <style>{`
          .${id}-car{transform-box:fill-box;transform-origin:center;
            offset-path:path('${TRACK}');offset-rotate:auto;offset-anchor:50% 100%;offset-distance:0%}
          .${id}:hover .${id}-car{animation:${id}-run 2.2s cubic-bezier(.5,.05,.5,.95) infinite}
          @keyframes ${id}-run{0%{offset-distance:0%}46%{offset-distance:50%}100%{offset-distance:100%}}
          @media (prefers-reduced-motion:reduce){.${id}:hover .${id}-car{animation:none}}
        `}</style>
      )}
      <g className={animate ? id : undefined}>
        <path d={TRACK} stroke="currentColor" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
        {animate && (
          <g className={`${id}-car`} fill="currentColor">
            {/* trapezoidal gondola, hollow seat cut with evenodd so any background shows through */}
            <path
              fillRule="evenodd"
              d="M-8 -11 L9 -11 L6.5 -2 Q6.3 -1 5.3 -1 L-5.3 -1 Q-6.3 -1 -6.5 -2 Z
                 M-5.2 -9 L6 -9 L4.5 -3 L-4 -3 Z"
            />
            <circle cx={-3.5} cy={1.4} r={2.3} />
            <circle cx={4.5} cy={1.4} r={2.3} />
          </g>
        )}
      </g>
    </svg>
  )
}
