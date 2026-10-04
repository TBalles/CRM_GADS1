"use client";

import * as React from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { useBusquedaUrl, type FiltrosUrl } from "@/components/FiltrosUrl";
import { FIELD, FOCUS, cn } from "./cx";

/**
 * Toolbar de una lista (MASTER.md §10.12): 40 de alto, pegada a la grilla; búsqueda + FilterChips + "Limpiar". Los
 * filtros viven en la URL (`useFiltrosUrl`); esto solo los dibuja con los primitivos de CRM 2.0. Los chips se
 * reacomodan (wrap), nunca se recortan.
 */
export function Toolbar({ label = "Filtros", children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("flex min-h-10 shrink-0 flex-wrap items-center gap-2 py-1.5", className)}>
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
        value={texto}
        maxLength={100}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            enviarYa(texto);
          }
        }}
        className={cn(FIELD, "h-9 pl-8 pr-8 sm:h-7")}
      />
      {texto && (
        <button
          type="button"
          aria-label="Borrar la búsqueda"
          onClick={() => {
            setTexto("");
            enviarYa("");
            // El botón desaparece al vaciar el campo: sin esto el foco caería al <body>.
            input.current?.focus();
          }}
          className={cn(
            "absolute right-1 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-(--crm-radius-sm) text-(--crm-text-2) hover:bg-(--crm-hover) hover:text-(--crm-text)",
            FOCUS,
          )}
        >
          {filtros.pending ? (
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
