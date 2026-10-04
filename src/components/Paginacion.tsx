"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FiltroSelect, type FiltrosUrl } from "@/components/FiltrosUrl";
import { TAMANIO_POR_DEFECTO, TAMANIOS_PAGINA, textoRango, totalPaginas, urlConParams, ventanaPaginas } from "@/lib/paginacion";
import { cn } from "@/lib/utils";

const BASE =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg border px-2 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const ACTIVO = "border-primary bg-primary text-primary-foreground";
const NORMAL = "border-input bg-background text-foreground hover:bg-accent";
const DESHABILITADO = "cursor-not-allowed border-transparent text-muted-foreground";

const OPCIONES_TAMANIO = TAMANIOS_PAGINA.map((n) => ({ value: String(n), label: `${n} por página` }));

/**
 * Paginación de una lista servida por la URL. Son links de verdad (`?page=N`):
 * funcionan sin JavaScript, se abren en otra pestaña y el "atrás" vuelve a la
 * página anterior. Conserva todos los demás parámetros (búsqueda, filtros).
 *
 * `filtros` es el hook de la pantalla: así la navegación comparte su estado
 * "pendiente" y la pantalla puede mostrar que está recalculando.
 */
export function Paginacion({
  total,
  page,
  pageSize,
  filtros,
  className,
}: {
  total: number;
  page: number;
  pageSize: number;
  filtros: FiltrosUrl;
  className?: string;
}) {
  if (total <= 0) return null;

  const paginas = totalPaginas(total, pageSize);
  const actual = Math.min(page, paginas);
  const hrefDe = (n: number) => urlConParams(filtros.pathname, filtros.params, { page: String(n) });

  function alClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    // Clic común: navega en una transición (para mostrar "pendiente"). Con Ctrl/Cmd/Shift o botón del medio, que abra donde la persona quiere.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    filtros.ir(href);
  }

  const anterior = actual > 1 ? hrefDe(actual - 1) : null;
  const siguiente = actual < paginas ? hrefDe(actual + 1) : null;

  return (
    <div className={cn("flex flex-col items-center gap-3 sm:flex-row sm:justify-between", className)}>
      <p className="text-xs tabular-nums text-muted-foreground">
        {textoRango(actual, pageSize, total)}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {total > TAMANIOS_PAGINA[0] && (
          <FiltroSelect
            filtros={filtros}
            param="pageSize"
            etiqueta="Filas por página"
            porDefecto={String(TAMANIO_POR_DEFECTO)}
            opciones={OPCIONES_TAMANIO}
            className="sm:w-36"
            searchable={false}
          />
        )}

        {paginas > 1 && (
          <nav aria-label="Paginación">
            <ul className="flex flex-wrap items-center justify-center gap-1">
              <li>
                {anterior ? (
                  <Link href={anterior} prefetch={false} onClick={(e) => alClick(e, anterior)} rel="prev" aria-label="Página anterior" className={cn(BASE, NORMAL)}>
                    <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Link>
                ) : (
                  <span className={cn(BASE, DESHABILITADO)}>
                    <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                    <span className="hidden sm:inline" aria-hidden="true">Anterior</span>
                    <span className="sr-only">Página anterior (no disponible)</span>
                  </span>
                )}
              </li>

              {ventanaPaginas(actual, paginas).map((n, i) =>
                n === "…" ? (
                  <li key={`salto-${i}`} aria-hidden="true" className="px-1 text-sm text-muted-foreground">
                    …
                  </li>
                ) : (
                  <li key={n}>
                    {/* La actual también es un link (a sí misma): así el foco no se pierde al cambiar de página. */}
                    <Link
                      href={hrefDe(n)}
                      prefetch={false}
                      onClick={(e) => alClick(e, hrefDe(n))}
                      aria-label={`Página ${n}`}
                      aria-current={n === actual ? "page" : undefined}
                      className={cn(BASE, n === actual ? ACTIVO : NORMAL)}
                    >
                      {n}
                    </Link>
                  </li>
                ),
              )}

              <li>
                {siguiente ? (
                  <Link href={siguiente} prefetch={false} onClick={(e) => alClick(e, siguiente)} rel="next" aria-label="Página siguiente" className={cn(BASE, NORMAL)}>
                    <span className="hidden sm:inline">Siguiente</span>
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                ) : (
                  <span className={cn(BASE, DESHABILITADO)}>
                    <span className="hidden sm:inline" aria-hidden="true">Siguiente</span>
                    <span className="sr-only">Página siguiente (no disponible)</span>
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </span>
                )}
              </li>
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
