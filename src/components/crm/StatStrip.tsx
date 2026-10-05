import * as React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { FOCUS, TYPE, cn } from "./cx";

export type Stat = {
  label: string;
  /** La cifra ya formateada, o un texto ("Todavía no compró"). Sin valor: "—". */
  value?: React.ReactNode;
  /** Unidad o símbolo en gris ("$", "d"). */
  unit?: string;
  unitPosition?: "before" | "after";
  /** Línea de apoyo debajo (12 secundario): "en 3 compras", "el 17/09/2026". */
  detail?: React.ReactNode;
  /** La cifra es texto y no número (va en sans, no en mono). */
  text?: boolean;
  /** Pide atención (ícono + color de aviso; nunca solo el color). */
  warning?: boolean;
  /**
   * La cifra lleva a la lista que la explica (tableros). El link es la cifra; su nombre accesible es "cifra + etiqueta"
   * ("11 Empresas"), el mismo que tenía la métrica del Inicio legacy.
   */
  href?: string;
};

/**
 * Franja de cifras (MASTER.md §10.12 y §10.13): 2–5 cifras en una fila con divisores verticales, sin cards ni caja.
 * Solo cifras que ya existen (las calcula quien llama). Sin "use client".
 *
 * - `md` (ficha): UNA fila fina desde `sm` (N columnas iguales), cifra de 20 en mono (sans si es texto); de a dos en
 *   mobile. La cifra de 28 (`TYPE.kpi`) queda para tableros, no para la franja de una ficha.
 * - `sm` (vista previa): grilla de 2, cifra de 16.
 * - `lg` (tableros: Inicio, Tablero comercial, Embudo): la misma fila que `md` con la cifra de 28 (`TYPE.kpi`), interletrado
 *   de −0,04em (la mono reserva un carácter entero para la coma y el espacio: sin esto "21,5 días" se desparrama) y las
 *   cifras alineadas aunque una etiqueta baje de renglón.
 */
export function StatStrip({
  items,
  size = "md",
  label,
  describedBy,
  className,
}: {
  items: Stat[];
  size?: "sm" | "md" | "lg";
  label?: string;
  /** Id de una nota que explica de dónde salen las cifras (p. ej. "sin estimaciones"), sin ocupar lugar en pantalla. */
  describedBy?: string;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <dl
      aria-label={label}
      aria-describedby={describedBy}
      style={{ "--n": items.length } as React.CSSProperties}
      className={cn(
        "grid",
        size !== "sm"
          ? // Una sola fila desde sm (N columnas iguales, divisores verticales); en mobile, de a dos.
            "grid-cols-2 gap-y-3 sm:grid-cols-[repeat(var(--n),minmax(0,1fr))] [&>div]:border-l [&>div]:border-(--crm-border) [&>div]:px-4 [&>div:first-child]:border-l-0 [&>div:first-child]:pl-0 max-sm:[&>div:nth-child(odd)]:border-l-0 max-sm:[&>div:nth-child(odd)]:pl-0"
          : "grid-cols-2 gap-x-4 gap-y-3",
        // lg: en la fila única, etiqueta | cifra | detalle son filas compartidas (subgrid): si una etiqueta baja a dos
        // renglones ("Quietas hace 14 días o más" a 1024), las cifras siguen en la misma línea de base.
        size === "lg" && "sm:grid-rows-[auto_auto_auto]",
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.label} className={cn("flex min-w-0 flex-col gap-0.5", size === "lg" && "sm:row-span-3 sm:grid sm:grid-rows-subgrid sm:gap-y-0.5")}>
          <dt className={cn(TYPE.meta, "text-(--crm-text-2)")}>{it.label}</dt>
          <dd
            className={cn(
              "flex min-w-0 items-baseline gap-1 font-medium",
              it.text
                ? "text-[14px] leading-6 tabular-nums"
                : cn(TYPE.mono, size === "lg" ? "text-[28px] leading-9 tracking-[-0.04em]" : size === "md" ? "text-[20px] leading-6" : "text-[16px] leading-6"),
              it.warning && "text-(--crm-warning)",
            )}
          >
            {it.warning && <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 self-center" />}
            {it.value === undefined || it.value === null || it.value === "" ? (
              <span className="text-(--crm-text-2)">—</span>
            ) : (
              <>
                {it.unit && it.unitPosition === "before" && <span className={cn(TYPE.unit, "text-[0.7em]")}>{it.unit}</span>}
                {it.href ? (
                  <Link
                    href={it.href}
                    className={cn("min-w-0 break-words rounded-[2px] underline decoration-(--crm-border-strong) underline-offset-4 hover:decoration-(--crm-text)", FOCUS)}
                  >
                    {it.value}
                    <span className="sr-only"> {it.label}</span>
                  </Link>
                ) : (
                  <span className="min-w-0 break-words">{it.value}</span>
                )}
                {it.unit && it.unitPosition !== "before" && <span className={cn(TYPE.unit, "text-[0.7em]")}>{it.unit}</span>}
              </>
            )}
          </dd>
          {it.detail && <dd className={cn(TYPE.meta, size === "lg" ? "break-words" : "truncate", "text-(--crm-text-2)")}>{it.detail}</dd>}
        </div>
      ))}
    </dl>
  );
}
