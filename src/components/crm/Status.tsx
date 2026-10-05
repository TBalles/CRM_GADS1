import * as React from "react";
import { initials } from "@/components/ui/UIComponents";
import { TYPE, cn } from "./cx";

/**
 * Estado, etiquetas y avatar (MASTER.md §10.5). Sin "use client": se usan desde server components.
 * El estado es SIEMPRE punto + palabra: el color nunca es la única señal.
 */

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const PUNTO: Record<Tone, string> = {
  neutral: "bg-(--crm-text-2)",
  accent: "bg-(--crm-accent)",
  success: "bg-(--crm-success)",
  warning: "bg-(--crm-warning)",
  danger: "bg-(--crm-danger)",
  info: "bg-(--crm-info)",
};

const TEXTO: Record<Tone, string> = {
  neutral: "text-(--crm-text-2)",
  accent: "text-(--crm-accent-text)",
  success: "text-(--crm-success)",
  warning: "text-(--crm-warning)",
  danger: "text-(--crm-danger)",
  info: "text-(--crm-info)",
};

const TINTE: Record<Tone, string> = {
  neutral: "bg-(--crm-panel-2)",
  accent: "bg-(--crm-selected)",
  success: "bg-(--crm-success-tint)",
  warning: "bg-(--crm-warning-tint)",
  danger: "bg-(--crm-danger-tint)",
  info: "bg-(--crm-info-tint)",
};

/**
 * Punto de 8 px + texto. Uso normal en tablas y fichas. `color` es el color configurado por la organización
 * (etapas): pisa al tono y se muestra como cuadradito, como hoy; el texto queda en el color de texto.
 */
export function StatusDot({
  tone = "neutral",
  color,
  wrap = false,
  children,
  className,
}: {
  tone?: Tone;
  color?: string | null;
  /** El texto baja de renglón en vez de recortarse (nombres de etapa en las tablas de los tableros, §10.21). */
  wrap?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 gap-1.5", wrap ? "items-start whitespace-normal" : "items-center", className)}>
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0", wrap && "mt-[5px]", color ? "rounded-[2px]" : cn("rounded-full", PUNTO[tone]))}
        style={color ? { backgroundColor: color } : undefined}
      />
      <span className={wrap ? "min-w-0 break-words" : "truncate"}>{children}</span>
    </span>
  );
}

/**
 * Badge con tinte al 8 % y texto sólido del tono (AA medido). Para lo que tiene que llamar la atención en una fila
 * densa (vencida, por vencer). Con `color` (etapa de la organización) el fondo es ese color al 12 % vía
 * `color-mix` y el texto queda en el de texto, porque el color lo elige la organización y no se puede garantizar AA.
 */
export function StatusBadge({
  tone = "neutral",
  color,
  children,
  className,
}: {
  tone?: Tone;
  color?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        TYPE.meta,
        "inline-flex h-5 max-w-full items-center gap-1.5 rounded-(--crm-radius-sm) px-1.5 font-medium",
        color ? "text-(--crm-text)" : cn(TINTE[tone], TEXTO[tone]),
        className,
      )}
      style={color ? { backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined}
    >
      {color && <span aria-hidden="true" className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Etiqueta neutra de borde (categoría, marca, origen). No lleva color. */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        TYPE.meta,
        "inline-flex h-5 max-w-full items-center rounded-(--crm-radius-sm) border border-(--crm-border) px-1.5 text-(--crm-text-2)",
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

const AVATAR = { xs: "size-5 text-[10px]", sm: "size-6 text-[11px]", md: "size-8 text-[12px]" } as const;

/**
 * Iniciales en un cuadrado de radio 4 con tinte neutro (no círculos de colores). Decorativo (`aria-hidden`): el
 * nombre siempre va escrito al lado.
 * Las iniciales de 10–11 px son la única excepción al mínimo de 12 px: no son texto a leer, el nombre está al lado.
 */
export function Avatar({ name, size = "sm", className }: { name: string; size?: keyof typeof AVATAR; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-(--crm-radius-sm) bg-(--crm-panel-2) font-medium uppercase tracking-[0.02em] text-(--crm-text-2) ring-1 ring-inset ring-(--crm-border)",
        AVATAR[size],
        className,
      )}
    >
      {/* Sin signos sueltos: "Demo · Administrador" → "DA" (no "D·"). */}
      {initials(name.replace(/[^\p{L}\p{N}\s]/gu, " "))}
    </span>
  );
}
