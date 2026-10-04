import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { TYPE, cn } from "./cx";

/**
 * Carga, avisos y vacíos (MASTER.md §10.9). Sin "use client": se usan desde server components y `loading.tsx`.
 */

/**
 * Bloque gris que ocupa el lugar del contenido mientras carga. Decorativo: quien lo usa marca `aria-busy` en la
 * región que se está cargando. Esqueletos, no spinners.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block h-3 rounded-(--crm-radius-sm) bg-(--crm-skeleton) animate-[crm-pulse_1.6s_ease-in-out_infinite] motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/**
 * Contrato de carga (MASTER.md §13.2): mientras algo carga hay un `role="status"` cuyo texto EMPIEZA con "Cargando"
 * ("Cargando…", "Cargando empresas…"), y se quita del DOM al terminar. Lo esperan `scripts/guard/baseline-crm.mjs` y
 * `scripts/manual/capturas.mjs` (`[role="status"]` /^Cargando/ hasta que desaparezca) y lo anuncia el lector de
 * pantalla. Va invisible junto a los esqueletos (que son `aria-hidden`).
 */
export function LoadingStatus({ label = "Cargando…" }: { label?: `Cargando${string}` }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}

export type BannerTone = "info" | "success" | "warning" | "danger";

const BANNER: Record<BannerTone, { icon: React.ElementType; clase: string }> = {
  info: { icon: Info, clase: "bg-(--crm-info-tint) [--tono:var(--crm-info)]" },
  success: { icon: CheckCircle2, clase: "bg-(--crm-success-tint) [--tono:var(--crm-success)]" },
  warning: { icon: AlertTriangle, clase: "bg-(--crm-warning-tint) [--tono:var(--crm-warning)]" },
  danger: { icon: AlertCircle, clase: "bg-(--crm-danger-tint) [--tono:var(--crm-danger)]" },
};

/**
 * Aviso en línea, pegado a lo que afecta (arriba de una tabla, de un formulario). Tinte al 8 %, ícono y título en el
 * color del tono, texto en el de texto. `danger` es `role="alert"` (se anuncia al aparecer); el resto `role="status"`.
 * Una sola acción (p. ej. "Reintentar").
 */
export function InlineBanner({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: BannerTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, clase } = BANNER[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-(--crm-radius) border border-[color:color-mix(in_srgb,var(--tono)_25%,transparent)] px-3 py-2",
        clase,
        className,
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0 text-(--tono)" />
      <div className="min-w-0 flex-1 text-[14px] leading-5">
        {title && <p className="font-medium text-(--tono)">{title}</p>}
        {children && <div className="text-(--crm-text)">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/**
 * Estado vacío: un título que dice qué pasa, una línea que dice qué hacer y UNA acción. Sin ilustraciones ni
 * escenas. `compact` es la variante dentro de una tabla o un panel.
 */
export function EmptyState({
  title,
  description,
  action,
  compact = false,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-1", compact ? "px-3 py-6" : "px-4 py-12 sm:items-center sm:text-center", className)}>
      <p className={cn(TYPE.ui, "font-medium text-(--crm-text)")}>{title}</p>
      {description && <p className={cn(TYPE.ui, "max-w-prose text-(--crm-text-2)")}>{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
