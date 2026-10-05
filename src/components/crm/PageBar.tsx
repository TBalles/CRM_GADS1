import * as React from "react";
import { TYPE, cn } from "./cx";

/**
 * Barras de título de CRM 2.0 (MASTER.md §10.12 y "Empresas slice: compositions"). Sin "use client": las dibuja el
 * servidor o el cliente igual. Las migas las pone la topbar del shell: estas barras NO repiten breadcrumb ni eyebrow.
 */

/**
 * Barra de una pantalla de lista: 48 de alto, h1 20/600, contador secundario y las acciones a la derecha
 * (una sola primaria). Sin descripción ni bajada. Si el contador no entra al lado del título (celular, un contador
 * largo como el de Alertas), baja a un segundo renglón en vez de recortar el h1: la barra crece, nada se pierde.
 */
export function PageBar({
  title,
  count,
  actions,
  className,
}: {
  title: string;
  /** Lo que se cuenta, ya armado ("8 empresas · 10 contactos"). Sans con numerales tabulares, secundario. */
  count?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-12 shrink-0 items-center justify-between gap-4 py-1.5", className)}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
        <h1 className={cn(TYPE.title, "max-w-full truncate")}>{title}</h1>
        {/* Sans: es una frase ("8 empresas · 10 contactos"); el mono queda para cifras sueltas e identificadores. */}
        {count !== undefined && <p className={cn(TYPE.ui, "min-w-0 tabular-nums text-(--crm-text-2)")}>{count}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Encabezado de una ficha: franja de identidad (h1 con el nombre EXACTO de la entidad, una fila de metadatos discreta)
 * con UNA acción primaria y el `⋮` "Más acciones" a la derecha. Debajo va `Tabs` (`tabs`), pegadas a la franja.
 */
export function DetailHeader({
  title,
  meta,
  actions,
  tabs,
}: {
  title: string;
  /** Estado (StatusDot), tipo, responsable, identificadores: separados por la propia fila. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
}) {
  return (
    <header className="shrink-0 border-b border-(--crm-border) bg-(--crm-panel) px-4 xl:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pt-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className={cn(TYPE.title, "break-words")}>{title}</h1>
          {meta && (
            <div className={cn(TYPE.table, "flex flex-wrap items-center gap-x-4 gap-y-1 text-(--crm-text-2)")}>{meta}</div>
          )}
        </div>
        {/* `max-w-full` + `flex-wrap`: si las acciones no entran (celular, textos largos) bajan de renglón en vez de
            empujar la página de costado. Cuando entran, no cambia nada. */}
        {actions && <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="-mb-px mt-2">{tabs}</div>}
      {!tabs && <div className="h-3" />}
    </header>
  );
}

/** Título de una sección dentro de una tab o un panel: 14/600 + contador mono + acciones `sm` a la derecha. 40 de alto. */
export function SectionBar({
  title,
  count,
  actions,
  as: H = "h2",
  className,
}: {
  title: string;
  count?: React.ReactNode;
  actions?: React.ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex h-10 shrink-0 items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-baseline gap-2">
        <H className="truncate text-[14px] font-semibold leading-5">{title}</H>
        {count !== undefined && <span className={cn(TYPE.meta, TYPE.mono, "text-(--crm-text-2)")}>{count}</span>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
