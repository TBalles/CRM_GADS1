"use client";

import * as React from "react";
import { acumularTipeo, paradasDeTab } from "./teclado";

/**
 * Comportamiento compartido de las capas de CRM 2.0 (drawer, diálogo, menú, popover, select, tooltip). Son hooks,
 * así que este módulo es solo de cliente: los primitivos que se usan desde server components no lo importan
 * (misma regla que `ui/overlay.ts` frente a `UIComponents.tsx`).
 *
 * Pila de capas: Escape y el clic afuera los atiende SOLO la capa de arriba. Un select abierto dentro de un drawer
 * se cierra con Escape sin cerrar el drawer; el siguiente Escape cierra el drawer.
 */

const pila: symbol[] = [];
const esTope = (t: symbol) => pila[pila.length - 1] === t;

/**
 * Registra una capa abierta. `onDismiss` se llama con Escape o (si se pasan `dentro`) con un pointerdown fuera de
 * esos elementos, solo si es la capa de arriba. Escape queda marcado con `preventDefault` para que ninguna otra
 * capa (tampoco las legacy, que miran `defaultPrevented`) lo atienda dos veces.
 */
export function useLayer(
  activa: boolean,
  onDismiss: (motivo: "escape" | "afuera") => void,
  dentro?: React.RefObject<HTMLElement | null>[],
) {
  const cb = React.useRef(onDismiss);
  const refs = React.useRef(dentro);
  React.useEffect(() => {
    cb.current = onDismiss;
    refs.current = dentro;
  });

  React.useEffect(() => {
    if (!activa) return;
    const yo = Symbol("capa");
    pila.push(yo);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || !esTope(yo)) return;
      e.preventDefault();
      cb.current("escape");
    };
    const onDown = (e: PointerEvent) => {
      const lista = refs.current;
      if (!lista || !esTope(yo)) return;
      const t = e.target as Node;
      if (lista.some((r) => r.current?.contains(t))) return;
      cb.current("afuera");
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      const i = pila.indexOf(yo);
      if (i >= 0) pila.splice(i, 1);
    };
  }, [activa]);
}

/** Mantiene montada una capa durante su animación de salida. `cerrando` sirve para elegir la clase de salida. */
export function usePresence(abierta: boolean, ms = 160) {
  const [cerrando, setCerrando] = React.useState(false);
  const [prev, setPrev] = React.useState(abierta);
  // Ajuste durante el render ante un cambio de prop (patrón documentado por React), igual que ui/overlay.ts.
  if (prev !== abierta) {
    setPrev(abierta);
    setCerrando(prev && !abierta);
  }
  React.useEffect(() => {
    if (!cerrando) return;
    const t = setTimeout(() => setCerrando(false), ms);
    return () => clearTimeout(t);
  }, [cerrando, ms]);
  return { montada: abierta || cerrando, cerrando };
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Las paradas de Tab de una raíz, en orden: visibles, fuera de `inert`, y un grupo de radios cuenta como una sola. */
export function focusables(raiz: HTMLElement): HTMLElement[] {
  const todos = Array.from(raiz.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[inert]") && el.getClientRects().length > 0,
  );
  return paradasDeTab(todos, (el) =>
    el instanceof HTMLInputElement && el.type === "radio" ? { name: el.name, checked: el.checked } : null,
  );
}

/** La capa de primer nivel de `#crm-portal` que contiene a un nodo (o null si está en la página). */
const capaDe = (n: Node | null) => (n instanceof Element ? n.closest("#crm-portal > *") : null);

/**
 * Foco de una capa modal (drawer, diálogo): al abrir enfoca `[data-autofocus]`, si no el primer enfocable de
 * `[data-focus-scope]` (el cuerpo del drawer: el primer campo, no el botón de cerrar del header), si no el primer
 * enfocable, si no el panel; Tab y Shift+Tab quedan atrapados adentro; al cerrar vuelve al elemento que tenía el foco antes.
 *
 * Además hay una cerca (`focusin`): si el foco cae fuera del panel y fuera de una capa abierta DESPUÉS (un menú, un
 * select o un popover que el propio drawer abrió), vuelve adentro. Así un Tab desde un menú portalizado cuyo
 * disparador era el último enfocable no se escapa a la página.
 */
export function useModalFocus(ref: React.RefObject<HTMLElement | null>, activa: boolean) {
  React.useEffect(() => {
    if (!activa) return;
    const panel = ref.current;
    if (!panel) return;
    const previo = document.activeElement as HTMLElement | null;
    const zona = panel.querySelector<HTMLElement>("[data-focus-scope]");
    const inicial =
      panel.querySelector<HTMLElement>("[data-autofocus]") ?? (zona && focusables(zona)[0]) ?? focusables(panel)[0] ?? panel;
    inicial.focus();
    const miCapa = capaDe(panel);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const lista = focusables(panel);
      if (lista.length === 0) {
        e.preventDefault();
        return;
      }
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primero || !panel.contains(activo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (activo === ultimo || !panel.contains(activo))) {
        e.preventDefault();
        primero.focus();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as Node;
      if (panel.contains(t)) return;
      const capa = capaDe(t);
      // Una capa posterior a la mía (abierta desde adentro, o una confirmación encima) puede tener el foco.
      if (capa && miCapa && capa !== miCapa && miCapa.compareDocumentPosition(capa) & Node.DOCUMENT_POSITION_FOLLOWING) return;
      const lista = focusables(panel);
      const volverAlFinal = e.relatedTarget === lista[0];
      (volverAlFinal ? lista[lista.length - 1] : lista[0] ?? panel)?.focus();
    };
    panel.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      panel.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      // Si el elemento de origen ya no existe (p. ej. la fila se borró), el foco queda donde el navegador lo deje.
      if (previo?.isConnected) previo.focus();
    };
  }, [ref, activa]);
}

let bloqueos = 0;
let overflowPrevio = "";

/**
 * Bloquea el scroll del documento mientras haya una capa modal abierta (con contador: un diálogo sobre un drawer
 * no lo libera antes de tiempo). `[data-app-main]` (donde scrollea el shell) NO se toca: el scrim tapa la rueda, el
 * foco está atrapado y esconder su barra correría el layout.
 */
export function useScrollLock(activa: boolean) {
  React.useEffect(() => {
    if (!activa) return;
    if (bloqueos++ === 0) {
      overflowPrevio = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (--bloqueos === 0) document.body.style.overflow = overflowPrevio;
    };
  }, [activa]);
}

/** Buffer de tipeo (typeahead) de 500 ms para menús y listas: devuelve el texto acumulado con cada tecla. */
export function useTypeahead() {
  const buffer = React.useRef({ texto: "", t: 0 });
  return React.useCallback((tecla: string) => {
    buffer.current = acumularTipeo(buffer.current, tecla, Date.now());
    return buffer.current.texto;
  }, []);
}

// Sin medir: opacidad 0 (no visibility:hidden, que impediría darle el foco al primer item en el mismo commit).
export type Posicion = { top: number; left: number; minWidth: number; opacity?: 0 };

/**
 * Posición `fixed` de un panel bajo su disparador: se da vuelta hacia arriba si no entra abajo, no se sale de la
 * pantalla y se recalcula con scroll y resize. Mide el panel real (no hace falta pasar su alto).
 * `align: "end"` lo alinea al borde derecho del disparador (menús de fila).
 */
export function useAnchor(
  trigger: React.RefObject<HTMLElement | null>,
  panel: React.RefObject<HTMLElement | null>,
  abierto: boolean,
  { align = "start", matchWidth = false }: { align?: "start" | "end"; matchWidth?: boolean } = {},
) {
  const [pos, setPos] = React.useState<Posicion>({ top: 0, left: 0, minWidth: 0, opacity: 0 });

  const medir = React.useCallback(() => {
    const t = trigger.current;
    const p = panel.current;
    if (!t || !p) return;
    const r = t.getBoundingClientRect();
    const alto = p.offsetHeight;
    const ancho = Math.max(p.offsetWidth, matchWidth ? r.width : 0);
    const abajo = r.bottom + 4;
    const arriba = r.top - alto - 4;
    const top = abajo + alto > window.innerHeight - 8 && arriba > 8 ? arriba : abajo;
    const deseado = align === "end" ? r.right - ancho : r.left;
    const left = Math.max(8, Math.min(deseado, window.innerWidth - ancho - 8));
    setPos({ top, left, minWidth: matchWidth ? r.width : 0 });
  }, [trigger, panel, align, matchWidth]);

  React.useLayoutEffect(() => {
    if (!abierto) return;
    // Medir el DOM y posicionar antes de pintar: el caso para el que existe useLayoutEffect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    medir();
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
      setPos((p) => ({ ...p, opacity: 0 }));
    };
  }, [abierto, medir]);

  return pos;
}
