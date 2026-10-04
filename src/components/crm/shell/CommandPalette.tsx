"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Boxes, Building2, Contact, CornerDownLeft, Handshake, Loader2, Search, X } from "lucide-react";
import { buscarGlobal } from "@/app/(app)/buscar/actions";
import { backdropClose } from "@/components/ui/backdropClose";
import {
  DEBOUNCE_MS,
  GRUPOS,
  MIN_CARACTERES,
  accionesRapidas,
  anuncio,
  aplanar,
  consultaBuscable,
  gruposPermitidos,
  moverIndice,
  type GrupoClave,
  type GrupoResultados,
  type RespuestaBusqueda,
} from "@/lib/paleta";
import { CrmPortal } from "../portal";
import { usePresence } from "../overlay";
import { IconButton } from "../Button";
import { TYPE, UI_ROOT, cn } from "../cx";

const ICONO_GRUPO: Record<GrupoClave | "ir", React.ElementType> = {
  empresas: Building2,
  contactos: Contact,
  oportunidades: Handshake,
  productos: Boxes,
  ir: ArrowRight,
};

type Resultado = { consulta: string; grupos: GrupoResultados[]; error: string | null };

/**
 * Búsqueda global (Ctrl/Cmd+K) con la piel de CRM 2.0. MISMO comportamiento y contrato ARIA que la paleta anterior
 * (`PaletaBusqueda`, retirada en la Etapa 2): la lógica es la de `lib/paleta.ts` y los datos, la Server Action
 * `buscarGlobal` (la RLS decide qué ve cada uno; acá solo se dibuja).
 *
 * - Diálogo "Buscar en el CRM" (`aria-modal`, `data-paleta`: el atajo lo reconoce como propio) con un combobox
 *   "Buscar" + listbox: el foco se queda en el campo, ↑/↓ mueven la opción activa (`aria-activedescendant`), Enter abre,
 *   Escape cierra. Tab queda atrapado entre el campo y "Cerrar la búsqueda"; al cerrar, el foco vuelve a donde estaba
 *   (o al disparador visible, `[data-paleta-disparador]`).
 * - Desde 2 letras, 200 ms de espera, hasta 5 por grupo, grupos según permisos; una respuesta tardía se descarta.
 * - Con la caja vacía ofrece "Ir a …" las pantallas que el rol puede abrir. Durante una composición (IME) las teclas
 *   son del teclado de la persona.
 * - En `#crm-portal` (hereda los tokens); en pantallas chicas, hoja a todo el ancho y alto.
 */
export function CommandPalette({ abierta, onCerrar, permisos }: { abierta: boolean; onCerrar: () => void; permisos: string[] }) {
  const { montada, cerrando } = usePresence(abierta, 160); // = --crm-dur
  if (!montada) return null;
  return (
    <CrmPortal>
      <Panel abierta={abierta} cerrando={cerrando} onCerrar={onCerrar} permisos={permisos} />
    </CrmPortal>
  );
}

function Panel({
  abierta,
  cerrando,
  onCerrar,
  permisos,
}: {
  abierta: boolean;
  cerrando: boolean;
  onCerrar: () => void;
  permisos: string[];
}) {
  const router = useRouter();
  const idLista = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cerrarRef = React.useRef<HTMLButtonElement>(null);
  // Quién tenía el foco al abrir: se lee en el primer render, antes de que el campo lo tome.
  const [previo] = React.useState(() => (typeof document === "undefined" ? null : document.activeElement));

  const [texto, setTexto] = React.useState("");
  const [resultado, setResultado] = React.useState<Resultado | null>(null);
  const [activo, setActivo] = React.useState(0);

  const consulta = consultaBuscable(texto);

  // Consulta con espera. Cada cambio de `consulta` cancela la anterior: su respuesta, si llega, se ignora.
  React.useEffect(() => {
    if (!consulta) return;
    let cancelado = false;
    const guardar = (r: Resultado) => {
      if (!cancelado) setResultado(r);
    };
    const t = setTimeout(async () => {
      try {
        const r: RespuestaBusqueda = await buscarGlobal(consulta);
        guardar(r.ok ? { consulta, grupos: r.grupos, error: null } : { consulta, grupos: [], error: r.error });
      } catch {
        guardar({ consulta, grupos: [], error: "No se pudo buscar. Revisá tu conexión y probá de nuevo." });
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [consulta]);

  // Al cerrar, el foco vuelve a donde estaba (o al botón de búsqueda visible si ese elemento ya no está).
  React.useEffect(() => {
    if (abierta) return;
    const destino =
      previo instanceof HTMLElement && previo !== document.body && document.contains(previo)
        ? previo
        : [...document.querySelectorAll<HTMLElement>("[data-paleta-disparador]")].find((el) => el.offsetParent !== null);
    destino?.focus();
  }, [abierta, previo]);

  const cargando = consulta !== null && resultado?.consulta !== consulta;
  const mostrados = React.useMemo(() => (consulta && resultado ? resultado.grupos : []), [consulta, resultado]);
  const error = consulta && resultado?.consulta === consulta ? resultado.error : null;
  const acciones = React.useMemo(() => accionesRapidas(permisos, texto.trim(), consulta ? 3 : 8), [permisos, texto, consulta]);
  const opciones = React.useMemo(() => aplanar(mostrados, acciones), [mostrados, acciones]);
  const indice = opciones.length ? Math.min(activo, opciones.length - 1) : -1;
  const sinResultados = consulta !== null && !cargando && !error && mostrados.length === 0;

  const idOpcion = (i: number) => `${idLista}-op-${i}`;

  React.useEffect(() => {
    if (indice >= 0) document.getElementById(`${idLista}-op-${indice}`)?.scrollIntoView({ block: "nearest" });
  }, [indice, idLista]);

  function ir(i: number) {
    const op = opciones[i];
    if (!op) return;
    onCerrar();
    router.push(op.href);
  }

  function alTeclear(e: React.KeyboardEvent) {
    // Mientras se compone un caracter (IME), Enter y las flechas son del teclado de la persona, no nuestras.
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCerrar();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActivo(moverIndice(indice, e.key === "ArrowDown" ? 1 : -1, opciones.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Con una consulta en camino, Enter abriría una acción que la persona no eligió.
      if (!cargando) ir(indice);
    } else if (e.key === "Tab") {
      // Atrapa el foco: solo hay dos cosas enfocables.
      const primero = inputRef.current;
      const ultimo = cerrarRef.current;
      if (!primero || !ultimo) return;
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
  }

  const buscables = GRUPOS.filter((g) => gruposPermitidos(permisos).includes(g.clave)).map((g) => g.titulo.toLowerCase());
  const placeholder = buscables.length ? `Buscar ${buscables.join(", ")}…` : "Ir a una pantalla…";

  // Grupos visibles con el índice de su primera opción, para numerar las filas.
  let corrida = 0;
  const secciones = [
    ...mostrados.map((g) => ({ clave: g.clave, titulo: g.titulo, filas: g.resultados.length })),
    ...(acciones.length ? [{ clave: "ir" as const, titulo: "Ir a", filas: acciones.length }] : []),
  ].map((s) => {
    const inicio = corrida;
    corrida += s.filas;
    return { ...s, inicio };
  });

  return (
    <div
      data-app-chrome
      className={cn(
        UI_ROOT,
        "fixed inset-0 z-(--crm-z-dialog) flex items-start justify-center bg-(--crm-scrim) sm:p-4 sm:pt-[12vh]",
        cerrando ? "animate-[crm-fade_var(--crm-dur)_var(--crm-ease)_reverse_forwards]" : "animate-[crm-fade_var(--crm-dur)_var(--crm-ease)]",
        "motion-reduce:animate-none",
      )}
      {...backdropClose(onCerrar)}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-paleta=""
        aria-label="Buscar en el CRM"
        onKeyDown={alTeclear}
        className={cn(
          "flex h-dvh w-full flex-col overflow-hidden bg-(--crm-panel) sm:h-auto sm:max-h-[min(34rem,76vh)] sm:max-w-[600px] sm:rounded-(--crm-radius) sm:border sm:border-(--crm-border) sm:shadow-(--crm-shadow-float)",
          !cerrando && "animate-[crm-pop_var(--crm-dur)_var(--crm-ease)] motion-reduce:animate-none",
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-(--crm-border) pl-4 pr-2">
          <Search aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-(--crm-text-2)" />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            role="combobox"
            aria-label="Buscar"
            aria-expanded={opciones.length > 0}
            aria-controls={idLista}
            aria-autocomplete="list"
            aria-activedescendant={indice >= 0 ? idOpcion(indice) : undefined}
            value={texto}
            maxLength={100}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder={placeholder}
            onChange={(e) => {
              setTexto(e.target.value);
              setActivo(0);
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-(--crm-text) outline-none placeholder:text-(--crm-text-2) sm:text-[14px]"
          />
          {cargando && (
            <Loader2 aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 animate-spin text-(--crm-text-2) motion-reduce:animate-none" />
          )}
          <IconButton ref={cerrarRef} label="Cerrar la búsqueda" icon={X} onClick={onCerrar} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {texto.trim().length > 0 && texto.trim().length < MIN_CARACTERES && (
            <p className={cn(TYPE.meta, "px-3 py-2 text-(--crm-text-2)")}>Escribí al menos {MIN_CARACTERES} letras para buscar.</p>
          )}
          {error && (
            <p role="alert" className="m-1 rounded-(--crm-radius-sm) border border-(--crm-danger)/25 bg-(--crm-danger-tint) px-3 py-2">
              {error}
            </p>
          )}
          {sinResultados && (
            <div className="px-3 py-4">
              <p className="font-medium">Nada con «{consulta}»</p>
              <p className={cn(TYPE.meta, "mt-1 text-(--crm-text-2)")}>
                Probá con el nombre completo, el CUIT, el mail o el título de la oportunidad.
              </p>
            </div>
          )}

          <div id={idLista} role="listbox" aria-label="Resultados" aria-busy={cargando}>
            {secciones.map((s) => {
              const Icono = ICONO_GRUPO[s.clave];
              const idTitulo = `${idLista}-g-${s.clave}`;
              return (
                <div key={s.clave} role="group" aria-labelledby={idTitulo} className="pb-1">
                  <div id={idTitulo} className={cn(TYPE.meta, "px-3 pb-1 pt-2 font-medium text-(--crm-text-2)")}>
                    {s.titulo}
                  </div>
                  {opciones.slice(s.inicio, s.inicio + s.filas).map((op, k) => {
                    const i = s.inicio + k;
                    const seleccionada = i === indice;
                    return (
                      <div
                        key={op.id}
                        id={idOpcion(i)}
                        role="option"
                        aria-selected={seleccionada}
                        data-active={seleccionada}
                        onMouseMove={() => setActivo(i)}
                        onClick={() => ir(i)}
                        className={cn(
                          "flex min-h-9 cursor-pointer items-center gap-3 rounded-(--crm-radius-sm) px-3 py-1",
                          "hover:bg-(--crm-hover) data-[active=true]:bg-(--crm-pressed) data-[active=true]:shadow-[inset_2px_0_0_var(--crm-accent)]",
                        )}
                      >
                        <Icono aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-(--crm-text-2)" />
                        {/* En mobile el detalle va debajo; desde sm, al lado (el título no se recorta por el detalle). */}
                        <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-2">
                          <span className="truncate font-medium sm:max-w-[60%] sm:shrink-0">{op.titulo}</span>
                          {op.detalle && <span className={cn(TYPE.meta, "min-w-0 truncate text-(--crm-text-2)")}>{op.detalle}</span>}
                        </span>
                        {seleccionada && (
                          <CornerDownLeft aria-hidden="true" strokeWidth={1.75} className="hidden size-3.5 shrink-0 text-(--crm-text-2) sm:block" />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <p className={cn(TYPE.meta, "hidden shrink-0 items-center gap-4 border-t border-(--crm-border) px-4 py-2 text-(--crm-text-2) sm:flex")}>
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> para moverte
          </span>
          <span>
            <Kbd>Enter</Kbd> para abrir
          </span>
          <span>
            <Kbd>Esc</Kbd> para cerrar
          </span>
        </p>

        <p role="status" className="sr-only">
          {anuncio(cargando ? "cargando" : error ? "error" : consulta ? "listo" : "inactivo", opciones.length - acciones.length)}
        </p>
      </div>
    </div>
  );
}

/** Tecla dibujada (decorativa: el texto de al lado ya la nombra). */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-(--crm-radius-sm) border border-(--crm-border) bg-(--crm-panel) px-1 font-(family-name:--crm-font-mono) text-[12px] leading-4 text-(--crm-text-2)">
      {children}
    </kbd>
  );
}
