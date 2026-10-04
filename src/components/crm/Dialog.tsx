"use client";

import * as React from "react";
import { backdropClose } from "@/components/ui/backdropClose";
import { CrmPortal } from "./portal";
import { useLayer, useModalFocus, usePresence, useScrollLock } from "./overlay";
import { Button } from "./Button";
import { TYPE, UI_ROOT, cn } from "./cx";

/**
 * Diálogo centrado (MASTER.md §10.8): SOLO confirmaciones y el cierre de oportunidad. Todo lo demás va en Drawer.
 * Hasta 440 px. Título 16 px, texto 14 px, acciones abajo a la derecha (apiladas en mobile, la principal arriba).
 * `role="dialog"`; para pedir confirmación, `ConfirmDialog` (`role="alertdialog"`).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  role = "dialog",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  role?: "dialog" | "alertdialog";
  busy?: boolean;
}) {
  const { montada, cerrando } = usePresence(open, 160); // = --crm-dur: el desmontaje espera la animación de salida
  const panel = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();
  const cerrar = () => {
    if (!busy) onClose();
  };
  useLayer(open, cerrar);
  useModalFocus(panel, open);
  useScrollLock(open);

  if (!montada) return null;

  return (
    <CrmPortal>
      <div
        className={cn(
          UI_ROOT,
          "fixed inset-0 z-(--crm-z-dialog) flex items-center justify-center bg-(--crm-scrim) p-4",
          cerrando ? "animate-[crm-fade_var(--crm-dur)_var(--crm-ease)_reverse_forwards]" : "animate-[crm-fade_var(--crm-dur)_var(--crm-ease)]",
          "motion-reduce:animate-none",
        )}
        {...backdropClose(cerrar)}
      >
        <div
          ref={panel}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          aria-busy={busy || undefined}
          tabIndex={-1}
          className={cn(
            "flex w-full max-w-[440px] flex-col rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) shadow-(--crm-shadow-float) outline-none",
            !cerrando && "animate-[crm-pop_var(--crm-dur)_var(--crm-ease)] motion-reduce:animate-none",
          )}
        >
          <div className="flex flex-col gap-1.5 px-5 pb-4 pt-5">
            <h2 id={titleId} className={TYPE.section}>
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-[14px] leading-5 text-(--crm-text-2)">
                {description}
              </p>
            )}
            {children}
          </div>
          {footer && <div className="flex flex-col-reverse gap-2 px-5 pb-5 sm:flex-row sm:justify-end">{footer}</div>}
        </div>
      </div>
    </CrmPortal>
  );
}

/**
 * Confirmación (mismo contrato que `ConfirmModal`): espera `onConfirm`, mientras tanto no se cierra (ni Escape ni
 * fondo) y muestra el botón ocupado; al terminar, cierra. El foco entra en "Cancelar" (lo menos destructivo).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "default",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
}) {
  const [procesando, setProcesando] = React.useState(false);
  const confirmar = async () => {
    setProcesando(true);
    try {
      await onConfirm();
    } finally {
      setProcesando(false);
      onClose();
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      role="alertdialog"
      busy={procesando}
      footer={
        <>
          <Button data-autofocus onClick={onClose} disabled={procesando}>
            {cancelText}
          </Button>
          <Button variant={variant === "danger" ? "danger" : "primary"} loading={procesando} onClick={confirmar}>
            {confirmText}
          </Button>
        </>
      }
    />
  );
}
