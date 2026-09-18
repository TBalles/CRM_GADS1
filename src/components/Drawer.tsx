"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useModalAnimation } from "./ui/overlay";
import { backdropClose } from "./ui/backdropClose";

/**
 * Right-hand sliding panel (DESIGN.md §4.3) carrying the kit's modal
 * header / scrollable body / footer structure (§4.1). Every create-and-edit
 * form in this app lives in one of these instead of navigating away.
 */
export default function Drawer({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  const { visible, overlayClass, modalClass } = useModalAnimation(open);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!visible) return null;

  const drawerClass = modalClass === "modal-exit" ? "drawer-exit-right" : "drawer-enter-right";

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm ${overlayClass}`}
      {...backdropClose(onClose)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${drawerClass} relative flex h-full w-full max-w-lg flex-col border-l bg-background shadow-2xl`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b bg-secondary/20 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                <Icon className="h-4 w-4 text-brand" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold tracking-tight">{title}</h2>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Forms pin their own action bar to the bottom of this scroll area
            with <FormActions>, so there's no separate footer slot. A direct
            <form> child stretches to the full height so a short form still
            gets its action bar at the bottom instead of floating mid-panel. */}
        <div className="flex flex-1 flex-col overflow-y-auto p-5 [&>form]:flex [&>form]:flex-1 [&>form]:flex-col">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
