"use client";

import * as React from "react";
import { Check, MoreVertical } from "lucide-react";
import { CrmPortal } from "./portal";
import { useAnchor, useLayer, useTypeahead } from "./overlay";
import { buscarPorTexto, moverIndice, pasoDeTecla } from "./teclado";
import { Button, FilterChip, IconButton, type ButtonVariant } from "./Button";
import { FLOATING, ITEM, UI_ROOT, cn } from "./cx";

export type MenuItem = {
  label: string;
  icon?: React.ElementType;
  onSelect: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  /** Opción de una elección única (filtro): el item es `menuitemradio` con `aria-checked` y un tilde. */
  checked?: boolean;
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
 * - Con `children`: `triggerLabel` le da nombre accesible al disparador cuando su contenido no lo tiene (un avatar
 *   decorativo, el menú de usuario), `variant` y `triggerClassName` lo ajustan, `triggerDescription` lo describe.
 *   `header` es un bloque de solo lectura arriba de los items (nombre, rol): va FUERA del `role="menu"` y lo describe
 *   (`aria-describedby`); el teclado lo saltea.
 * - `chip`: el disparador es un `FilterChip` ("Estado: Activo ▾") y los items con `checked` son una elección única
 *   (`menuitemradio`): el filtro de la toolbar con el mismo teclado del menú. Listas largas scrollean (máx. 320).
 */
export function Menu({
  label,
  items,
  children,
  align = "end",
  size = "md",
  header,
  triggerLabel,
  variant,
  triggerClassName,
  triggerDescription,
  chip,
}: {
  label: string;
  items: MenuItem[];
  children?: React.ReactNode;
  align?: "start" | "end";
  size?: "sm" | "md";
  header?: React.ReactNode;
  triggerLabel?: string;
  variant?: ButtonVariant;
  triggerClassName?: string;
  /** Descripción accesible del disparador (p. ej. "Administrador · Cátedra"): la lee el lector junto al nombre. */
  triggerDescription?: string;
  /** Disparador de filtro: nombre del filtro y valor aplicado (sin valor, solo el nombre). */
  chip?: { label: string; value?: string };
}) {
  const [abierto, setAbierto] = React.useState(false);
  const [activo, setActivo] = React.useState(-1);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const itemsRef = React.useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = React.useId();
  const headerId = React.useId();
  const descId = React.useId();
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

  const flotante = cn(UI_ROOT, FLOATING, "z-(--crm-z-popover) max-h-80 min-w-44 max-w-72 overflow-y-auto p-1");
  const lista = items.map((item, i) => {
    const Icon = item.icon;
    return (
      <button
        key={i}
        ref={(el) => {
          itemsRef.current[i] = el;
        }}
        type="button"
        role={item.checked === undefined ? "menuitem" : "menuitemradio"}
        aria-checked={item.checked}
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
        {item.checked && <Check aria-hidden="true" strokeWidth={1.75} className="ml-auto size-4 shrink-0 text-(--crm-accent-text)" />}
      </button>
    );
  });
  const menuProps = { id: menuId, role: "menu" as const, "aria-label": label, onKeyDown: onMenuKey };

  return (
    <>
      {triggerDescription && (
        <span id={descId} hidden>
          {triggerDescription}
        </span>
      )}
      {chip ? (
        <FilterChip label={chip.label} value={chip.value} aria-label={triggerLabel} {...triggerProps} />
      ) : children ? (
        <Button
          size={size}
          variant={variant}
          aria-label={triggerLabel}
          aria-describedby={triggerDescription ? descId : undefined}
          className={cn(triggerClassName, abierto && "bg-(--crm-pressed)")}
          {...triggerProps}
        >
          {children}
        </Button>
      ) : (
        <IconButton label={label} icon={MoreVertical} size={size} className={cn(abierto && "bg-(--crm-pressed) text-(--crm-text)")} {...triggerProps} />
      )}
      {abierto && (
        <CrmPortal>
          {header ? (
            // El bloque de arriba queda FUERA del role="menu" (un menú solo tiene ítems) y lo describe.
            <div ref={panel} style={{ position: "fixed", ...pos }} className={flotante}>
              <div id={headerId} className="-mx-1 -mt-1 mb-1 border-b border-(--crm-border) px-3 py-2">
                {header}
              </div>
              <div {...menuProps} aria-describedby={headerId}>
                {lista}
              </div>
            </div>
          ) : (
            <div ref={panel} {...menuProps} style={{ position: "fixed", ...pos }} className={flotante}>
              {lista}
            </div>
          )}
        </CrmPortal>
      )}
    </>
  );
}
