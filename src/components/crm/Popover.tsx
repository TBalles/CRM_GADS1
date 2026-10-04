"use client";

import * as React from "react";
import { CrmPortal } from "./portal";
import { focusables, useAnchor, useLayer } from "./overlay";
import { FLOATING, UI_ROOT, cn } from "./cx";

type TriggerProps = {
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  "aria-haspopup"?: "dialog";
  onClick?: (e: React.MouseEvent) => void;
};

/**
 * Popover no modal (MASTER.md §10.3): el panel de un FilterChip ("Estado: Activo ▾"), una ayuda con controles.
 * Para listas de acciones se usa `Menu`; para elegir un valor, `Select`.
 *
 * - `trigger` es UN botón; recibe `aria-expanded`, `aria-controls`, `aria-haspopup="dialog"` y el clic.
 * - Al abrir, el foco va al primer enfocable del panel (o al panel). Escape cierra y vuelve al disparador; Tab al
 *   salir del último (o Shift+Tab desde el primero) también. Clic afuera cierra sin mover el foco.
 * - Controlado (`open`/`onOpenChange`) o no controlado.
 */
export function Popover({
  label,
  trigger,
  children,
  align = "start",
  open: openProp,
  onOpenChange,
  className,
}: {
  /** Nombre accesible del panel (`role="dialog"`). */
  label: string;
  trigger: React.ReactElement<TriggerProps>;
  children: React.ReactNode;
  align?: "start" | "end";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const [interno, setInterno] = React.useState(false);
  const abierto = openProp ?? interno;
  const wrap = React.useRef<HTMLSpanElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const id = React.useId();
  const pos = useAnchor(wrap, panel, abierto, { align });

  const disparador = () => wrap.current?.querySelector<HTMLElement>("button,[tabindex]") ?? null;
  const setAbierto = React.useCallback(
    (v: boolean) => {
      if (openProp === undefined) setInterno(v);
      onOpenChange?.(v);
    },
    [openProp, onOpenChange],
  );
  const cerrar = (devolverFoco: boolean) => {
    setAbierto(false);
    if (devolverFoco) disparador()?.focus();
  };

  useLayer(abierto, (motivo) => cerrar(motivo === "escape"), [wrap, panel]);

  React.useEffect(() => {
    if (!abierto || !panel.current) return;
    (focusables(panel.current)[0] ?? panel.current).focus();
  }, [abierto]);

  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !panel.current) return;
    const lista = focusables(panel.current);
    const salePorAbajo = !e.shiftKey && document.activeElement === lista[lista.length - 1];
    const salePorArriba = e.shiftKey && (document.activeElement === lista[0] || document.activeElement === panel.current);
    if (lista.length === 0 || salePorAbajo || salePorArriba) {
      // Shift+Tab se queda en el disparador; Tab sigue desde él hacia el siguiente elemento de la página.
      if (salePorArriba) e.preventDefault();
      cerrar(true);
    }
  };

  return (
    <>
      <span ref={wrap} className="inline-flex">
        {React.cloneElement(trigger, {
          "aria-expanded": abierto,
          "aria-controls": abierto ? id : undefined,
          "aria-haspopup": "dialog",
          onClick: (e: React.MouseEvent) => {
            trigger.props.onClick?.(e);
            setAbierto(!abierto);
          },
        })}
      </span>
      {abierto && (
        <CrmPortal>
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            onKeyDown={onPanelKey}
            style={{ position: "fixed", ...pos }}
            className={cn(UI_ROOT, FLOATING, "z-(--crm-z-popover) w-72 max-w-[calc(100vw-16px)] p-3 outline-none", className)}
          >
            {children}
          </div>
        </CrmPortal>
      )}
    </>
  );
}
