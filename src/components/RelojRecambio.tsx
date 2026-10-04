import { cn } from "@/lib/utils";

/**
 * El reloj del recambio: la vida util del equipo como una linea que va de la
 * entrega al vencimiento, con los ultimos 60 dias (la ventana de aviso)
 * marcados en ambar y un punto donde esta hoy. Es la idea del producto
 * dibujada con los datos de la fila.
 *
 * Usa `dias_restantes` de la vista y no `new Date()`: la cuenta la hace la
 * base, asi que servidor y cliente dibujan lo mismo (sin desfasaje de
 * hidratacion) y la barra nunca contradice a la pastilla "Vence en N d".
 * La usan /alertas y el parque instalado de la ficha de empresa.
 * Decorativa (`aria-hidden`): la linea de texto de arriba ya dice las fechas.
 * Ancho FIJO, no relativo al texto de la tarjeta: asi las barras de distintas
 * alertas se comparan entre si de un vistazo.
 */
export function RelojRecambio({
  entrega,
  vence,
  dias,
  vencida,
  className,
}: {
  entrega: string | null;
  vence: string | null;
  dias: number;
  vencida: boolean;
  className?: string;
}) {
  if (!entrega || !vence) return null;
  const total = (Date.parse(vence) - Date.parse(entrega)) / 86_400_000;
  if (!(total > 0)) return null;
  const hoy = Math.min(100, Math.max(0, ((total - dias) / total) * 100));
  const aviso = Math.min(100, (60 / total) * 100);

  return (
    <div aria-hidden="true" className={cn("mt-3 w-72 max-w-full sm:w-80", className)}>
      <div className="relative h-1.5 rounded-full bg-muted">
        <div className="absolute inset-y-0 right-0 rounded-r-full bg-amber-500/30" style={{ width: `${aviso}%` }} />
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", vencida ? "bg-destructive" : "bg-brand")}
          style={{ width: `${hoy}%` }}
        />
        <span
          className={cn(
            "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
            vencida ? "bg-destructive" : "bg-brand",
          )}
          style={{ left: `${hoy}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Entrega</span>
        <span>Recambio</span>
      </div>
    </div>
  );
}
