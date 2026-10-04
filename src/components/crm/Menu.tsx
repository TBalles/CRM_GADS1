"use client";

import * as React from "react";
import { MoreVertical } from "lucide-react";
import { CrmPortal } from "./portal";
import { useAnchor, useLayer, useTypeahead } from "./overlay";
import { buscarPorTexto, moverIndice, pasoDeTecla } from "./teclado";
import { Button, IconButton } from "./Button";
import { FLOATING, ITEM, UI_ROOT, cn } from "./cx";

export type MenuItem = {
  label: string;
  icon?: React.ElementType;
  onSelect: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
};

/**
 * Menú desplegable (MASTER.md §10.3): el `⋮` de las filas y el "Más acciones" de los headers de detalle.
 *
 * - Disparador: botón con `aria-haspopup="menu"` y `aria-expanded`. Sin `children` es un `⋮` cuyo nombre es
 *   `label` (contrato de E2E: "Acciones de <nombre>"); con `children` es un botón secundario con ese texto.
 * - Al abrir (clic, Enter, Espacio, ↓) el foco va al primer item; con ↑, al último. ↑/↓/Home/End mueven,
 *   tipear salta al item que empieza así (buffer de 500 ms), Enter/Espacio eligen, Escape y Tab cierran y devuelven el foco al
 *   disparador. Clic afuera cierra sin mover el foco.
 * - Al elegir, el foco vuelve al disparador ANTES de correr la acción: si la acción abre un diálogo, el diálogo
 *   devuelve el foco ahí al cerrarse.
 */
export function Menu({
  label,
  items,
  children,
  align = "end",
  size = "md",
}: {
  label: string;
  items: MenuItem[];
  children?: React.ReactNode;
  align?: "start" | "end";
  size?: "sm" | "md";
}) {
  const [abierto, setAbierto] = React.useState(false);
  const [activo, setActivo] = React.useState(-1);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const itemsRef = React.useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = React.useId();
  const pos = useAnchor(trigger, panel, abierto, { align });
  const off = (i: number) => Boolean(items[i]?.disabled);
  const tipeo = useTypeahead();

  const cerrar = React.useCallback((devolverFoco: boolean) => {
    setAbierto(false);
    setActivo(-1);
    if (devolverFoco) trigger.current?.focus();
  }, []);

  useLayer(abierto, (motivo) => cerrar(motivo === "escape"), [trigger, panel]);

  // El foco sigue al item activo (foco real en el item: así lo anuncian todos los lectores).
  React.useEffect(() => {
    if (abierto && activo >= 0) itemsRef.current[activo]?.focus();
  }, [abierto, activo]);

  const abrir = (paso: "first" | "last") => {
    setAbierto(true);
    setActivo(moverIndice(-1, items.length, paso, off));
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      abrir(e.key === "ArrowDown" ? "first" : "last");
    }
  };

  const elegir = (i: number) => {
    const item = items[i];
    if (!item || item.disabled) return;
    cerrar(true);
    item.onSelect();
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const paso = pasoDeTecla(e.key, "vertical");
    if (paso) {
      e.preventDefault();
      setActivo((a) => moverIndice(a, items.length, paso, off));
    } else if (e.key === "Tab") {
      // Sin preventDefault: el foco vuelve al disparador y el Tab sigue de ahí al siguiente elemento (dentro de un
      // drawer, la cerca de useModalFocus lo mantiene adentro).
      cerrar(true);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== " ") {
      const i = buscarPorTexto(items.map((it) => it.label), activo, tipeo(e.key), off);
      if (i >= 0) setActivo(i);
    }
  };

  const triggerProps = {
    ref: trigger,
    "aria-haspopup": "menu" as const,
    "aria-expanded": abierto,
    "aria-controls": abierto ? menuId : undefined,
    onClick: (e: React.MouseEvent) => {
      // Dentro de una fila clickeable, el `⋮` no navega a la ficha.
      e.stopPropagation();
      if (abierto) cerrar(false);
      else abrir("first");
    },
    onKeyDown: onTriggerKey,
  };

  return (
    <>
      {children ? (
        <Button size={size} {...triggerProps}>
          {children}
        </Button>
      ) : (
        <IconButton label={label} icon={MoreVertical} size={size} className={cn(abierto && "bg-(--crm-pressed) text-(--crm-text)")} {...triggerProps} />
      )}
      {abierto && (
        <CrmPortal>
          <div
            ref={panel}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKey}
            style={{ position: "fixed", ...pos }}
            className={cn(UI_ROOT, FLOATING, "z-(--crm-z-popover) min-w-44 max-w-72 p-1")}
          >
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={i}
                  ref={(el) => {
                    itemsRef.current[i] = el;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  aria-disabled={item.disabled || undefined}
                  data-active={i === activo}
                  onPointerMove={() => !item.disabled && i !== activo && setActivo(i)}
                  onClick={(e) => {
                    e.stopPropagation();
                    elegir(i);
                  }}
                  className={cn(ITEM, item.variant === "danger" && "text-(--crm-danger)")}
                >
                  {Icon && <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </CrmPortal>
      )}
    </>
  );
}
