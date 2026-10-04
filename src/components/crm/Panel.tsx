import * as React from "react";
import { TYPE, cn } from "./cx";

/**
 * Panel y lista de definiciones (MASTER.md §10.6). Sin "use client": se usan desde server components.
 *
 * Panel = borde + header con línea, sin sombra. Solo donde agrupa de verdad: nunca un panel dentro de otro panel,
 * nunca un panel para envolver una sola tabla que ya tiene su propio borde.
 */
export function Panel({
  title,
  actions,
  children,
  flush = false,
  className,
  headingLevel = 2,
}: {
  title?: React.ReactNode;
  /** Acciones del header (botones `sm` o un `⋮`). */
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Sin padding interno: para tablas y listas que llegan al borde. */
  flush?: boolean;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={cn("min-w-0 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)", className)}>
      {(title || actions) && (
        <header className="flex h-10 items-center justify-between gap-3 border-b border-(--crm-border) px-3">
          {title && <H className="truncate text-[14px] font-semibold leading-5">{title}</H>}
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={flush ? undefined : "p-3"}>{children}</div>
    </section>
  );
}

export type Definition = {
  term: React.ReactNode;
  /** Vacío o null se muestra como "—" (nunca un hueco). */
  value: React.ReactNode;
  /** Cifras e identificadores (CUIT, teléfono, código): mono con numerales tabulares. */
  mono?: boolean;
};

/**
 * Datos de una ficha como `dl`: término arriba en 12 px secundario, valor en 14 px. Una o dos columnas
 * (dos desde 640 px de contenedor). Reemplaza a las cards de "Datos".
 */
export function DefinitionList({ items, columns = 2, className }: { items: Definition[]; columns?: 1 | 2; className?: string }) {
  return (
    // El contenedor (y no la pantalla) decide las columnas: la misma lista va en una ficha ancha o en un panel angosto.
    <div className={cn("@container", className)}>
      <dl className={cn("grid gap-x-6 gap-y-3", columns === 2 && "@[40rem]:grid-cols-2")}>
        {items.map((it, i) => (
          <div key={i} className="flex min-w-0 flex-col gap-0.5">
            <dt className={cn(TYPE.meta, "text-(--crm-text-2)")}>{it.term}</dt>
            <dd className={cn("min-w-0 break-words text-[14px] leading-5", it.mono && TYPE.mono)}>
              {it.value === null || it.value === undefined || it.value === "" ? (
                <span className="text-(--crm-text-2)">—</span>
              ) : (
                it.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
