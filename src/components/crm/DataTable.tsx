import * as React from "react";
import Link from "next/link";
import { anchoBarra } from "./barra";
import { FilaCompleta } from "./FilaCompleta";
import { LoadingStatus, Skeleton } from "./Feedback";
import { Avatar, StatusDot, type Tone } from "./Status";
import { Tooltip } from "./Tooltip";
import { FOCUS, TYPE, cn } from "./cx";

/**
 * Data grid de CRM 2.0 (MASTER.md §10.10). Sin "use client": piezas componibles que se usan desde la lista
 * (server o client). No ordena, no elige columnas, no cambia densidad: no son capacidades del producto.
 *
 * - `table-fixed`: las columnas con `width` lo respetan y el resto reparte; nada empuja el ancho. Cada celda es una
 *   línea (recorta con …); el texto largo va en `CellText`, que muestra el completo en un tooltip.
 * - Filas de 36 px, sin cebra, hover tonal, separador hairline. Header fijo en la misma superficie que las filas, 12/500
 *   secundario en sentence case, separado por una regla de 1 px fuerte (`--crm-border-strong`): la línea de un libro mayor.
 * - El contenedor scrollea en los dos ejes: para que el header quede fijo, quien lo usa le da alto (`max-h-…` o
 *   `flex-1 min-h-0` dentro de una columna flex). Es `@container`: las columnas se esconden por ancho del
 *   contenedor (`hideBelow`), no de la pantalla (con el panel de vista previa abierto la grilla es más angosta).
 * - `busy`: `aria-busy` mientras se recalcula (transición de filtros/página).
 * - Fila seleccionada (master-detail): `selected` -> barra de 2 px en acento + tinte, y `aria-current="true"`.
 */
export function DataTable({
  label,
  busy = false,
  className,
  children,
}: {
  /** Nombre accesible de la tabla ("Empresas"). */
  label: string;
  busy?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("@container relative min-h-0 overflow-auto rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)", className)}>
      <table aria-label={label} aria-busy={busy || undefined} className={cn(TYPE.table, "w-full table-fixed border-separate border-spacing-0 text-left")}>
        {children}
      </table>
    </div>
  );
}

const ESCONDER = {
  sm: "hidden @[30rem]:table-cell",
  md: "hidden @[45rem]:table-cell",
  lg: "hidden @[60rem]:table-cell",
} as const;
export type HideBelow = keyof typeof ESCONDER;

type Align = "left" | "right" | "center";
const ALINEAR: Record<Align, string> = { left: "text-left", right: "text-right", center: "text-center" };

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-(--crm-z-sticky)">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({
  children,
  align = "left",
  width,
  hideBelow,
  className,
}: {
  children?: React.ReactNode;
  align?: Align;
  /** Ancho fijo en px (columnas de estado, cifras, acciones). El resto reparte. */
  width?: number;
  hideBelow?: HideBelow;
  className?: string;
}) {
  return (
    <th
      scope="col"
      style={width ? { width } : undefined}
      className={cn(
        TYPE.th,
        "h-8 whitespace-nowrap border-b border-(--crm-border-strong) bg-(--crm-panel) px-3 align-middle",
        ALINEAR[align],
        hideBelow && ESCONDER[hideBelow],
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="[&>tr:last-child>td]:border-b-0">{children}</tbody>;
}

/**
 * Fila de totales (tableros, §10.21): la regla fuerte arriba, como el cierre de una columna en un libro mayor. Solo
 * totales que ya existen en la pantalla (no se inventan sumas). Las celdas son `Td` comunes.
 */
export function TFoot({ children }: { children: React.ReactNode }) {
  return (
    <tfoot className="font-medium [&>tr>td]:border-b-0 [&>tr>td]:border-t [&>tr>td]:border-t-(--crm-border-strong)">
      <tr className="h-9">{children}</tr>
    </tfoot>
  );
}

export function Tr({
  selected = false,
  className,
  children,
  ...props
}: React.ComponentProps<"tr"> & {
  selected?: boolean;
}) {
  return (
    <tr
      {...props}
      aria-current={selected || undefined}
      data-selected={selected || undefined}
      className={cn(
        "group/row h-9 transition-colors duration-(--crm-dur-fast)",
        "hover:bg-(--crm-hover) data-selected:bg-(--crm-selected)",
        // La barra va en la primera celda: un box-shadow en <tr> no se pinta igual en todos los navegadores.
        "data-selected:[&>td:first-child]:shadow-[inset_2px_0_0_var(--crm-accent)]",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  align = "left",
  hideBelow,
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  align?: Align;
  hideBelow?: HideBelow;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn("overflow-hidden text-ellipsis whitespace-nowrap border-b border-(--crm-border) px-3 align-middle", ALINEAR[align], hideBelow && ESCONDER[hideBelow], className)}
    >
      {children}
    </td>
  );
}

/* ---------------------------------------------------------------------------
   Celdas por tipo
   ------------------------------------------------------------------------ */

/**
 * Texto de una línea, truncado con tooltip (solo si de verdad se recortó). Con `href` es el link a la ficha
 * (nombre de la entidad, peso 500). `secondary` va después, en gris, y se recorta primero.
 */
export function CellText({ children, href, secondary }: { children: string; href?: string; secondary?: string }) {
  const principal = href ? (
    <Link href={href} className={cn("block min-w-0 truncate rounded-[2px] font-medium text-(--crm-text) hover:underline", FOCUS)}>
      {children}
    </Link>
  ) : (
    <span className="block min-w-0 truncate">{children}</span>
  );
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <Tooltip content={children} onlyWhenTruncated>
        {principal}
      </Tooltip>
      {secondary && (
        <span className="min-w-0 shrink-[2] truncate text-(--crm-text-2)">{secondary}</span>
      )}
    </div>
  );
}

/**
 * Cifra ya formateada (formatMoney sin el "$", cantidades): mono, numerales tabulares. Va en un `Td align="right"`.
 * `unit` ("$", "u.", "%", "d") se muestra en gris: la cifra es lo que se lee y las columnas alinean por el número.
 * `unitPosition`: "before" para moneda ("$ 12.480"), "after" para el resto ("12 u.").
 */
export function CellNumber({
  children,
  unit,
  unitPosition = "after",
}: {
  children: React.ReactNode;
  unit?: string;
  unitPosition?: "before" | "after";
}) {
  const u = unit && <span className={TYPE.unit}>{unit}</span>;
  return (
    <span className={cn(TYPE.mono, "whitespace-nowrap")}>
      {unitPosition === "before" && u}
      {unitPosition === "before" && u && " "}
      {children}
      {unitPosition === "after" && u && " "}
      {unitPosition === "after" && u}
    </span>
  );
}

/**
 * Barra de dato (tableros, §10.21): largo proporcional a `max` (`anchoBarra`), un solo tono, sin gradiente. Repite un
 * número que está escrito en la misma fila: es decorativa (`aria-hidden`), nunca la única forma de leer el dato.
 * Alineada a la izquierda sobre un eje hairline; `center` la centra sin eje (la forma de embudo de la conversión).
 */
export function CellBar({ value, max, center = false }: { value: number; max: number; center?: boolean }) {
  return (
    <span aria-hidden="true" className={cn("flex h-4 w-full items-center", !center && "border-l border-(--crm-border-strong)")}>
      <span
        className={cn("block h-2 bg-(--crm-accent)", center ? "mx-auto rounded-[2px]" : "rounded-r-[2px]")}
        style={{ width: `${anchoBarra(value, max)}%` }}
      />
    </span>
  );
}

/** Estado: punto + palabra. */
export function CellStatus({ tone, color, children }: { tone?: Tone; color?: string | null; children: React.ReactNode }) {
  return <StatusDot tone={tone} color={color}>{children}</StatusDot>;
}

/** Persona (responsable): iniciales + nombre. Sin persona: "—". */
export function CellPerson({ name }: { name?: string | null }) {
  if (!name) return <span className="text-(--crm-text-2)">—</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={name} size="xs" />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Fecha ya formateada (formatFecha: dd/mm/aaaa) con su valor máquina en `dateTime`. */
export function CellDate({ dateTime, children }: { dateTime: string; children: React.ReactNode }) {
  return (
    <time dateTime={dateTime} className={cn(TYPE.mono, "whitespace-nowrap text-(--crm-text-2)")}>
      {children}
    </time>
  );
}

/**
 * Acciones de fila: las rápidas (`children`, IconButtons `sm`) aparecen con hover o foco dentro de la fila; el `⋮`
 * (`menu`) está siempre visible. En pantallas táctiles (sin hover) todo se ve siempre.
 */
export function CellActions({ children, menu }: { children?: React.ReactNode; menu?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {children && (
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-(--crm-dur-fast) group-hover/row:opacity-100 group-focus-within/row:opacity-100 [@media(hover:none)]:opacity-100">
          {children}
        </div>
      )}
      {menu}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Estados de la grilla
   ------------------------------------------------------------------------ */

/**
 * Filas de esqueleto mientras carga (`loading.tsx` o primera carga). Anchos variados para que no parezca una tabla
 * vacía. Lleva el `LoadingStatus` del contrato de carga ("Cargando…" o el texto de `label`); la tabla, `busy`.
 */
export function TableSkeleton({ rows = 8, columns, label }: { rows?: number; columns: number; label?: `Cargando${string}` }) {
  const anchos = ["w-3/4", "w-1/2", "w-2/3", "w-1/3"];
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="h-9">
          {Array.from({ length: columns }, (_, c) => (
            <td key={c} className="border-b border-(--crm-border) px-3">
              {r === 0 && c === 0 && <LoadingStatus label={label} />}
              <Skeleton className={anchos[(r + c) % anchos.length]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * Una fila que ocupa todo el ancho: vacío (EmptyState compact) o error (InlineBanner con "Reintentar"). `colSpan` es el
 * total de columnas; en el navegador se ajusta a las visibles (`FilaCompleta`, la única pieza de cliente de la grilla).
 */
export function TableMessage({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <FilaCompleta colSpan={colSpan} className="p-0">
      {children}
    </FilaCompleta>
  );
}
