/**
 * App isotype: a goal (crossbar + posts) with its net suggested as a grid —
 * a football pitch and a data grid at once — and the ball in the goalmouth.
 *
 * Drawn in `currentColor` so it inherits whatever it sits on (the brand tile
 * in the sidebar, white on the login panel). The standalone favicon version
 * with the brand tile baked in lives in `src/app/icon.svg`, and the landing's
 * particle hero rasterizes a copy split into frame / ball / net
 * (`src/components/landing/ParticleField.tsx`). Keep all three in sync if this
 * mark changes.
 */
export function GoalMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      {/* net — thin, so it reads as texture at large sizes and fades out at 16px */}
      <g strokeWidth="1" opacity="0.45">
        <path d="M11.5 8.5v15M16 8.5v15M20.5 8.5v15" />
        <path d="M6 13.5h20M6 18.5h20" />
      </g>
      {/* goal frame */}
      <g strokeWidth="3" strokeLinecap="round">
        <path d="M6 8.5h20" />
        <path d="M6.5 9.5v14M25.5 9.5v14" />
      </g>
      {/* ball in the goalmouth */}
      <circle cx="16" cy="19.5" r="4.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
