"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Boxes, Building2, Contact, CornerDownLeft, Handshake, Loader2, Search, X } from "lucide-react";
import { buscarGlobal } from "@/app/(app)/buscar/actions";
import { backdropClose } from "@/components/ui/backdropClose";
import { useModalAnimation } from "@/components/ui/overlay";
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
import { cn } from "@/lib/utils";

const ICONO_GRUPO: Record<GrupoClave | "ir", React.ElementType> = {
  empresas: Building2,
  contactos: Contact,
  oportunidades: Handshake,
  productos: Boxes,
  ir: ArrowRight,
};

type Resultado = { consulta: string; grupos: GrupoResultados[]; error: string | null };

/**
 * Búsqueda global (Ctrl/Cmd+K): un diálogo con el patrón combobox + listbox de ARIA.
 *
 * - El foco se queda en el campo; las flechas mueven la opción activa (`aria-activedescendant`),
 *   Enter la abre y Escape cierra. Tab queda atrapado entre el campo y el botón de cerrar, y al
 *   cerrar el foco vuelve a donde estaba.
 * - Consulta con 200 ms de espera, desde 2 letras, a UNA Server Action. Una respuesta que llega
 *   tarde (la persona ya escribió otra cosa) se descarta: `cancelado` en el cleanup del efecto.
 * - Con la caja vacía ofrece "Ir a …" las pantallas que el rol puede abrir.
 * - En pantallas chicas es una hoja a todo el ancho y alto.
 *
 * Todo lo que ve la persona lo decide la RLS en la acción; acá solo se dibuja.
 */
export default function PaletaBusqueda({
  abierta,
  onCerrar,
  permisos,
}: {
  abierta: boolean;
  onCerrar: () => void;
  permisos: string[];
}) {
  const { visible, overlayClass, modalClass } = useModalAnimation(abierta);
  if (!visible) return null;
  return createPortal(
    <Panel abierta={abierta} onCerrar={onCerrar} permisos={permisos} overlayClass={overlayClass} modalClass={modalClass} />,
    document.body,
  );
}

function Panel({
  abierta,
  onCerrar,
  permisos,
  overlayClass,
  modalClass,
}: {
  abierta: boolean;
  onCerrar: () => void;
  permisos: string[];
  overlayClass: string;
  modalClass: string;
}) {
  const router = useRouter();
  const idLista = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  // Quién tenía el foco al abrir: se lee en el primer render, antes de que el campo lo tome.
  const [previo] = useState(() => (typeof document === "undefined" ? null : document.activeElement));

  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [activo, setActivo] = useState(0);

  const consulta = consultaBuscable(texto);

  // Consulta con espera. Cada cambio de `consulta` cancela la anterior: su respuesta, si llega, se ignora.
  useEffect(() => {
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

  // Al cerrar, el foco vuelve a donde estaba (o al botón de búsqueda si ese elemento ya no está).
  useEffect(() => {
    if (abierta) return;
    const destino =
      previo instanceof HTMLElement && previo !== document.body && document.contains(previo)
        ? previo
        : [...document.querySelectorAll<HTMLElement>("[data-paleta-disparador]")].find((el) => el.offsetParent !== null);
    destino?.focus();
  }, [abierta, previo]);

  const cargando = consulta !== null && resultado?.consulta !== consulta;
  const mostrados = useMemo(() => (consulta && resultado ? resultado.grupos : []), [consulta, resultado]);
  const error = consulta && resultado?.consulta === consulta ? resultado.error : null;
  const acciones = useMemo(
    () => accionesRapidas(permisos, texto.trim(), consulta ? 3 : 8),
    [permisos, texto, consulta],
  );
  const opciones = useMemo(() => aplanar(mostrados, acciones), [mostrados, acciones]);
  const indice = opciones.length ? Math.min(activo, opciones.length - 1) : -1;
  const sinResultados = consulta !== null && !cargando && !error && mostrados.length === 0;

  const idOpcion = (i: number) => `${idLista}-op-${i}`;

  useEffect(() => {
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
      className={cn("fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm sm:p-4 sm:pt-[12vh]", overlayClass)}
      {...backdropClose(onCerrar)}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-paleta=""
        aria-label="Buscar en el CRM"
        onKeyDown={alTeclear}
        className={cn(
          modalClass,
          "flex h-dvh w-full flex-col overflow-hidden bg-background shadow-2xl sm:h-auto sm:max-h-[min(34rem,76vh)] sm:max-w-xl sm:rounded-xl sm:border sm:border-border",
        )}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3">
          <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
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
            className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          />
          {cargando && <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />}
          <button
            ref={cerrarRef}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar la búsqueda"
            title="Cerrar (Esc)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {texto.trim().length > 0 && texto.trim().length < MIN_CARACTERES && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Escribí al menos {MIN_CARACTERES} letras para buscar.</p>
          )}
          {error && (
            <p role="alert" className="mx-1 my-1.5 rounded-md bg-secondary p-3 text-sm">
              {error}
            </p>
          )}
          {sinResultados && (
            <div className="px-2 py-4 text-center">
              <p className="text-sm font-medium">Nada con «{consulta}»</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                Probá con el nombre completo, el CUIT, el mail o el título de la oportunidad.
              </p>
            </div>
          )}

          <div id={idLista} role="listbox" aria-label="Resultados" aria-busy={cargando}>
            {secciones.map((s) => {
              const Icono = ICONO_GRUPO[s.clave];
              const idTitulo = `${idLista}-g-${s.clave}`;
              return (
                <div key={s.clave} role="group" aria-labelledby={idTitulo} className="mb-1">
                  <div id={idTitulo} className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
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
                        onMouseMove={() => setActivo(i)}
                        onClick={() => ir(i)}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2",
                          seleccionada ? "bg-accent" : "hover:bg-accent/60",
                        )}
                      >
                        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                          <Icono className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{op.titulo}</span>
                          {op.detalle && <span className="block truncate text-xs text-muted-foreground">{op.detalle}</span>}
                        </span>
                        {seleccionada && <CornerDownLeft aria-hidden="true" className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <p className="hidden shrink-0 items-center gap-4 border-t border-border px-3 py-2 text-[11px] text-muted-foreground sm:flex">
          <span>↑ ↓ para moverte</span>
          <span>Enter para abrir</span>
          <span>Esc para cerrar</span>
        </p>

        <p role="status" className="sr-only">
          {anuncio(cargando ? "cargando" : error ? "error" : consulta ? "listo" : "inactivo", opciones.length - acciones.length)}
        </p>
      </div>
    </div>
  );
}
