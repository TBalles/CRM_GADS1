"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { textoRango, totalPaginas, urlConParams, ventanaPaginas, type ParamsUrl } from "@/lib/paginacion";
import { FOCUS, TYPE, cn } from "./cx";

/**
 * Paginación de una lista servida por la URL (MASTER.md §10.10), mismo contrato que `Paginacion` legacy:
 * texto "Mostrando N–M de T" (raya en), `nav` "Paginación", links reales `?page=N` con `aria-label="Página N"`,
 * la actual con `aria-current="page"` (también link, para no perder el foco), "Página anterior/siguiente" y su
 * versión "(no disponible)". Conserva el resto de los parámetros.
 *
 * - `ir`: para navegar dentro de una transición (`filtros.ir` de FiltrosUrl) y mostrar "pendiente". Ctrl/Cmd/Shift
 *   o botón del medio abren donde la persona quiere.
 * - `pageSizeControl`: el select "Filas por página" de la pantalla (cuando el total lo amerita).
 */
export function Pagination({
  total,
  page,
  pageSize,
  pathname,
  params,
  ir,
  pageSizeControl,
  className,
}: {
  total: number;
  page: number;
  pageSize: number;
  pathname: string;
  params: ParamsUrl | URLSearchParams;
  ir?: (href: string) => void;
  pageSizeControl?: React.ReactNode;
  className?: string;
}) {
  if (total <= 0) return null;

  const paginas = totalPaginas(total, pageSize);
  const actual = Math.min(page, paginas);
  const hrefDe = (n: number) => urlConParams(pathname, params, { page: String(n) });
  const alClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!ir || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    ir(href);
  };
  const anterior = actual > 1 ? hrefDe(actual - 1) : null;
  const siguiente = actual < paginas ? hrefDe(actual + 1) : null;

  const base = cn(
    "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-(--crm-radius-sm) px-1.5 text-[13px] font-medium tabular-nums transition-colors duration-(--crm-dur-fast)",
    FOCUS,
  );
  const normal = "text-(--crm-text) hover:bg-(--crm-hover)";
  const activa = "bg-(--crm-selected) text-(--crm-accent-text) ring-1 ring-inset ring-(--crm-accent)";
  const apagada = "cursor-not-allowed text-(--crm-text-disabled)";

  return (
    <div className={cn("flex flex-col items-center gap-2 sm:flex-row sm:justify-between", className)}>
      <p className={cn(TYPE.meta, TYPE.mono, "text-(--crm-text-2)")}>{textoRango(actual, pageSize, total)}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {pageSizeControl}
        {paginas > 1 && (
          <nav aria-label="Paginación">
            <ul className="flex flex-wrap items-center gap-0.5">
              <li>
                {anterior ? (
                  <Link href={anterior} prefetch={false} rel="prev" aria-label="Página anterior" onClick={(e) => alClick(e, anterior)} className={cn(base, normal)}>
                    <ChevronLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Link>
                ) : (
                  <span className={cn(base, apagada)}>
                    <ChevronLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
                    <span className="hidden sm:inline" aria-hidden="true">
                      Anterior
                    </span>
                    <span className="sr-only">Página anterior (no disponible)</span>
                  </span>
                )}
              </li>
              {ventanaPaginas(actual, paginas).map((n, i) =>
                n === "…" ? (
                  <li key={`salto-${i}`} aria-hidden="true" className="px-1 text-[13px] text-(--crm-text-2)">
                    …
                  </li>
                ) : (
                  <li key={n}>
                    <Link
                      href={hrefDe(n)}
                      prefetch={false}
                      aria-label={`Página ${n}`}
                      aria-current={n === actual ? "page" : undefined}
                      onClick={(e) => alClick(e, hrefDe(n))}
                      className={cn(base, n === actual ? activa : normal)}
                    >
                      {n}
                    </Link>
                  </li>
                ),
              )}
              <li>
                {siguiente ? (
                  <Link href={siguiente} prefetch={false} rel="next" aria-label="Página siguiente" onClick={(e) => alClick(e, siguiente)} className={cn(base, normal)}>
                    <span className="hidden sm:inline">Siguiente</span>
                    <ChevronRight aria-hidden="true" strokeWidth={1.75} className="size-4" />
                  </Link>
                ) : (
                  <span className={cn(base, apagada)}>
                    <span className="hidden sm:inline" aria-hidden="true">
                      Siguiente
                    </span>
                    <span className="sr-only">Página siguiente (no disponible)</span>
                    <ChevronRight aria-hidden="true" strokeWidth={1.75} className="size-4" />
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
