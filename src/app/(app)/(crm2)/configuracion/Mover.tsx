"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { IconButton } from "@/components/crm/Button";
import { Tooltip } from "@/components/crm/Tooltip";

/**
 * Subir / bajar una fila (CRM 2.0). Sin arrastrar: dos botones se pueden usar con teclado, con lector de pantalla y con
 * el dedo. Cada uno dice a quién mueve ("Subir Referido", los nombres de siempre).
 *
 * Bloqueados con `aria-disabled` (no `disabled`): un botón que se deshabilita con el foco adentro lo tira al `body`, y
 * eso pasaba en CADA movimiento (mientras se guarda, los dos se bloquean; al llegar arriba, "Subir" también). Así el foco
 * se queda en el botón y se puede seguir moviendo con Enter. `data-mover` lo usa la lista para devolverle el foco si la
 * fila cambió de lugar en el DOM.
 */
export default function Mover({
  id,
  nombre,
  esPrimero,
  esUltimo,
  ocupado,
  onMover,
}: {
  id: string;
  nombre: string;
  esPrimero: boolean;
  esUltimo: boolean;
  /** Mientras se guarda un cambio de orden no se acepta otro. */
  ocupado: boolean;
  onMover: (direccion: -1 | 1) => void;
}) {
  const boton = (direccion: -1 | 1) => {
    const bloqueado = ocupado || (direccion === -1 ? esPrimero : esUltimo);
    const accion = direccion === -1 ? "Subir" : "Bajar";
    return (
      <Tooltip content={accion}>
        <IconButton
          size="sm"
          label={`${accion} ${nombre}`}
          icon={direccion === -1 ? ChevronUp : ChevronDown}
          data-mover={`${id}:${direccion}`}
          aria-disabled={bloqueado || undefined}
          onClick={() => {
            if (!bloqueado) onMover(direccion);
          }}
        />
      </Tooltip>
    );
  };
  return (
    <div className="flex items-center gap-0.5">
      {boton(-1)}
      {boton(1)}
    </div>
  );
}
