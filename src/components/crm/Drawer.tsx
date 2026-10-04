"use client";

import * as React from "react";
import { X } from "lucide-react";
import { backdropClose } from "@/components/ui/backdropClose";
import { CrmPortal } from "./portal";
import { useLayer, useModalFocus, usePresence, useScrollLock } from "./overlay";
import { IconButton } from "./Button";
import { TYPE, UI_ROOT, cn } from "./cx";

/**
 * Drawer derecho de CRM 2.0 (MASTER.md §10.8): todo alta y edición vive acá, sin salir de la lista o la ficha.
 *
 * - `role="dialog"` + `aria-modal`, nombre = `title` vía `aria-label` (contrato de E2E: "Nueva empresa"…).
 * - Header y footer fijos; el cuerpo scrollea. Con `onSubmit`, cuerpo y footer van dentro de un `<form>` (Enter
 *   envía, el botón `type="submit"` del footer también).
 * - Foco: entra al primer enfocable (o `data-autofocus`), queda atrapado, vuelve al disparador al cerrar.
 * - Escape y clic en el fondo cierran, salvo con `busy` (guardando): no se cierra a mitad de una mutación.
 * - 480 px (`md`) o 640 (`lg`, empresa); ancho completo en mobile.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  size = "md",
  footer,
  onSubmit,
  busy = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  size?: "md" | "lg";
  footer?: React.ReactNode;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  const { montada, cerrando } = usePresence(open, 200); // = --crm-dur-slow: el desmontaje espera la animación de salida
  const panel = React.useRef<HTMLDivElement>(null);
  const descId = React.useId();
  const cerrar = () => {
    if (!busy) onClose();
  };
  useLayer(open, cerrar);
  useModalFocus(panel, open);
  useScrollLock(open);

  if (!montada) return null;

  const cuerpo = (
    <>
      <div data-focus-scope className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {children}
      </div>
      {footer && (
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-(--crm-border) bg-(--crm-panel) px-4 py-3 sm:flex-row sm:justify-end">
          {footer}
        </div>
      )}
    </>
  );

  return (
    <CrmPortal>
      <div
        className={cn(
          UI_ROOT,
          "fixed inset-0 z-(--crm-z-drawer) flex justify-end bg-(--crm-scrim)",
          cerrando
            ? "animate-[crm-fade_var(--crm-dur-slow)_var(--crm-ease)_reverse_forwards]"
            : "animate-[crm-fade_var(--crm-dur-slow)_var(--crm-ease)]",
          "motion-reduce:animate-none",
        )}
        {...backdropClose(cerrar)}
      >
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          aria-describedby={description ? descId : undefined}
          aria-busy={busy || undefined}
          tabIndex={-1}
          className={cn(
            "flex h-full w-full flex-col border-l border-(--crm-border) bg-(--crm-panel) shadow-(--crm-shadow-float) outline-none",
            size === "lg" ? "sm:max-w-[640px]" : "sm:max-w-[480px]",
            cerrando
              ? "animate-[crm-slide-in-right_var(--crm-dur-slow)_var(--crm-ease)_reverse_forwards]"
              : "animate-[crm-slide-in-right_var(--crm-dur-slow)_var(--crm-ease)]",
            "motion-reduce:animate-none",
          )}
        >
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-(--crm-border) px-4">
            <div className="min-w-0">
              <h2 className={cn(TYPE.section, "truncate")}>{title}</h2>
              {description && (
                <p id={descId} className={cn(TYPE.meta, "truncate text-(--crm-text-2)")}>
                  {description}
                </p>
              )}
            </div>
            <IconButton label="Cerrar panel" icon={X} onClick={cerrar} disabled={busy} />
          </header>
          {onSubmit ? (
            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
              {cuerpo}
            </form>
          ) : (
            cuerpo
          )}
        </div>
      </div>
    </CrmPortal>
  );
}

/** Sección con título dentro de un drawer o formulario: agrupa sin caja (nada de cards dentro del drawer). */
export function FormSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 border-t border-(--crm-border) pt-4 first:border-t-0 first:pt-0", className)}>
      <h3 className="text-[13px] font-semibold leading-[18px] text-(--crm-text)">{title}</h3>
      {children}
    </section>
  );
}
