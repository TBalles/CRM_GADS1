"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PanelRight } from "lucide-react";
import type { FiltrosUrl } from "@/components/FiltrosUrl";
import { TAMANIO_POR_DEFECTO, TAMANIOS_PAGINA, urlConParams } from "@/lib/paginacion";
import { buttonClass } from "./Button";
import { LoadingStatus } from "./Feedback";
import type { MenuItem } from "./Menu";
import { Pagination } from "./Pagination";
import { Select } from "./Select";
import { Tooltip } from "./Tooltip";
import { hayCapaAbierta } from "./overlay";
import { filaTrasRefresco, vecinoSel } from "./seleccion";
import { cn } from "./cx";

/**
 * Lo que comparten las listas de CRM 2.0 (Empresas, Contactos, Productos; MASTER.md §10.13–§10.14): la banda de pie con
 * la paginación, el foco después de una acción que saca una fila, y el master-detail por URL (`?sel=`) con su vista
 * previa. La lógica pura (↑/↓, fila siguiente) está en `seleccion.ts`.
 */

/** Desde acá hay vista previa (master-detail); debajo, la fila abre la ficha. Igual que `xl` de Tailwind. */
export const MASTER_DETAIL = "(min-width: 1280px)";
/** Con la tecla apretada (↓↓↓) se navega una sola vez, a la última fila, cuando las flechas paran este tiempo. */
const ESPERA_FLECHAS_MS = 200;
/** Las acciones de una fila que pueden sacarla de la lista (según el filtro de bajas). */
const ACCIONES_DE_ESTADO = new Set(["Dar de baja", "Reactivar"]);

/**
 * Banda de pie de una lista, pegada abajo del área de trabajo: "Mostrando N–M de T", la paginación y "Filas por página"
 * (mismo contrato que `Paginacion`). La tabla queda a su alto natural y el rango no flota. Sin filas, nada.
 */
export function ListFooter({ filtros, total, page, pageSize }: { filtros: FiltrosUrl; total: number; page: number; pageSize: number }) {
  if (total <= 0) return null;
  return (
    <div className="-mx-4 mt-auto flex min-h-10 shrink-0 items-center border-t border-(--crm-border) bg-(--crm-panel) px-4 py-1 xl:-mx-6 xl:px-6">
      <Pagination
        total={total}
        page={page}
        pageSize={pageSize}
        pathname={filtros.pathname}
        params={filtros.params}
        ir={filtros.ir}
        className="w-full"
        pageSizeControl={
          total > TAMANIOS_PAGINA[0] && (
            <Select
              dense
              aria-label="Filas por página"
              // 16 px en celular (inputs sin zoom de iOS): "20 por página" necesita más ancho.
              className="w-36 max-sm:w-44"
              value={String(pageSize)}
              onChange={(v) => filtros.aplicar({ pageSize: v === String(TAMANIO_POR_DEFECTO) ? null : v })}
              options={TAMANIOS_PAGINA.map((n) => ({ value: String(n), label: `${n} por página` }))}
            />
          )
        }
      />
    </div>
  );
}

/**
 * Foco de la grilla. `tabla` es el ref del contenedor de la `DataTable` y `buscador` el de alrededor del `SearchField`
 * (los crea la pantalla: el compilador de React no deja leer refs que vienen dentro de lo que devuelve un hook).
 *
 * Después de "Dar de baja" o "Reactivar" desde el `⋮` de una fila, la lista vuelve del servidor y la fila puede no estar
 * más. Si sale o no depende del filtro (bajas escondidas, un estado elegido a mano) y, al reactivar, de algo que solo
 * sabe la base (vuelve como Cliente o como Potencial): por eso no se predice, se MIRA la lista que volvió
 * (`filaTrasRefresco`): el foco va a la misma fila si sigue, si no a la siguiente (o la anterior) que siga, y si la
 * lista quedó vacía, al buscador. La intención se anota al elegir la acción (`conFoco`) y se aplica recién cuando la
 * mutación terminó (`trasCambio`, antes del refresco): cancelar la confirmación no deja un foco pendiente.
 */
export function useFocoFilas(
  filas: readonly { id: string }[],
  {
    tabla,
    buscador,
    acciones = ACCIONES_DE_ESTADO,
  }: {
    tabla: React.RefObject<HTMLDivElement | null>;
    buscador: React.RefObject<HTMLDivElement | null>;
    /** Las acciones del `⋮` que pueden sacar la fila (por defecto "Dar de baja" y "Reactivar"; Oportunidades: cerrar, mover). */
    acciones?: ReadonlySet<string>;
  },
) {
  type Intencion = { id: string; antes: string[] };
  const intencion = React.useRef<Intencion | null>(null);
  const pendiente = React.useRef<Intencion | null>(null);

  /** Foco al nombre de la fila (Enter ahí abre la ficha) o, si la fila no tiene link, a su `⋮`. Una fila es una `tr` o una
   *  tarjeta del tablero: cualquier elemento con `data-id` dentro de `tabla`. */
  const enfocarFila = React.useCallback((id: string) => {
    const fila = `[data-id="${CSS.escape(id)}"]`;
    tabla.current?.querySelector<HTMLElement>(`${fila} [data-nombre], ${fila} [aria-haspopup="menu"]`)?.focus();
  }, [tabla]);

  React.useEffect(() => {
    const p = pendiente.current;
    if (!p) return;
    pendiente.current = null;
    const destino = filaTrasRefresco(p.antes, filas.map((f) => f.id), p.id);
    if (destino) enfocarFila(destino);
    else buscador.current?.querySelector("input")?.focus();
  }, [filas, enfocarFila, buscador]);

  return {
    enfocarFila,
    /** Los items del `⋮` de la fila `id`: "Dar de baja" y "Reactivar" anotan a dónde irá el foco si terminan mutando. */
    conFoco(items: MenuItem[], id: string): MenuItem[] {
      const antes = filas.map((f) => f.id);
      return items.map((it) => ({
        ...it,
        onSelect: () => {
          intencion.current = acciones.has(it.label) ? { id, antes } : null;
          it.onSelect();
        },
      }));
    },
    /** Una acción que no viene de una fila ("Nueva…"): no lleva el foco a ninguna fila. */
    olvidar() {
      intencion.current = null;
    },
    /** La mutación terminó (lo llama `alCambiar`, antes de refrescar la lista). */
    trasCambio() {
      pendiente.current = intencion.current;
      intencion.current = null;
    },
  };
}

/**
 * Master-detail por URL (MASTER.md §10.13). La selección es `?sel=`; para que la fila marcada se mueva al instante, la
 * lista muestra una selección optimista (`selVista`) mientras la navegación está en vuelo y la suelta cuando el servidor
 * contesta con ese mismo `sel` (o cuando la URL cambia por otro camino: atrás/adelante). No hay otra copia del estado.
 *
 * - ↑/↓ (`alTeclado`, en el contenedor de la tabla) cuentan desde la fila CON FOCO, con una sola navegación al soltar.
 * - Esc quita `sel` si no hay una capa abierta (su listener corre antes que el de un menú o drawer abierto después).
 * - Debajo de 1280 no hay panel: la fila abre la ficha y un `?sel=` en la URL se quita con `router.replace`.
 */
export function useSeleccionUrl({
  sel,
  ids,
  filtros,
  ficha,
  enfocarFila,
}: {
  /** El `sel` del servidor, ya validado como uuid. */
  sel: string | null;
  /** Las filas de la página, en orden. */
  ids: readonly string[];
  filtros: FiltrosUrl;
  /** La ruta de la ficha de una fila. */
  ficha: (id: string) => string;
  enfocarFila: (id: string) => void;
}) {
  const router = useRouter();
  const timer = React.useRef<number | undefined>(undefined);
  const [navegando, startNav] = React.useTransition();

  // Selección que se VE. `pedido`: lo último que se mandó a la URL (undefined = nada en vuelo; null = cerrar).
  const [vista, setVista] = React.useState<{ sel: string | null; base: string | null; pedido: string | null | undefined }>({
    sel,
    base: sel,
    pedido: undefined,
  });
  if (vista.base !== sel) {
    // La URL cambió. Si es la respuesta a lo último pedido (o un cambio ajeno: atrás/adelante), se sigue a la URL;
    // si es la respuesta a un pedido VIEJO (las flechas siguieron), se mantiene lo que la persona ya está viendo.
    const enVuelo = vista.pedido !== undefined && vista.pedido !== sel;
    setVista({ sel: enVuelo ? vista.sel : sel, base: sel, pedido: enVuelo ? vista.pedido : undefined });
  }
  const selVista = vista.sel;

  const hrefSel = (id: string | null) => urlConParams(filtros.pathname, filtros.params, { sel: id });

  /** Elige (o quita, con null) la vista previa: marca al instante y navega (ya, o al soltar las flechas). */
  function elegir(id: string | null, { esperar = false } = {}) {
    setVista((v) => ({ ...v, sel: id, pedido: id }));
    window.clearTimeout(timer.current);
    const ir = () => startNav(() => router.push(hrefSel(id), { scroll: false }));
    if (esperar) timer.current = window.setTimeout(ir, ESPERA_FLECHAS_MS);
    else ir();
  }
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  // Esc cierra la vista previa. Este listener se registra ANTES que el de un menú o drawer que se abra después (mismo
  // `document`, orden de registro), así que no alcanza con `defaultPrevented`: si hay una capa abierta, el Esc es suyo.
  React.useEffect(() => {
    if (!selVista) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (hayCapaAbierta() || document.querySelector('[aria-modal="true"]')) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, [contenteditable], [role="menu"], [role="listbox"], [role="dialog"]')) return;
      if (!window.matchMedia(MASTER_DETAIL).matches) return;
      e.preventDefault();
      const cerrada = selVista;
      elegir(null);
      enfocarFila(cerrada);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // Debajo de 1280 no hay vista previa: un `?sel=` (link directo, ventana que se achica) se quita de la URL para que
  // el servidor deje de dibujar un panel que no se ve. Un link con `sel` abierto en una pantalla ancha no se toca.
  React.useEffect(() => {
    const mq = window.matchMedia(MASTER_DETAIL);
    const quitar = () => {
      if (!mq.matches && sel) router.replace(urlConParams(filtros.pathname, filtros.params, { sel: null }), { scroll: false });
    };
    quitar();
    mq.addEventListener("change", quitar);
    return () => mq.removeEventListener("change", quitar);
  }, [sel, router, filtros.pathname, filtros.params]);

  return {
    selVista,
    /** Mientras la vista previa nueva está en camino (la vieja se atenúa). */
    cargandoPanel: navegando || vista.pedido !== undefined,
    hrefSel,
    elegir,
    /** ↑/↓ mueven la selección desde la fila CON FOCO. Solo con vista previa (≥ 1280). Va en el contenedor de la tabla. */
    alTeclado(e: React.KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const objetivo = e.target as HTMLElement;
      const fila = objetivo.closest<HTMLElement>("tr[data-id]");
      if (!fila || objetivo.closest("[aria-haspopup]")) return;
      if (!window.matchMedia(MASTER_DETAIL).matches) return;
      e.preventDefault();
      const destino = vecinoSel(ids, selVista, fila.dataset.id ?? null, e.key === "ArrowDown" ? "next" : "prev");
      if (!destino) return;
      enfocarFila(destino);
      if (destino !== selVista) elegir(destino, { esperar: true });
    },
    /** Clic en la fila (fuera de sus links y botones): ≥ 1280 la elige; debajo abre la ficha. */
    alClickFila(ev: React.MouseEvent, id: string) {
      if ((ev.target as HTMLElement).closest("a, button, input")) return;
      if (window.matchMedia(MASTER_DETAIL).matches) elegir(id);
      else router.push(ficha(id));
    },
  };
}

/** Sin vista previa (< 1280) un `?sel=` no se marca: la fila no tiene panel al que apuntar. Va en el `Tr` seleccionable. */
export const FILA_SELECCIONABLE =
  "cursor-pointer max-xl:data-selected:bg-transparent max-xl:data-selected:hover:bg-(--crm-hover) max-xl:data-selected:[&>td:first-child]:shadow-none";

/**
 * Elegir una fila para la vista previa: link real (`?sel=`, se puede abrir en otra pestaña), solo desde 1280. Fuera del
 * orden de Tab: con teclado se elige con ↑/↓ (y Enter en el nombre abre la ficha). Va en `CellActions`.
 */
export function LinkVistaPrevia({ href, nombre, onPreview }: { href: string; nombre: string; onPreview: () => void }) {
  return (
    <Tooltip content="Vista previa">
      <Link
        href={href}
        scroll={false}
        tabIndex={-1}
        data-preview
        aria-label={`Vista previa de ${nombre}`}
        onClick={(ev) => {
          if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
          ev.preventDefault();
          onPreview();
        }}
        className={buttonClass({ variant: "ghost", size: "sm", className: "hidden w-7 px-0 xl:inline-flex" })}
      >
        <PanelRight aria-hidden="true" strokeWidth={1.75} />
      </Link>
    </Tooltip>
  );
}

/** El lugar de la vista previa que llega del servidor; mientras la nueva está en camino, la vieja se atenúa y avisa. */
export function PanelVistaPrevia({ cargando, children }: { cargando: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-busy={cargando || undefined}
      className={cn("hidden min-h-0 transition-opacity duration-(--crm-dur-fast) xl:flex", cargando && "opacity-60 motion-reduce:transition-none")}
    >
      {cargando && <LoadingStatus label="Cargando vista previa…" />}
      {children}
    </div>
  );
}
