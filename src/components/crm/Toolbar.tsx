"use client";

import * as React from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { useBusquedaUrl, type FiltrosUrl } from "@/components/FiltrosUrl";
import { FilterChip } from "./Button";
import { Checkbox, Field } from "./Field";
import { Popover } from "./Popover";
import { Select, type SelectOption } from "./Select";
import { DatePicker } from "./DatePicker";
import { FIELD, FOCUS, cn } from "./cx";

/**
 * Toolbar de una lista (MASTER.md §10.12): 40 de alto, pegada a la grilla; búsqueda + FilterChips + "Limpiar". Los
 * filtros viven en la URL (`useFiltrosUrl`); esto solo los dibuja con los primitivos de CRM 2.0. Los chips se
 * reacomodan (wrap), nunca se recortan. Es `@container`: con poco ancho (vista previa abierta, 1024 y menos) los filtros
 * secundarios se juntan en "Más filtros" (`ANCHO_FILTROS`, MASTER.md §10.14) y la barra queda en una fila.
 */
export function Toolbar({ label = "Filtros", children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("@container flex min-h-10 shrink-0 flex-wrap items-center gap-2 py-1.5", className)}>
      {children}
    </div>
  );
}

/**
 * Buscador atado a `?q=` (o `param`): mismo comportamiento que `CajaBusqueda` (300 ms o Enter; sigue a la URL si cambia
 * por atrás/adelante), con el campo de 28 de CRM 2.0. `label` es su nombre accesible (contrato de E2E).
 */
export function SearchField({
  filtros,
  label,
  placeholder,
  param = "q",
  className,
}: {
  filtros: FiltrosUrl;
  label: string;
  placeholder: string;
  param?: string;
  className?: string;
}) {
  const { texto, setTexto, enviarYa } = useBusquedaUrl(filtros, param);
  return (
    <SearchInput
      label={label}
      placeholder={placeholder}
      value={texto}
      onChange={setTexto}
      onEnter={() => enviarYa(texto)}
      onClear={() => {
        setTexto("");
        enviarYa("");
      }}
      pending={filtros.pending}
      className={className}
    />
  );
}

/**
 * El campo de búsqueda de la toolbar, sin URL: lo usan `SearchField` (atado a `?q=`) y las listas que filtran en el
 * cliente (Alertas, que nunca tuvo la búsqueda en la URL). `type="text"`: rol `textbox`.
 */
export function SearchInput({
  label,
  placeholder,
  value,
  onChange,
  onEnter,
  onClear,
  pending = false,
  className,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  onClear: () => void;
  pending?: boolean;
  className?: string;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-(--crm-text-2)" />
      <input
        ref={input}
        // type="text" (no "search"): el rol tiene que ser `textbox` (contrato de E2E: "Buscar empresa o contacto").
        type="text"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        maxLength={100}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter?.();
          }
        }}
        className={cn(FIELD, "h-9 pl-8 pr-8 sm:h-7")}
      />
      {value && (
        <button
          type="button"
          aria-label="Borrar la búsqueda"
          onClick={() => {
            onClear();
            // El botón desaparece al vaciar el campo: sin esto el foco caería al <body>.
            input.current?.focus();
          }}
          className={cn(
            "absolute right-1 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-(--crm-radius-sm) text-(--crm-text-2) hover:bg-(--crm-hover) hover:text-(--crm-text)",
            FOCUS,
          )}
        >
          {pending ? (
            <Loader2 aria-hidden="true" strokeWidth={1.75} className="size-3.5 animate-spin motion-reduce:animate-none" />
          ) : (
            <X aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Filtro de fecha atado a la URL (`?desde=` / `?hasta=`, "YYYY-MM-DD"): el `DatePicker` de CRM 2.0 (28 en la toolbar,
 * 32 dentro de "Más filtros"). Escribe en la URL solo un valor confirmado y válido (el picker nunca entrega una fecha a
 * medio tipear) o lo borra con "" (campo vaciado a propósito). Un texto inválido o fuera de rango NO toca la URL
 * (`keepOnInvalid`): el filtro aplicado sigue y el campo muestra su mensaje. `min`/`max` encadenan desde/hasta como el `FiltroFecha` legacy.
 * - `inline` (toolbar): label visible a la izquierda ("Desde [__/__/____]").
 * - apilado (dentro de "Más filtros"): label arriba, como los demás campos del popover.
 */
export function FechaFiltro({
  filtros,
  param,
  label,
  min,
  max,
  inline = false,
}: {
  filtros: FiltrosUrl;
  param: string;
  label: string;
  min?: string;
  max?: string;
  inline?: boolean;
}) {
  const id = React.useId();
  const valor = filtros.valor(param);
  const picker = (
    <DatePicker
      id={id}
      dense={inline}
      keepOnInvalid
      value={valor}
      min={min || undefined}
      max={max || undefined}
      onChange={(v) => {
        if (v !== valor) filtros.aplicar({ [param]: v || null });
      }}
      className={inline ? "w-36" : undefined}
    />
  );
  if (!inline) return <Field id={id} label={label}>{() => picker}</Field>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <label htmlFor={id} className="text-[13px] text-(--crm-text-2)">
        {label}
      </label>
      {picker}
    </span>
  );
}

/**
 * Chip de dos estados ("Ver dadas de baja"): `aria-pressed`. Apretado: tilde + texto en acento, borde fuerte. Misma
 * caja que el FilterChip (28, hairline, sólido).
 */
export function ToggleChip({
  pressed,
  onPressedChange,
  children,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-(--crm-radius-sm) border bg-(--crm-panel) px-2 text-[13px]",
        "transition-colors duration-(--crm-dur-fast) ease-(--crm-ease) hover:bg-(--crm-hover)",
        pressed ? "border-(--crm-accent) font-medium text-(--crm-accent-text)" : "border-(--crm-border) text-(--crm-text) hover:border-(--crm-border-strong)",
        FOCUS,
      )}
    >
      {pressed && <Check aria-hidden="true" strokeWidth={1.75} className="size-3.5" />}
      {children}
    </button>
  );
}

/**
 * Desde este ancho de toolbar (52rem, 832 px: la lista sin vista previa a 1280 y a 1440) los filtros secundarios van
 * como chips sueltos (`ANCHO_FILTROS.chips`); debajo, juntos en "Más filtros" (`ANCHO_FILTROS.mas`). El buscador se
 * angosta a 192 en el modo junto (`ANCHO_FILTROS.buscador`). Mismo markup y mismos parámetros de URL en los dos modos:
 * CSS elige cuál se ve (el otro es `display: none`, fuera del árbol de accesibilidad).
 */
export const ANCHO_FILTROS = {
  chips: "hidden @[52rem]:contents",
  mas: "contents @[52rem]:hidden",
  buscador: "sm:w-48 @[52rem]:w-64",
} as const;

/**
 * "Más filtros": UN chip que abre un `Popover` ("Más filtros", `role="dialog"`) con los filtros secundarios como campos
 * (`FiltroOpciones`, `FiltroSiNo`). Con filtros aplicados muestra cuántos ("Más filtros: 2"; nombre accesible "Más
 * filtros, 2 aplicados"). Cada cambio se aplica al instante en la URL, igual que los chips.
 */
export function MasFiltros({ activos, children }: { activos: number; children: React.ReactNode }) {
  return (
    <Popover
      label="Más filtros"
      trigger={
        <FilterChip
          label="Más filtros"
          value={activos ? String(activos) : undefined}
          aria-label={activos ? `Más filtros, ${activos} ${activos === 1 ? "aplicado" : "aplicados"}` : "Más filtros"}
        />
      }
    >
      <div className="flex flex-col gap-3">{children}</div>
    </Popover>
  );
}

/** Un filtro de opción única dentro de "Más filtros": label visible + `Select` (32). */
export function FiltroOpciones({ label, value, options, onChange }: { label: string; value: string; options: SelectOption[]; onChange: (v: string) => void }) {
  const id = React.useId();
  return (
    <Field id={id} label={label}>
      {(p, labelId) => <Select {...p} aria-labelledby={labelId} value={value} onChange={onChange} options={options} searchable={options.length > 8} />}
    </Field>
  );
}

/** Un filtro on/off dentro de "Más filtros" ("Ver bajas"): checkbox nativo. */
export function FiltroSiNo({ label, checked, onChange }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  const id = React.useId();
  return <Checkbox id={id} label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />;
}
