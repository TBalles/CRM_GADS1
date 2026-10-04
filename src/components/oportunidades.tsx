import { Gavel } from "lucide-react";
import { Pill } from "@/components/ui/UIComponents";
import { estadoOportunidadInfo } from "@/lib/oportunidades";
import { cn } from "@/lib/utils";

/**
 * Piezas de oportunidades que comparten el tablero, la lista, el detalle y las
 * fichas de cliente. Sin estado ni hooks: se renderizan igual del lado servidor
 * y del cliente.
 */

export const FALLBACK_COLOR = "#64748b";

/**
 * Pill de etapa. Los colores guardados en la base son tonos 400 claros, asi que
 * texto blanco sobre fondo solido da ~1.8:1: ilegible. Una superficie tintada
 * mas un punto saturado conserva la identidad de la etapa y se lee en los dos
 * temas (override #7 de design-overrides.md).
 */
export function EtapaBadge({
  nombre,
  color,
  className,
}: {
  nombre: string;
  color?: string | null;
  className?: string;
}) {
  const c = color ?? FALLBACK_COLOR;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        className,
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${c} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${c} 38%, transparent)`,
      }}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: c }} />
      {nombre}
    </span>
  );
}

/** El estado siempre lleva texto: el color solo no alcanza (daltonismo, impresion). */
export function EstadoOportunidadPill({ estado }: { estado: string }) {
  const e = estadoOportunidadInfo(estado);
  return <Pill tono={e.tono}>{e.label}</Pill>;
}

/**
 * Solo las licitaciones llevan insignia; "directa" es lo normal y no suma
 * ruido. La tabla de licitaciones llega en F4: por ahora es solo la marca.
 */
export function TipoOportunidadBadge({ tipo }: { tipo: string }) {
  if (tipo !== "licitacion") return null;
  return (
    <Pill tono="indigo">
      <Gavel aria-hidden="true" className="h-3 w-3 shrink-0" />
      Licitación
    </Pill>
  );
}
