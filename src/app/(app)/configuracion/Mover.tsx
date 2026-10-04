"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/components/ui/UIComponents";

const boton =
  "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

/**
 * Subir / bajar una fila. Sin arrastrar: dos botones se pueden usar con teclado,
 * con lector de pantalla y con el dedo. Cada uno dice a quién mueve.
 */
export default function Mover({
  nombre,
  esPrimero,
  esUltimo,
  ocupado,
  onMover,
  className,
}: {
  nombre: string;
  esPrimero: boolean;
  esUltimo: boolean;
  /** Mientras se guarda un cambio de orden no se acepta otro. */
  ocupado: boolean;
  onMover: (direccion: -1 | 1) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      <button
        type="button"
        aria-label={`Subir ${nombre}`}
        data-tooltip="Subir"
        disabled={esPrimero || ocupado}
        onClick={() => onMover(-1)}
        className={boton}
      >
        <ChevronUp aria-hidden="true" className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={`Bajar ${nombre}`}
        data-tooltip="Bajar"
        disabled={esUltimo || ocupado}
        onClick={() => onMover(1)}
        className={boton}
      >
        <ChevronDown aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
