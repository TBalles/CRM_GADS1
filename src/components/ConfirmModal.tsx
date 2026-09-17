"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button, useModalAnimation } from "./ui/UIComponents";
import { backdropClose } from "./ui/backdropClose";

/** Centred alert dialog (DESIGN.md §4.2). Use `variant="danger"` to destroy. */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "default",
  icon,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
  icon?: React.ReactNode;
}) {
  const { visible, overlayClass, modalClass } = useModalAnimation(isOpen);
  const [isProcessing, setIsProcessing] = React.useState(false);

  if (!visible) return null;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm ${overlayClass}`}
      {...backdropClose(() => {
        if (!isProcessing) onClose();
      })}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className={`${modalClass} flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl`}
      >
        <div className="flex flex-col items-center p-8 text-center">
          <div
            className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
              variant === "danger"
                ? "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                : "bg-brand/10 text-brand"
            }`}
          >
            {icon ?? <AlertTriangle className="h-6 w-6" />}
          </div>
          <h3 className="mb-2 text-lg font-bold text-foreground">{title}</h3>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{description}</p>
          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:flex-1"
              onClick={onClose}
              disabled={isProcessing}
            >
              {cancelText}
            </Button>
            <Button
              variant={variant === "danger" ? "destructive" : "default"}
              className="w-full gap-2 sm:flex-1"
              disabled={isProcessing}
              onClick={handleConfirm}
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
