import { cn } from "@/lib/utils";

/**
 * The markings of a full football pitch, drawn in `currentColor`. It sits on a
 * `.cesped` surface (globals.css) at a few percent of white, so it reads as
 * the ground under the content, never as a picture on top of it.
 *
 * `vertical` for tall panels (login, sidebar), `horizontal` for wide ones
 * (the dashboard and alerts scoreboards). Decorative: always `aria-hidden`.
 */
export function MarcasCancha({
  orientacion = "vertical",
  className,
}: {
  orientacion?: "vertical" | "horizontal";
  className?: string;
}) {
  const vertical = orientacion === "vertical";
  return (
    <svg
      aria-hidden="true"
      viewBox={vertical ? "0 0 400 600" : "0 0 600 400"}
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      {vertical ? (
        <>
          <rect x="24" y="24" width="352" height="552" />
          <line x1="24" y1="300" x2="376" y2="300" />
          <circle cx="200" cy="300" r="62" />
          <circle cx="200" cy="300" r="3" fill="currentColor" />
          <rect x="94" y="24" width="212" height="96" />
          <rect x="146" y="24" width="108" height="42" />
          <rect x="94" y="480" width="212" height="96" />
          <rect x="146" y="534" width="108" height="42" />
          <path d="M150 120a52 52 0 0 0 100 0" />
          <path d="M150 480a52 52 0 0 1 100 0" />
        </>
      ) : (
        <>
          <rect x="24" y="24" width="552" height="352" />
          <line x1="300" y1="24" x2="300" y2="376" />
          <circle cx="300" cy="200" r="62" />
          <circle cx="300" cy="200" r="3" fill="currentColor" />
          <rect x="24" y="94" width="96" height="212" />
          <rect x="24" y="146" width="42" height="108" />
          <rect x="480" y="94" width="96" height="212" />
          <rect x="534" y="146" width="42" height="108" />
          <path d="M120 150a52 52 0 0 1 0 100" />
          <path d="M480 150a52 52 0 0 0 0 100" />
        </>
      )}
    </svg>
  );
}
