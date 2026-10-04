"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { CrmPortal } from "./portal";
import { IconButton } from "./Button";
import { FOCUS, UI_ROOT, cn } from "./cx";

export type ToastType = "success" | "error" | "warning" | "info";
export type ToastAccion = { label: string; href: string };
type ToastItem = { id: number; message: string; type: ToastType; duration: number; accion?: ToastAccion };

type Ctx = { showToast: (message: string, type?: ToastType, duration?: number, accion?: ToastAccion) => void };
const ToastContext = React.createContext<Ctx | null>(null);

/** Misma firma que `useToast` legacy: migrar una pantalla es cambiar el import. */
export function useCrmToast(): Ctx {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useCrmToast tiene que usarse dentro de <CrmToastProvider>");
  return ctx;
}

const ICONO: Record<ToastType, { icon: React.ElementType; color: string }> = {
  success: { icon: CheckCircle2, color: "text-(--crm-success)" },
  error: { icon: AlertCircle, color: "text-(--crm-danger)" },
  warning: { icon: AlertTriangle, color: "text-(--crm-warning)" },
  info: { icon: Info, color: "text-(--crm-info)" },
};

let siguienteId = 1;

/**
 * Avisos de CRM 2.0 (MASTER.md §10.8). Abajo a la derecha (no tapan la topbar ni las acciones del header), en
 * `#crm-portal`. Superficie de panel con borde y la sombra flotante; el tono lo da el ícono y la palabra, no el fondo.
 *
 * - Dos regiones vivas SIEMPRE montadas (desde la hidratación, vacías): `role="status"` + `aria-live="polite"` para
 *   éxito/info/atención y `role="alert"` + `aria-live="assertive"` para errores. Un aviso se INSERTA en una región que
 *   ya existe (así lo anuncian los lectores; una región que nace con el texto adentro a veces no se anuncia). Los avisos
 *   no llevan rol propio. E2E sigue encontrándolos con `getByRole("status").filter({ hasText })`.
 * - Se cierran solos (4 s); con el mouse encima o el foco adentro no. "Cerrar notificación" siempre.
 * - Lo monta el shell (Etapa 2). Mientras tanto solo lo monta el laboratorio.
 */
export function CrmToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const quitar = React.useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const showToast = React.useCallback<Ctx["showToast"]>((message, type = "info", duration = 4000, accion) => {
    setToasts((t) => [...t, { id: siguienteId++, message, type, duration, accion }]);
  }, []);
  const value = React.useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <CrmPortal>
        <div
          data-app-chrome
          className={cn(UI_ROOT, "pointer-events-none fixed inset-x-4 bottom-4 z-(--crm-z-toast) flex flex-col sm:inset-x-auto sm:right-4 sm:w-[360px]")}
        >
          <div role="alert" aria-live="assertive" className="flex flex-col gap-2 [&:not(:empty)]:mb-2">
            {toasts.filter((t) => t.type === "error").map((t) => (
              <Aviso key={t.id} toast={t} onRemove={quitar} />
            ))}
          </div>
          <div role="status" aria-live="polite" className="flex flex-col gap-2">
            {toasts.filter((t) => t.type !== "error").map((t) => (
              <Aviso key={t.id} toast={t} onRemove={quitar} />
            ))}
          </div>
        </div>
      </CrmPortal>
    </ToastContext.Provider>
  );
}

function Aviso({ toast, onRemove }: { toast: ToastItem; onRemove: (id: number) => void }) {
  const [pausado, setPausado] = React.useState(false);
  React.useEffect(() => {
    if (pausado) return;
    const t = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onRemove, pausado]);
  const { icon: Icon, color } = ICONO[toast.type];

  return (
    <div
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPausado(false);
      }}
      className="pointer-events-auto flex items-start gap-2 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) px-3 py-2 shadow-(--crm-shadow-float) animate-[crm-pop_var(--crm-dur)_var(--crm-ease)] motion-reduce:animate-none"
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className={cn("mt-1.5 size-4 shrink-0", color)} />
      <div className="min-w-0 flex-1 py-1">
        <p className="text-[14px] leading-5">{toast.message}</p>
        {toast.accion && (
          <Link
            href={toast.accion.href}
            onClick={() => onRemove(toast.id)}
            className={cn("mt-0.5 inline-block rounded-(--crm-radius-sm) text-[14px] font-medium text-(--crm-accent-text) underline underline-offset-4", FOCUS)}
          >
            {toast.accion.label}
          </Link>
        )}
      </div>
      <IconButton label="Cerrar notificación" icon={X} size="sm" className="-mr-1" onClick={() => onRemove(toast.id)} />
    </div>
  );
}
