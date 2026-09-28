import { cn } from "@/lib/utils";

/**
 * Canonical empty state (DESIGN.md §9.3), with one deviation: instead of a
 * generic icon in a circle it can draw a `escena` — pitch markings in the same
 * line language as the login panel and the GoalMark (design-overrides §13).
 * Three scenes, one per situation, so a first visit, a failed search and
 * "everything is fine" stop looking identical:
 *
 * - `cancha`  first time: the penalty area, marked and empty, ball on the spot.
 * - `afuera`  search with no match: the ball went wide of the goal.
 * - `al-dia`  nothing pending (alertas): the net is intact.
 *
 * Purely decorative: `aria-hidden`, no motion, the text carries the meaning.
 * `icon` stays for the few states that are not about the pitch (permissions).
 * `compact` is the inside-a-card / inside-a-table variant.
 */
export type Escena = "cancha" | "afuera" | "al-dia";

const TRAZO = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/**
 * Goal seen from the front, at real proportions (7.32 × 2.44 m, ~3:1). Drawn
 * square it reads as a window or a cage, not as a goal.
 */
function Arco({ red }: { red: string }) {
  return (
    <>
      {/* red: dibujada fina, como en el GoalMark */}
      <g strokeWidth="1" className={red}>
        <path d="M36 34v26M48 34v26M60 34v26M72 34v26M84 34v26" />
        <path d="M25 43h70M25 52h70" />
      </g>
      {/* línea de fondo y marco */}
      <path d="M4 60h112" strokeWidth="1.5" />
      <path d="M24 34h72M25 35v25M95 35v25" strokeWidth="2.5" />
    </>
  );
}

function EscenaSvg({ escena, className }: { escena: Escena; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 72"
      className={cn(
        "text-muted-foreground/50",
        // la cancha sigue más allá del recorte: se desvanece en vez de cortarse
        escena === "cancha" && "[mask-image:linear-gradient(to_bottom,black_60%,transparent)]",
        className,
      )}
      {...TRAZO}
    >
      {escena === "cancha" && (
        <g strokeWidth="1.5">
          {/* arco visto desde arriba, detrás de la línea de fondo */}
          <path d="M48 10V4h24v6" />
          <path d="M54 4v6M60 4v6M66 4v6" strokeWidth="1" opacity="0.6" />
          <path d="M4 10h112M4 10v62M116 10v62" />
          {/* área grande, área chica y la medialuna */}
          <path d="M24 10v34h72V10" />
          <path d="M44 10v12h32V10" />
          <path d="M47.5 44a16 16 0 0 0 25 0" />
          <circle cx="60" cy="34" r="4" className="fill-brand" stroke="none" />
        </g>
      )}
      {escena === "afuera" && (
        <>
          <Arco red="opacity-50" />
          <path d="M44 72Q94 26 103 50" strokeWidth="1.5" strokeDasharray="2 4" opacity="0.7" />
          <circle cx="106" cy="55" r="4.5" className="fill-brand" stroke="none" />
        </>
      )}
      {escena === "al-dia" && <Arco red="text-brand" />}
    </svg>
  );
}

export const EmptyState = ({
  icon: Icon,
  escena,
  text,
  hint,
  action,
  compact,
  className,
}: {
  icon?: React.ElementType;
  escena?: Escena;
  text: string;
  hint?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) => {
  if (compact) {
    return (
      <div className={cn("flex flex-col items-center py-12 text-center", className)}>
        {escena ? (
          <EscenaSvg escena={escena} className="mb-3 h-12 w-20" />
        ) : (
          Icon && <Icon aria-hidden="true" className="mb-3 h-10 w-10 stroke-1 text-muted-foreground/40" />
        )}
        <p className="text-sm font-medium text-foreground">{text}</p>
        {hint && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{hint}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/5 p-12",
        className,
      )}
    >
      {escena ? (
        <EscenaSvg escena={escena} className="mb-5 h-[5.25rem] w-[8.75rem]" />
      ) : (
        Icon && (
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Icon aria-hidden="true" className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )
      )}
      <p className="text-center font-display text-lg text-foreground">{text}</p>
      {hint && <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};
