import { Card, SectionTitle } from "@/components/ui/UIComponents";

/**
 * Piezas legacy de ficha (`Dato`, `Seccion`) que todavía usan el detalle de oportunidad y el presupuesto. Las fichas de
 * empresa y de contacto ya están en CRM 2.0 (`components/crm/cuenta/`). Sin estado ni hooks.
 */

/** Un dato de la ficha: etiqueta chica arriba, valor abajo. Sin valor muestra una raya legible por lector de pantalla. */
export function Dato({ label, children }: { label: string; children?: React.ReactNode }) {
  const vacio = children == null || children === "";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">
        {vacio ? (
          <>
            <span aria-hidden="true" className="text-muted-foreground">
              —
            </span>
            <span className="sr-only">Sin dato</span>
          </>
        ) : (
          children
        )}
      </dd>
    </div>
  );
}

/** Tarjeta de una seccion de la ficha: titulo con ícono, cantidad en mono y una accion opcional. */
export function Seccion({
  icon,
  titulo,
  cantidad,
  accion,
  children,
}: {
  icon: React.ElementType;
  titulo: string;
  cantidad?: number | string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <SectionTitle
        icon={icon}
        right={
          <div className="flex shrink-0 items-center gap-3">
            {cantidad != null && (
              <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                {cantidad}
              </span>
            )}
            {accion}
          </div>
        }
      >
        {titulo}
      </SectionTitle>
      {children}
    </Card>
  );
}
