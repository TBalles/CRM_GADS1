"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { CrmPortal } from "./portal";
import { useAnchor, useLayer, useTypeahead } from "./overlay";
import { buscarPorTexto, moverIndice, pasoDeTecla } from "./teclado";
import { FIELD, FLOATING, ITEM, UI_ROOT, cn } from "./cx";

export type SelectOption = {
  value: string;
  label: string;
  /** Color de la organización (etapas): se muestra como cuadradito. */
  color?: string | null;
  disabled?: boolean;
};

/**
 * Select de CRM 2.0 (MASTER.md §10.2): combobox de solo selección (patrón APG) con la lista en `#crm-portal`.
 * Mismo contrato que `ui/Select` (value/onChange/options/searchable/id/aria-*), con teclado completo:
 *
 * - Cerrado: ↓/↑/Enter/Espacio/Alt+↓ abren (en la opción elegida, o la primera/última); tipear abre y salta.
 * - Abierto: ↑/↓/Home/End mueven la opción activa (`aria-activedescendant`), tipear salta (buffer de 500 ms), Enter/Espacio
 *   eligen, Escape y Tab cierran sin cambiar. El foco queda en el disparador (o en el buscador).
 * - `searchable` (por defecto con más de 8 opciones): un buscador arriba de la lista que toma el foco.
 * - `required` -> `aria-required`; `aria-invalid` y `aria-describedby` llegan desde `Field` (error y ayuda).
 * - Clic en el `<label>` del campo: enfoca el select SIN abrir la lista (se cancela el reenvío del clic del label
 *   al botón; los clics directos, también los sintéticos de un lector de pantalla, abren como siempre).
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Seleccionar…",
  searchable,
  disabled,
  required,
  dense,
  className,
  id,
  "aria-invalid": ariaInvalid,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  required?: boolean;
  dense?: boolean;
  className?: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
}) {
  const conBuscador = searchable ?? options.length > 8;
  const [abierto, setAbierto] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activo, setActivo] = React.useState(-1);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const base = React.useId();
  const listboxId = `${base}-listbox`;
  const optId = (i: number) => `${base}-opt-${i}`;
  const pos = useAnchor(trigger, panel, abierto, { matchWidth: true });
  const tipeo = useTypeahead();

  React.useEffect(() => {
    const labels = Array.from(trigger.current?.labels ?? []);
    const onLabel = (e: MouseEvent) => {
      e.preventDefault();
      trigger.current?.focus();
    };
    labels.forEach((l) => l.addEventListener("click", onLabel));
    return () => labels.forEach((l) => l.removeEventListener("click", onLabel));
  }, [id]);

  const visibles = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options;
  const off = (i: number) => Boolean(visibles[i]?.disabled);
  const elegida = options.find((o) => o.value === value);

  const cerrar = (devolverFoco: boolean) => {
    setAbierto(false);
    setActivo(-1);
    if (devolverFoco) trigger.current?.focus();
  };
  useLayer(abierto, (motivo) => cerrar(motivo === "escape"), [trigger, panel]);

  const abrir = (paso: "first" | "last" | "selected") => {
    setQuery("");
    setAbierto(true);
    const sel = options.findIndex((o) => o.value === value);
    setActivo(paso === "selected" && sel >= 0 ? sel : moverIndice(-1, options.length, paso === "last" ? "last" : "first", (i) => Boolean(options[i]?.disabled)));
  };

  const elegir = (i: number) => {
    const op = visibles[i];
    if (!op || op.disabled) return;
    onChange(op.value);
    cerrar(true);
  };

  React.useEffect(() => {
    if (abierto && activo >= 0) document.getElementById(optId(activo))?.scrollIntoView({ block: "nearest" });
    // optId es derivado de `base`, estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, activo]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!abierto) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        abrir(e.key === "ArrowUp" ? "last" : "selected");
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !conBuscador) {
        const i = buscarPorTexto(options.map((o) => o.label), options.findIndex((o) => o.value === value), tipeo(e.key), (j) => Boolean(options[j]?.disabled));
        if (i >= 0) {
          setQuery("");
          setAbierto(true);
          setActivo(i);
        }
      }
      return;
    }
    const paso = pasoDeTecla(e.key, "vertical");
    // En el buscador, Home/End mueven el cursor del texto, no la opción.
    if (paso && !(conBuscador && (paso === "first" || paso === "last"))) {
      e.preventDefault();
      setActivo((a) => moverIndice(a, visibles.length, paso, off));
    } else if (e.key === "Enter" || (e.key === " " && !conBuscador)) {
      e.preventDefault();
      elegir(activo);
    } else if (e.key === "Tab") {
      // Desde el buscador (que desaparece al cerrar) el foco vuelve al disparador; si no, el Tab sigue normal.
      if (conBuscador) e.preventDefault();
      cerrar(conBuscador);
    } else if (!conBuscador && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const i = buscarPorTexto(visibles.map((o) => o.label), activo, tipeo(e.key), off);
      if (i >= 0) setActivo(i);
    }
  };

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={listboxId}
        aria-activedescendant={abierto && !conBuscador && activo >= 0 ? optId(activo) : undefined}
        aria-invalid={ariaInvalid}
        aria-required={required || undefined}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        onClick={() => (abierto ? cerrar(false) : abrir("selected"))}
        onKeyDown={onKey}
        className={cn(
          FIELD,
          "flex cursor-pointer items-center justify-between gap-2 text-left",
          dense ? "h-7" : "h-8",
          abierto && "border-(--crm-accent)",
          className,
        )}
      >
        <span className={cn("flex min-w-0 items-center gap-2", !elegida && "text-(--crm-text-2)")}>
          {elegida?.color && <span aria-hidden="true" className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: elegida.color }} />}
          <span className="truncate">{elegida?.label ?? placeholder}</span>
        </span>
        <ChevronDown aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-(--crm-text-2)" />
      </button>
      {abierto && (
        <CrmPortal>
          <div
            ref={panel}
            style={{ position: "fixed", ...pos }}
            className={cn(UI_ROOT, FLOATING, "z-(--crm-z-popover) w-max max-w-[min(24rem,calc(100vw-16px))]")}
          >
            {conBuscador && (
              <div className="relative border-b border-(--crm-border) p-1">
                <Search aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--crm-text-2)" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActivo(0);
                  }}
                  onKeyDown={onKey}
                  placeholder="Buscar…"
                  aria-label="Buscar opción"
                  role="combobox"
                  aria-expanded
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={activo >= 0 && visibles[activo] ? optId(activo) : undefined}
                  className="h-8 w-full rounded-(--crm-radius-sm) bg-transparent pl-8 pr-2 text-[16px] outline-none placeholder:text-(--crm-text-2) sm:text-[14px]"
                />
              </div>
            )}
            <div id={listboxId} role="listbox" aria-labelledby={ariaLabelledBy} aria-label={ariaLabel} className="max-h-64 overflow-y-auto p-1">
              {visibles.length === 0 ? (
                <p className="px-2 py-3 text-[13px] text-(--crm-text-2)">Sin resultados</p>
              ) : (
                visibles.map((op, i) => (
                  <div
                    key={op.value}
                    id={optId(i)}
                    role="option"
                    aria-selected={op.value === value}
                    aria-disabled={op.disabled || undefined}
                    data-active={i === activo}
                    // El foco no se mueve del disparador/buscador al hacer clic en una opción.
                    onMouseDown={(e) => e.preventDefault()}
                    onPointerMove={() => !op.disabled && i !== activo && setActivo(i)}
                    onClick={() => elegir(i)}
                    className={cn(ITEM, op.value === value && "font-medium")}
                  >
                    {op.color && <span aria-hidden="true" className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: op.color }} />}
                    <span className="min-w-0 flex-1 truncate">{op.label}</span>
                    <Check aria-hidden="true" strokeWidth={2} className={cn("size-4 shrink-0 text-(--crm-accent-text)", op.value !== value && "invisible")} />
                  </div>
                ))
              )}
            </div>
          </div>
        </CrmPortal>
      )}
    </>
  );
}
