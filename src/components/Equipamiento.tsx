import { Package, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { tipoEquipo, type Equipo } from "@/lib/equipo";

/**
 * The trade's own iconography: the equipment itself, drawn in the same line as
 * the GoalMark and at lucide's metrics (24 grid, stroke 2, round caps), so it
 * sits next to lucide icons without looking borrowed. It replaces the generic
 * `Package` box wherever a product shows up (catalogue, sales, alerts).
 *
 * Always decorative: the product name is printed next to it.
 */
type Icono = (props: { className?: string }) => React.ReactElement;

function Svg({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4", className)}
    >
      {children}
    </svg>
  );
}

/** Goal, front view, with its net. */
export const IconoArco: Icono = ({ className }) => (
  <Svg className={className}>
    <path d="M2 19h20M4 19V7h16v12" />
    <path d="M9.3 7v12M14.7 7v12M4 13h16" strokeWidth="1.25" opacity="0.6" />
  </Svg>
);

/** Net mesh, diamond pattern. */
export const IconoRed: Icono = ({ className }) => (
  <Svg className={className}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <path d="M4 12l8-8M4 20L20 4M12 20l8-8M4 4l16 16M4 12l8 8M12 4l8 8" strokeWidth="1.25" />
  </Svg>
);

/** Classic football: a pentagon and its seams. */
export const IconoPelota: Icono = ({ className }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8.8l3 2.2-1.1 3.6h-3.8L9 11z" fill="currentColor" strokeWidth="1" />
    <path d="M12 8.8V3M15 11l5.6-1.8M13.9 14.6l3.4 4.7M10.1 14.6l-3.4 4.7M9 11L3.4 9.2" strokeWidth="1.25" />
  </Svg>
);

/** Training cone with its stripe. */
export const IconoCono: Icono = ({ className }) => (
  <Svg className={className}>
    <path d="M10 4h4l4.5 15h-13z" />
    <path d="M3 20h18M8.3 12h7.4" />
  </Svg>
);

/** Training bib. */
export const IconoPechera: Icono = ({ className }) => (
  <Svg className={className}>
    <path d="M8 3 4 5.5l1.5 4L8 8.8V21h8V8.8l2.5.7 1.5-4L16 3c-.6 1.6-2 2.5-4 2.5S8.6 4.6 8 3z" />
  </Svg>
);

/** Corner flag, with the quarter-circle of the corner. */
export const IconoBanderin: Icono = ({ className }) => (
  <Svg className={className}>
    <path d="M6 21V3l12 3.5L6 10" />
    <path d="M11 21a5 5 0 0 0-5-5" strokeWidth="1.25" />
  </Svg>
);

/** Agility ladder. */
export const IconoEscalera: Icono = ({ className }) => (
  <Svg className={className}>
    <path d="M7 3v18M17 3v18M7 7.5h10M7 12h10M7 16.5h10" />
  </Svg>
);

/** Training hurdle. */
export const IconoValla: Icono = ({ className }) => (
  <Svg className={className}>
    <path d="M5 20V9M19 20V9M5 10h14M5 13.5h14M3 20h4M17 20h4" />
  </Svg>
);

const ICONOS: Record<Equipo, React.ElementType> = {
  arco: IconoArco,
  red: IconoRed,
  pelota: IconoPelota,
  cono: IconoCono,
  pechera: IconoPechera,
  banderin: IconoBanderin,
  escalera: IconoEscalera,
  valla: IconoValla,
  mantenimiento: Wrench,
  otro: Package,
};

/**
 * The equipment tile: the product's icon in a brand-tinted square. What kind of
 * equipment it is comes from `tipoEquipo` (src/lib/equipo.ts): name first,
 * then category, then a generic box.
 */
export function IconoEquipo({
  nombre,
  categoria,
  tono = "brand",
  className,
}: {
  nombre?: string | null;
  categoria?: string | null;
  tono?: "brand" | "rojo";
  className?: string;
}) {
  const Icono = ICONOS[tipoEquipo(nombre, categoria)];
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
        tono === "rojo" ? "bg-destructive/10 text-destructive" : "bg-brand/10 text-brand",
        className,
      )}
    >
      <Icono aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" />
    </span>
  );
}

/** Solo el ícono del equipo, sin caja de color (CRM 2.0: los íconos de equipamiento son contenido de dominio, MASTER.md §8). */
export function IconoEquipoSimple({ nombre, categoria, className }: { nombre?: string | null; categoria?: string | null; className?: string }) {
  const Icono = ICONOS[tipoEquipo(nombre, categoria)];
  return (
    <span aria-hidden="true" className="inline-flex shrink-0">
      <Icono className={className} />
    </span>
  );
}
