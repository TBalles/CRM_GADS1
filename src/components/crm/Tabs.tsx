"use client";

import * as React from "react";
import Link from "next/link";
import { moverIndice, pasoDeTecla } from "./teclado";
import { LoadingStatus } from "./Feedback";
import { FOCUS, TYPE, cn } from "./cx";

export type TabItem = {
  value: string;
  label: string;
  /** Contador opcional (cantidad de oportunidades, ventas…): mono, en gris. Texto para "100+" (lista con tope). */
  count?: number | string;
  /** Modo URL: el link de esta tab (armado con `urlConParams(ruta, params, { tab })`). */
  href?: string;
  disabled?: boolean;
};

/**
 * Tabs de CRM 2.0 (MASTER.md §10.7). Una sola implementación, dos modos:
 *
 * - **URL** (el normal en fichas): cada item trae `href` (`?tab=`); la tab es un `<Link>` y el server component dibuja
 *   solo el panel activo. Activación manual: ←/→/Home/End mueven el foco, Enter o Espacio navegan (así una flecha no dispara
 *   una navegación por tab). Atrás/adelante y el deep link funcionan porque la URL es el estado.
 * - **Controlado** (`onValueChange`, sin `href`): botones; las flechas mueven y activan (el panel ya está en memoria).
 *
 * `id` es obligatorio y estable: une cada tab con su panel (`${id}-tab-${value}` / `${id}-panel`), también cuando el
 * panel lo dibuja el servidor con `<TabPanel tabsId={id} value={…}>`.
 *
 * - `navigate` (modo URL): quien llama navega (p. ej. `router.push` dentro de `startTransition`) y marca el `TabPanel`
 *   con `busy` mientras llega el contenido. Ctrl/Cmd/Shift/botón del medio siguen siendo links normales.
 * - Si las tabs no entran (celular), se scrollean y el borde con más tabs se desvanece: se ve que hay más.
 */
export function Tabs({
  id,
  label,
  items,
  value,
  onValueChange,
  navigate,
  className,
}: {
  id: string;
  label: string;
  items: TabItem[];
  value: string;
  onValueChange?: (value: string) => void;
  navigate?: (href: string) => void;
  className?: string;
}) {
  const refs = React.useRef<(HTMLElement | null)[]>([]);
  const lista = React.useRef<HTMLDivElement>(null);
  // Qué bordes tienen tabs escondidas (para desvanecerlos). Se mide al montar, al scrollear y al cambiar el tamaño.
  const [mas, setMas] = React.useState({ izq: false, der: false });
  React.useEffect(() => {
    const el = lista.current;
    if (!el) return;
    const medir = () => setMas({ izq: el.scrollLeft > 1, der: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
    const activa = el.querySelector<HTMLElement>('[aria-selected="true"]');
    if (activa && el.scrollWidth > el.clientWidth) el.scrollLeft = activa.offsetLeft - 16;
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", medir);
      ro.disconnect();
    };
  }, [value]);
  const off = (i: number) => Boolean(items[i]?.disabled);
  const actual = items.findIndex((t) => t.value === value);

  const onKey = (e: React.KeyboardEvent<HTMLElement>, i: number) => {
    // Un link no se activa con Espacio (solo Enter): en una tab, Espacio también navega.
    if (e.key === " " && items[i].href) {
      e.preventDefault();
      e.currentTarget.click();
      return;
    }
    const paso = pasoDeTecla(e.key, "horizontal");
    if (!paso) return;
    e.preventDefault();
    const j = moverIndice(i, items.length, paso, off);
    if (j < 0) return;
    refs.current[j]?.focus();
    if (onValueChange && !items[j].href) onValueChange(items[j].value);
  };

  return (
    <div
      ref={lista}
      role="tablist"
      aria-label={label}
      className={cn(
        "flex min-w-0 items-end gap-4 overflow-x-auto border-b border-(--crm-border) [scrollbar-width:none]",
        mas.der && mas.izq
          ? "[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-32px),transparent)]"
          : mas.der
            ? "[mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]"
            : mas.izq && "[mask-image:linear-gradient(to_right,transparent,black_24px)]",
        className,
      )}
    >
      {items.map((t, i) => {
        const sel = t.value === value;
        const props = {
          ref: (el: HTMLElement | null) => {
            refs.current[i] = el;
          },
          id: `${id}-tab-${t.value}`,
          role: "tab",
          "aria-selected": sel,
          "aria-controls": sel ? `${id}-panel` : undefined,
          "aria-disabled": t.disabled || undefined,
          // Roving tabindex: una sola tab en el orden de Tab (la activa, o la primera si ninguna lo está).
          tabIndex: sel || (actual < 0 && i === 0) ? 0 : -1,
          onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => onKey(e, i),
          className: cn(
            "relative -mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-0.5 text-[14px] font-medium whitespace-nowrap transition-colors duration-(--crm-dur-fast)",
            sel
              ? "border-(--crm-accent) text-(--crm-text)"
              : "border-transparent text-(--crm-text-2) hover:border-(--crm-border-strong) hover:text-(--crm-text)",
            t.disabled && "pointer-events-none opacity-45",
            FOCUS,
            "focus-visible:outline-offset-[-2px]",
          ),
        };
        const contenido = (
          <>
            {t.label}
            {t.count !== undefined && <span className={cn(TYPE.mono, "text-[12px] text-(--crm-text-2)")}>{t.count}</span>}
          </>
        );
        return t.href && !t.disabled ? (
          <Link
            key={t.value}
            href={t.href}
            scroll={false}
            onClick={(e) => {
              if (!navigate || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              if (!sel) navigate(t.href!);
            }}
            {...props}
          >
            {contenido}
          </Link>
        ) : (
          <button key={t.value} type="button" disabled={t.disabled} onClick={() => onValueChange?.(t.value)} {...props}>
            {contenido}
          </button>
        );
      })}
    </div>
  );
}

/**
 * El panel de la tab activa. Va donde se dibuje el contenido (puede ser un server component). `busy`: la tab nueva
 * está llegando (navegación en curso): `aria-busy`, "Cargando…" y el contenido viejo atenuado hasta que llegue.
 */
export function TabPanel({
  tabsId,
  value,
  busy = false,
  children,
  className,
}: {
  tabsId: string;
  value: string;
  busy?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      id={`${tabsId}-panel`}
      role="tabpanel"
      aria-labelledby={`${tabsId}-tab-${value}`}
      aria-busy={busy || undefined}
      tabIndex={0}
      className={cn(
        "min-w-0 rounded-(--crm-radius-sm) transition-opacity duration-(--crm-dur-fast)",
        busy && "opacity-60 motion-reduce:transition-none",
        FOCUS,
        className,
      )}
    >
      {busy && <LoadingStatus />}
      {children}
    </div>
  );
}

export type SegmentItem = { value: string; label: string; icon?: React.ElementType };

/**
 * Control segmentado (MASTER.md §10.7): elegir una vista entre 2–4 (Tablero / Lista). `radiogroup`: Tab entra al
 * elegido, ←/→ mueven y eligen. Si cambia de vista por URL, quien llama hace el `router.push` en `onValueChange`.
 */
export function SegmentedControl({
  label,
  items,
  value,
  onValueChange,
  size = "md",
  className,
}: {
  label: string;
  items: SegmentItem[];
  value: string;
  onValueChange: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-(--crm-radius-sm) border border-(--crm-border) bg-(--crm-panel-2) p-0.5", size === "sm" ? "h-7" : "h-8", className)}
    >
      {items.map((it, i) => {
        const sel = it.value === value;
        const Icon = it.icon;
        return (
          <button
            key={it.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={sel}
            tabIndex={sel ? 0 : -1}
            onClick={() => onValueChange(it.value)}
            onKeyDown={(e) => {
              const paso = pasoDeTecla(e.key, "horizontal") ?? pasoDeTecla(e.key, "vertical");
              if (!paso) return;
              e.preventDefault();
              const j = moverIndice(i, items.length, paso);
              refs.current[j]?.focus();
              onValueChange(items[j].value);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[3px] px-3 text-[13px] font-medium transition-colors duration-(--crm-dur-fast)",
              // Elegido: texto en acento + borde de acento (3:1 medido sobre panel-2), no solo un cambio de relleno.
              sel
                ? "bg-(--crm-panel) text-(--crm-accent-text) ring-1 ring-(--crm-accent)"
                : "text-(--crm-text-2) hover:bg-(--crm-hover) hover:text-(--crm-text)",
              FOCUS,
            )}
          >
            {Icon && <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
