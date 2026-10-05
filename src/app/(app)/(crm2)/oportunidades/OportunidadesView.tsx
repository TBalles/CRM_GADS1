"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, FileText, LayoutGrid, List, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/crm/Button";
import { DataTable, TBody, THead, Td, Th, TableMessage, Tr, CellActions, CellPerson } from "@/components/crm/DataTable";
import { EmptyState, InlineBanner } from "@/components/crm/Feedback";
import { ListFooter, useFocoFilas } from "@/components/crm/Lista";
import { Menu, type MenuItem } from "@/components/crm/Menu";
import { PageBar } from "@/components/crm/PageBar";
import { Avatar, StatusDot, Tag } from "@/components/crm/Status";
import { SegmentedControl } from "@/components/crm/Tabs";
import { ANCHO_FILTROS, FiltroOpciones, MasFiltros, SearchField, Toolbar } from "@/components/crm/Toolbar";
import { Tooltip } from "@/components/crm/Tooltip";
import { useCrmToast } from "@/components/crm/Toast";
import { FOCUS, TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { useApertura } from "@/components/crm/cuenta/FormDrawer";
import { EstadoOportunidad } from "@/components/crm/cuenta/estados";
import { Monto } from "@/components/crm/cuenta/SeccionesCuenta";
import { IconoEquipoSimple } from "@/components/Equipamiento";
import { AnuncioResultados, useFiltrosUrl } from "@/components/FiltrosUrl";
import { cambiarEtapa } from "@/lib/cambiarEtapa";
import { formatFecha, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import { datosApertura } from "@/lib/licitaciones";
import { formatMoneyCompact } from "@/lib/money";
import {
  accionesDisponibles,
  ESTADOS_OPORTUNIDAD,
  etapaRepiteEstado,
  etapasAbiertas,
  mensajeErrorOportunidad,
  type OpcionContacto,
  type OpcionEmpresa,
  type OpcionProducto,
} from "@/lib/oportunidades";
import type { Tables } from "@/lib/supabase/types";
import CierreDialog, { ACCION_CAMBIO, ACCIONES_QUE_MUEVEN, useCierre } from "./CierreDialog";
import OportunidadForm from "./OportunidadForm";

type Etapa = Tables<"etapas">;
type Oportunidad = Tables<"oportunidades">;
type Motivo = Pick<Tables<"motivos_perdida">, "id" | "nombre" | "activo" | "orden">;
type Licitacion = Tables<"licitaciones">;

export type OportunidadRow = Oportunidad & {
  empresa: { id: string; nombre: string } | null;
  contacto: { id: string; nombre: string; apellido: string | null } | null;
  producto: { id: string; nombre: string } | null;
  responsable: { id: string; nombre: string | null } | null;
};

export type Vista = "tablero" | "lista";

const SIN_RESPONSABLE = "sin";
const COLUMNAS = 8;
/** Columnas de ancho propio que cambian con el contenedor (los `Th` y sus `td` usan la misma clase de visibilidad). */
const COL = {
  empresa: "w-[184px] @[90rem]:w-[280px]",
  producto: "hidden w-[272px] @[90rem]:table-cell",
  etapa: "w-[200px]",
  responsable: "hidden w-[200px] @[72rem]:table-cell",
};
/** "Limpiar filtros" conserva la vista y el tamaño de página (como el legacy). */
const LIMPIAR_CONSERVA = ["vista", "pageSize"];
const TIPOS = [
  { value: "", label: "Todos los tipos" },
  { value: "directa", label: "Directas" },
  { value: "licitacion", label: "Licitaciones" },
];
const ESTADOS = [{ value: "todos", label: "Todos los estados" }, ...ESTADOS_OPORTUNIDAD.map((e) => ({ value: e.value, label: `${e.label}s` }))];

/**
 * Monto compacto ($1,5 M / $340 k, `formatMoneyCompact` como el tablero legacy) con la cifra en mono y el signo y la
 * unidad en gris (MASTER §4). Sin monto, "—".
 */
function MontoCompacto({ valor }: { valor: number }) {
  if (!valor) return <span className="text-(--crm-text-2)">—</span>;
  const m = /^(-?)\$(.+?)(?: (k|M))?$/.exec(formatMoneyCompact(valor));
  if (!m) return <span className={TYPE.mono}>{formatMoneyCompact(valor)}</span>;
  return (
    <span className="whitespace-nowrap">
      <span className={TYPE.unit}>{m[1]}$</span>
      <span className={TYPE.mono}>{m[2]}</span>
      {m[3] && <span className={TYPE.unit}> {m[3]}</span>}
    </span>
  );
}

function nombreCliente(o: OportunidadRow) {
  return o.empresa?.nombre ?? (o.contacto ? `${o.contacto.nombre} ${o.contacto.apellido ?? ""}`.trim() : null);
}

/**
 * Oportunidades (CRM 2.0, MASTER.md §10.19): el embudo como tablero (una columna por etapa abierta, a todo el alto del
 * área de trabajo, sin caja alrededor) o como lista (DataTable con banda de pie). La vista, la búsqueda, los filtros y
 * la página viven en la URL (`?vista=&q=&estado=&etapa=&responsable=&tipo=&origen=&page=`), igual que antes.
 *
 * Mover una tarjeta: arrastrar (HTML5 nativo, optimista con vuelta atrás si falla) o, con teclado y en táctil, el `⋮`
 * de la tarjeta → "Cambiar etapa" (el mismo diálogo de la ficha). Cada fila y tarjeta tiene su `⋮` "Acciones de
 * <título>": Ver detalle, Presupuesto, Editar y las acciones de etapa que su estado y el rol permiten (`accionesDisponibles`).
 */
export default function OportunidadesView({
  vista,
  etapas,
  oportunidades,
  total,
  tableroTruncado,
  tableroMax,
  page,
  pageSize,
  q,
  hayFiltros,
  cuentasOk,
  totalAbiertas,
  totalTodas,
  empresas,
  contactos,
  productos,
  perfiles,
  origenes,
  motivos,
  yoId,
  puedeEditar,
  puedeAsignar,
  puedeReabrir,
  puedeVerTodos,
  licitacionesActivas,
  licitaciones,
  avisoMigracion,
}: {
  /** Tablero o lista: vive en la URL (`?vista=`). */
  vista: Vista;
  etapas: Etapa[];
  /** Tablero: las abiertas (hasta `tableroMax`). Lista: solo la página actual. */
  oportunidades: OportunidadRow[];
  /** Coincidencias con los filtros, en todas las páginas. */
  total: number;
  tableroTruncado: boolean;
  tableroMax: number;
  page: number;
  pageSize: number;
  /** La búsqueda ya limpia, para repetirla en el "no hay resultados". */
  q: string;
  hayFiltros: boolean;
  /** Falso si algún conteo del encabezado falló: no se sabe si hay oportunidades, así que no se muestra el vacío de "primera vez". */
  cuentasOk: boolean;
  /** Abiertas y totales de la organización, sin filtros (para el encabezado). */
  totalAbiertas: number;
  totalTodas: number;
  empresas: OpcionEmpresa[];
  contactos: OpcionContacto[];
  productos: OpcionProducto[];
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  motivos: Motivo[];
  yoId: string;
  /** Permisos del rol. Solo UX: la base exige cada uno igual. */
  puedeEditar: boolean;
  puedeAsignar: boolean;
  puedeReabrir: boolean;
  /** `clientes.ver_todos`: sin el, la RLS ya deja solo la cartera propia y filtrar por responsable no tiene sentido. */
  puedeVerTodos: boolean;
  /** Las tablas del rubro (migracion 0011) existen en la base. Sin ellas no se ofrece el tipo "Licitacion". */
  licitacionesActivas: boolean;
  /** Datos de las licitaciones de lo que se ve, por id de oportunidad. */
  licitaciones: Record<string, Licitacion>;
  /** Falta la migración 0011 y quien mira administra la configuración. */
  avisoMigracion: boolean;
}) {
  const router = useRouter();
  const filtros = useFiltrosUrl();
  // Las filas salen del servidor. Se copian al estado solo para poder mover una tarjeta al instante (optimista);
  // cuando el servidor manda filas nuevas (otro filtro, otra página, un refresh) mandan ellas.
  const [items, setItems] = useState(oportunidades);
  const [recibidas, setRecibidas] = useState(oportunidades);
  // One entry per in-flight row, not a single shared id: with a scalar, starting a second stage change cleared the
  // first row's busy state while its request was still going, re-enabling it and letting two concurrent updates race.
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const enVuelo = useRef(0);
  // Un refresh que llega con una tarjeta todavía en vuelo no la pisa: el servidor aún tiene la etapa vieja.
  if (oportunidades !== recibidas) {
    setRecibidas(oportunidades);
    setItems(oportunidades.map((o) => (pendingIds.has(o.id) ? (items.find((i) => i.id === o.id) ?? o) : o)));
  }
  // Drag and drop between stages (native HTML5: no dependency). It does not work with touch or the keyboard; there,
  // "Cambiar etapa" in the card menu does the same.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overEtapa, setOverEtapa] = useState<string | null>(null);

  const { showToast } = useCrmToast();
  const cierre = useCierre();
  const editor = useApertura<Oportunidad | null>();

  const columnas = useMemo(() => etapasAbiertas(etapas), [etapas]);
  const etapaById = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);
  const motivoById = useMemo(() => new Map(motivos.map((m) => [m.id, m.nombre])), [motivos]);

  // Lo que se ve, en orden de lectura (tablero: columna por columna). Con ESTO decide el foco después de una acción
  // (`useFocoFilas`): una oportunidad cerrada desde el tablero ya no está en ninguna columna. Memo: su identidad solo
  // cambia cuando cambian las filas (un re-render por otra cosa no consume el foco pendiente).
  const visibles = useMemo(
    () => (vista === "tablero" ? columnas.flatMap((c) => items.filter((o) => o.etapa_id === c.id)) : items),
    [vista, columnas, items],
  );
  const contenedor = useRef<HTMLDivElement>(null);
  const buscador = useRef<HTMLDivElement>(null);
  const foco = useFocoFilas(visibles, { tabla: contenedor, buscador, acciones: ACCIONES_QUE_MUEVEN });

  /**
   * Después de un cambio de etapa o un cierre. En el tablero la tarjeta se mueve ya (la fila que devuelve la base, sin
   * perder las relaciones); en la lista manda el servidor. Las dos piden la lista de nuevo: un cierre o un cambio de
   * etapa puede sacar la fila del filtro actual, y el foco va a la siguiente (`useFocoFilas`).
   */
  function aplicarFila(row: Oportunidad) {
    if (vista === "tablero") setItems((prev) => prev.map((o) => (o.id === row.id ? { ...o, ...row } : o)));
    foco.trasCambio();
    filtros.refrescar();
  }

  async function mover(oportunidadId: string, etapaId: string) {
    const previous = items.find((o) => o.id === oportunidadId);
    // A card already in flight is not draggable, and this guard also rules out
    // two concurrent writes to the same opportunity. Closed ones don't move on the board.
    if (!previous || previous.estado !== "abierta" || previous.etapa_id === etapaId || pendingIds.has(oportunidadId)) return;

    // Optimistic: move the card now, roll it back if the write fails.
    setItems((prev) => prev.map((o) => (o.id === oportunidadId ? { ...o, etapa_id: etapaId } : o)));
    setPendingIds((prev) => new Set(prev).add(oportunidadId));
    enVuelo.current += 1;

    const { row, error } = await cambiarEtapa({ oportunidadId, etapaId });

    enVuelo.current -= 1;
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(oportunidadId);
      return next;
    });

    if (error || !row) {
      setItems((prev) => prev.map((o) => (o.id === oportunidadId ? { ...o, etapa_id: previous.etapa_id } : o)));
      showToast(mensajeErrorOportunidad(error, "No se pudo cambiar la etapa."), "error");
      return;
    }
    setItems((prev) => prev.map((o) => (o.id === row.id ? { ...o, ...row } : o)));
    // Con otros movimientos en vuelo no se recarga: el servidor devolvería la tarjeta vieja y la pisaría.
    if (enVuelo.current === 0) filtros.refrescar();
  }

  function nueva() {
    if (!puedeEditar) return;
    foco.olvidar();
    editor.abrir(null);
  }

  /** El `⋮` de una fila o tarjeta. Mientras tiene un movimiento en vuelo (arrastre) no se ofrece nada. */
  function menuDe(o: OportunidadRow) {
    if (pendingIds.has(o.id)) {
      return (
        <span role="img" aria-label="Guardando el cambio…" className="inline-flex size-7 shrink-0 items-center justify-center text-(--crm-text-2)">
          <Loader2 aria-hidden="true" strokeWidth={1.75} className="size-4 animate-spin motion-reduce:animate-none" />
        </span>
      );
    }
    return <Menu label={`Acciones de ${o.titulo}`} size="sm" items={foco.conFoco(accionesDe(o), o.id)} />;
  }

  function accionesDe(o: OportunidadRow): MenuItem[] {
    const acciones: MenuItem[] = [
      { label: "Ver detalle", icon: Eye, onSelect: () => router.push(`/oportunidades/${o.id}`) },
      // El presupuesto se arma desde la oportunidad: mismo link y mismo acceso que el botón de la ficha.
      { label: "Presupuesto", icon: FileText, onSelect: () => router.push(`/oportunidades/${o.id}/presupuesto`) },
    ];
    if (puedeEditar) acciones.push({ label: "Editar", icon: Pencil, onSelect: () => editor.abrir(o) });
    for (const modo of accionesDisponibles(o.estado, { puedeEditar, puedeReabrir })) {
      acciones.push({
        label: ACCION_CAMBIO[modo].label,
        icon: ACCION_CAMBIO[modo].icon,
        onSelect: () => cierre.abrir({ modo, oportunidad: o, licitacion: datosApertura(o.tipo, licitacionesActivas, licitaciones[o.id]) }),
      });
    }
    return acciones;
  }

  // Lo que suma el tablero, de lo que SE VE: una tarjeta cerrada desde su ⋮ deja de contar al instante.
  const totalVisible = visibles.reduce((acc, o) => acc + (Number(o.monto) || 0), 0);

  // La región del tablero entra en el orden de Tab solo si scrollea de costado (si no, no hay nada que mover con el teclado).
  const [desborda, setDesborda] = useState(false);
  useEffect(() => {
    const el = contenedor.current;
    if (vista !== "tablero" || !el) return;
    const medir = () => setDesborda(el.scrollWidth > el.clientWidth + 1);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vista, columnas.length]);

  function cambiarVista(next: string) {
    if (next === vista) return;
    // El tablero solo tiene etapas abiertas y no tiene estado: un filtro por una etapa de cierre lo dejaría vacío sin explicación.
    const etapaId = filtros.valor("etapa");
    const sacarEtapa = next === "tablero" && etapaId && etapaById.get(etapaId)?.tipo !== "abierta";
    filtros.aplicar(
      {
        vista: next === "lista" ? "lista" : null,
        ...(next === "tablero" ? { estado: null } : {}),
        ...(sacarEtapa ? { etapa: null } : {}),
      },
      { historial: true },
    );
  }

  // Filtros (mismos parámetros y opciones que el legacy). Un valor de la URL que no es una opción se ve como "todos".
  const opcionesEtapa = [
    { value: "", label: "Todas las etapas" },
    ...(vista === "tablero" ? columnas : [...etapas].sort((a, b) => a.orden - b.orden)).map((e) => ({ value: e.id, label: e.nombre, color: e.color })),
  ];
  const opcionesResponsable = [
    { value: "", label: "Todos los responsables" },
    { value: SIN_RESPONSABLE, label: "Sin asignar" },
    ...perfiles.map((p) => ({ value: p.id, label: p.activo ? p.nombre : `${p.nombre} (de baja)` })),
  ];
  const opcionesOrigen = [{ value: "", label: "Todos los orígenes" }, ...origenes.map((o) => ({ value: o.id, label: o.nombre }))];
  const valido = (opciones: readonly { value: string }[], v: string) => (opciones.some((o) => o.value === v) ? v : "");
  const estadoValor = valido(ESTADOS, filtros.valor("estado")) || "abierta";
  const etapaValor = valido(opcionesEtapa, filtros.valor("etapa"));
  const responsableValor = valido(opcionesResponsable, filtros.valor("responsable"));
  const tipoValor = valido(TIPOS, filtros.valor("tipo"));
  const origenValor = valido(opcionesOrigen, filtros.valor("origen"));
  const secundariosActivos = [puedeVerTodos ? responsableValor : "", tipoValor, origenValor].filter(Boolean).length;
  const etiqueta = (opciones: readonly { value: string; label: string }[], v: string) => (v ? opciones.find((o) => o.value === v)?.label : undefined);
  const chipMenu = (label: string, chip: string, param: string, opciones: readonly { value: string; label: string }[], valor: string) => (
    <Menu
      label={label}
      chip={{ label: chip, value: etiqueta(opciones, valor) }}
      items={opciones.map((o) => ({ label: o.label, checked: o.value === valor, onSelect: () => filtros.aplicar({ [param]: o.value || null }) }))}
      align="start"
    />
  );

  const meta = !cuentasOk
    ? `${total} oportunidades`
    : hayFiltros
      ? `${total} de ${vista === "tablero" ? totalAbiertas : totalTodas} oportunidades`
      : `${totalAbiertas} abiertas · ${totalTodas - totalAbiertas} cerradas`;
  const vacioReal = cuentasOk && totalTodas === 0;

  return (
    <div className={cn(UI_ROOT, "flex h-full min-h-0 flex-col bg-(--crm-canvas) px-4 xl:px-6")}>
      <PageBar
        title="Oportunidades"
        count={meta}
        actions={
          <>
            <SegmentedControl
              label="Vista"
              items={[
                { value: "tablero", label: "Tablero", icon: LayoutGrid },
                { value: "lista", label: "Lista", icon: List },
              ]}
              value={vista}
              onValueChange={cambiarVista}
              // En el celular solo los íconos (el nombre accesible sigue siendo "Tablero" / "Lista"): el h1 no se recorta.
              labelClassName="max-sm:sr-only"
            />
            {puedeEditar && (
              <Button variant="primary" icon={Plus} onClick={nueva} aria-label="Nueva oportunidad" className="max-sm:w-8 max-sm:px-0">
                <span className="max-sm:sr-only">Nueva oportunidad</span>
              </Button>
            )}
          </>
        }
      />

      {avisoMigracion && (
        <InlineBanner tone="info" title="Se activa al aplicar la migración 0011." className="mb-2">
          Hasta entonces el tipo «Licitación municipal» con sus datos no aparece. Los pasos están en la guía de despliegue.
        </InlineBanner>
      )}

      {!vacioReal && (
        <Toolbar>
          <div ref={buscador} className="contents">
            <SearchField
              filtros={filtros}
              label="Buscar oportunidad"
              placeholder="Buscar por título, cliente o producto…"
              // 320 desde 52rem: el placeholder de siempre entra entero.
              className={cn(ANCHO_FILTROS.buscador, "@[52rem]:w-80")}
            />
          </div>
          {vista === "lista" && (
            <Menu
              label="Filtrar por estado"
              // "Abiertas" es el valor por defecto (sin parámetro): el chip lo muestra igual, como el select de antes.
              chip={{ label: "Estado", value: etiqueta(ESTADOS, estadoValor) }}
              items={ESTADOS.map((o) => ({
                label: o.label,
                checked: o.value === estadoValor,
                onSelect: () => filtros.aplicar({ estado: o.value === "abierta" ? null : o.value }),
              }))}
              align="start"
            />
          )}
          {chipMenu("Filtrar por etapa", "Etapa", "etapa", opcionesEtapa, etapaValor)}
          {/* Secundarios: chips sueltos con ancho; con poco ancho, juntos en "Más filtros" (ANCHO_FILTROS). */}
          <div className={ANCHO_FILTROS.chips}>
            {puedeVerTodos && chipMenu("Filtrar por responsable", "Responsable", "responsable", opcionesResponsable, responsableValor)}
            {chipMenu("Filtrar por tipo", "Tipo", "tipo", TIPOS, tipoValor)}
            {chipMenu("Filtrar por origen", "Origen", "origen", opcionesOrigen, origenValor)}
          </div>
          <div className={ANCHO_FILTROS.mas}>
            <MasFiltros activos={secundariosActivos}>
              {puedeVerTodos && (
                <FiltroOpciones label="Responsable" value={responsableValor} options={opcionesResponsable} onChange={(v) => filtros.aplicar({ responsable: v || null })} />
              )}
              <FiltroOpciones label="Tipo" value={tipoValor} options={TIPOS} onChange={(v) => filtros.aplicar({ tipo: v || null })} />
              <FiltroOpciones label="Origen" value={origenValor} options={opcionesOrigen} onChange={(v) => filtros.aplicar({ origen: v || null })} />
            </MasFiltros>
          </div>
          {hayFiltros && (
            <Button variant="ghost" size="sm" onClick={() => filtros.limpiar(LIMPIAR_CONSERVA)}>
              Limpiar filtros
            </Button>
          )}
          {vista === "tablero" && columnas.length > 0 && (
            // Lo que suma el tablero (el encabezado "Embudo comercial" de antes): cantidad y valor de lo que se ve.
            <p className={cn(TYPE.table, "ml-auto whitespace-nowrap text-(--crm-text-2)")}>
              En el tablero: <span className={cn(TYPE.mono, "text-(--crm-text)")}>{visibles.length}</span>
              {" · "}
              <span className="text-(--crm-text)">
                <MontoCompacto valor={totalVisible} />
              </span>
            </p>
          )}
        </Toolbar>
      )}

      <AnuncioResultados total={total} />
      {tableroTruncado && (
        <InlineBanner tone="warning" className="mb-2">
          Mostrando las primeras {tableroMax} de {total} abiertas. Usá la lista con filtros para ver el resto.
        </InlineBanner>
      )}

      {vacioReal ? (
        <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
          <EmptyState
            title="El embudo está vacío"
            description="Cargá la primera consulta y seguila etapa por etapa, hasta el cierre."
            action={
              puedeEditar ? (
                <Button variant="primary" icon={Plus} onClick={nueva}>
                  Nueva oportunidad
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : vista === "tablero" ? (
        columnas.length ? (
          <div
            ref={contenedor}
            role="region"
            aria-label="Columnas del embudo"
            aria-busy={filtros.pending || undefined}
            tabIndex={desborda ? 0 : undefined}
            className={cn(
              // Una sola barra horizontal (la del tablero); cada columna scrollea solo de alto, dentro del área de trabajo.
              "-mx-4 flex min-h-0 flex-1 snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 sm:snap-none xl:-mx-6 xl:px-6",
              "transition-opacity duration-(--crm-dur-fast)",
              filtros.pending && "opacity-60 motion-reduce:transition-none",
              FOCUS,
              "focus-visible:outline-offset-[-2px]",
            )}
          >
            {columnas.map((etapa) => {
              const etapaItems = items.filter((o) => o.etapa_id === etapa.id);
              const etapaTotal = etapaItems.reduce((acc, o) => acc + (Number(o.monto) || 0), 0);
              const sobre = overEtapa === etapa.id;
              return (
                <section
                  key={etapa.id}
                  aria-labelledby={`etapa-${etapa.id}`}
                  className="flex min-h-0 w-[85%] shrink-0 snap-start flex-col sm:w-auto sm:min-w-64 sm:max-w-96 sm:flex-1 sm:basis-0"
                >
                  <header className="flex h-10 shrink-0 items-center gap-2 border-b border-(--crm-border-strong) px-1">
                    <StatusDot color={etapa.color} className="min-w-0 font-semibold">
                      <span id={`etapa-${etapa.id}`}>{etapa.nombre}</span>
                    </StatusDot>
                    <span className={cn(TYPE.meta, TYPE.mono, "text-(--crm-text-2)")}>
                      <span className="sr-only">: </span>
                      {etapaItems.length}
                      <span className="sr-only"> {etapaItems.length === 1 ? "oportunidad" : "oportunidades"}</span>
                    </span>
                    <span className={cn(TYPE.meta, "ml-auto whitespace-nowrap text-(--crm-text-2)")}>
                      <span className="sr-only">Valor de la etapa: </span>
                      <MontoCompacto valor={etapaTotal} />
                    </span>
                  </header>

                  <div
                    onDragOver={(e) => {
                      if (!dragId) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (overEtapa !== etapa.id) setOverEtapa(etapa.id);
                    }}
                    onDragLeave={(e) => {
                      // Leaving to a child card is not leaving the column.
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverEtapa(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain") || dragId;
                      setDragId(null);
                      setOverEtapa(null);
                      if (id) mover(id, etapa.id);
                    }}
                    className={cn(
                      "-mx-1 flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-(--crm-radius) px-1 py-2 transition-colors duration-(--crm-dur-fast)",
                      sobre && "bg-(--crm-selected) shadow-[inset_0_0_0_2px_var(--crm-accent)]",
                    )}
                  >
                    {etapaItems.map((o) => (
                      <Tarjeta
                        key={o.id}
                        o={o}
                        busy={pendingIds.has(o.id)}
                        arrastrable={puedeEditar && !pendingIds.has(o.id)}
                        arrastrando={dragId === o.id}
                        menu={menuDe(o)}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", o.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(o.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverEtapa(null);
                        }}
                      />
                    ))}
                    {!etapaItems.length && (
                      <p className={cn(TYPE.meta, "px-1 py-4 text-(--crm-text-2)")}>
                        {dragId ? "Soltá acá" : hayFiltros ? "Nada con ese filtro" : "Nada en esta etapa"}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
            <EmptyState title="El embudo no tiene etapas abiertas." description="Quien administra el CRM las arma en Configuración." />
          </div>
        )
      ) : (
        <>
          <div ref={contenedor} className="flex min-h-0 flex-col pb-3">
            <DataTable label="Oportunidades" busy={filtros.pending} className="min-h-0">
              <THead>
                <Th>Oportunidad</Th>
                {/* Anchos (MASTER §10.19): Etapa y Responsable entran enteros; Empresa y Producto crecen desde 90rem. */}
                <Th hideBelow="md" className={COL.empresa}>
                  Empresa / Contacto
                </Th>
                <Th className={COL.producto}>Producto</Th>
                <Th hideBelow="sm" className={COL.etapa}>
                  Etapa
                </Th>
                <Th width={96} hideBelow="md">
                  Estado
                </Th>
                <Th className={COL.responsable}>Responsable</Th>
                <Th width={120} align="right" hideBelow="sm">
                  Valor
                </Th>
                <Th width={40}>
                  <span className="sr-only">Acciones</span>
                </Th>
              </THead>
              <TBody>
                {total === 0 ? (
                  <TableMessage colSpan={COLUMNAS}>
                    <EmptyState
                      compact
                      title={q ? `Ninguna oportunidad con «${q}»` : "Ninguna oportunidad con esos filtros"}
                      description="Probá con otro estado o etapa, o buscá por cliente o producto."
                      action={
                        hayFiltros ? (
                          <Button size="sm" onClick={() => filtros.limpiar(LIMPIAR_CONSERVA)}>
                            Limpiar filtros
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableMessage>
                ) : (
                  items.map((o) => {
                    const etapa = etapaById.get(o.etapa_id);
                    return (
                      <Fila
                        key={o.id}
                        o={o}
                        etapa={etapa ? { nombre: etapa.nombre, color: etapa.color, tipo: etapa.tipo } : null}
                        motivo={o.motivo_perdida_id ? (motivoById.get(o.motivo_perdida_id) ?? null) : null}
                        menu={menuDe(o)}
                      />
                    );
                  })
                )}
              </TBody>
              {total > 0 && <PieDePagina items={items} />}
            </DataTable>
          </div>
          <ListFooter filtros={filtros} total={total} page={page} pageSize={pageSize} />
        </>
      )}

      <OportunidadForm
        key={`f-${editor.n}`}
        open={editor.abierto}
        onClose={editor.cerrar}
        oportunidad={editor.valor ?? undefined}
        licitacion={editor.valor ? licitaciones[editor.valor.id] : undefined}
        motivoNombre={editor.valor?.motivo_perdida_id ? motivoById.get(editor.valor.motivo_perdida_id) : null}
        catalogos={{ licitacionesActivas, empresas, contactos, productos, etapas, origenes, perfiles, puedeAsignar, yoId }}
        onSaved={() => {
          editor.cerrar();
          filtros.refrescar();
        }}
      />

      <CierreDialog {...cierre.dialogProps} etapas={etapas} motivos={motivos} onHecho={aplicarFila} />
    </div>
  );
}

/**
 * Tarjeta del tablero (`article`, contrato de MASTER §13.2): título (link real a la ficha, hasta dos renglones), cliente,
 * valor en mono, "Licitación" y el responsable. Los mismos datos que la tarjeta legacy. Se arrastra entera; el `⋮` y el
 * link no inician el arrastre.
 */
function Tarjeta({
  o,
  busy,
  arrastrable,
  arrastrando,
  menu,
  onDragStart,
  onDragEnd,
}: {
  o: OportunidadRow;
  busy: boolean;
  arrastrable: boolean;
  arrastrando: boolean;
  menu: React.ReactNode;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const cliente = nombreCliente(o);
  const responsable = o.responsable?.nombre ?? null;
  return (
    <article
      data-id={o.id}
      aria-labelledby={`tarjeta-${o.id}`}
      aria-busy={busy || undefined}
      draggable={arrastrable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "shrink-0 rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) px-2.5 py-2 transition-colors duration-(--crm-dur-fast) hover:border-(--crm-border-strong)",
        arrastrable && "cursor-grab active:cursor-grabbing",
        (busy || arrastrando) && "opacity-60",
      )}
    >
      <div className="flex items-start gap-1">
        <Tooltip content={o.titulo} onlyWhenTruncated>
          <Link
            id={`tarjeta-${o.id}`}
            href={`/oportunidades/${o.id}`}
            draggable={false}
            data-nombre
            className={cn("mt-0.5 line-clamp-2 min-w-0 flex-1 break-words rounded-[2px] text-[13px] font-medium leading-[18px] hover:underline", FOCUS)}
          >
            {o.titulo}
          </Link>
        </Tooltip>
        <div className="-mr-1.5 -mt-0.5 shrink-0">{menu}</div>
      </div>
      <p className={cn(TYPE.meta, "mt-0.5 truncate text-(--crm-text-2)")}>{cliente ?? "Sin empresa / contacto"}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={cn(TYPE.table, "font-medium", !o.monto && "text-(--crm-text-2)")}>
          <span className="sr-only">Valor estimado: </span>
          <MontoCompacto valor={o.monto ? Number(o.monto) : 0} />
        </span>
        <span className="ml-auto flex min-w-0 items-center gap-1.5">
          {o.tipo === "licitacion" && <Tag>Licitación</Tag>}
          {responsable && (
            <Tooltip content={responsable}>
              <span tabIndex={-1} className="inline-flex">
                <Avatar name={responsable} size="xs" />
                <span className="sr-only">Responsable: {responsable}</span>
              </span>
            </Tooltip>
          )}
        </span>
      </div>
    </article>
  );
}

/**
 * Una fila de la lista. Las columnas que el contenedor esconde pasan a la línea de apoyo bajo el título (MASTER §10.19),
 * un dato por `span`, sin perder ninguno; la fecha de cierre y el motivo (el legacy los ponía bajo el estado) van ahí
 * siempre que la oportunidad esté cerrada.
 */
function Fila({
  o,
  etapa,
  motivo,
  menu,
}: {
  o: OportunidadRow;
  etapa: { nombre: string; color: string | null; tipo: string } | null;
  motivo: string | null;
  menu: React.ReactNode;
}) {
  const cliente = nombreCliente(o);
  const repite = etapaRepiteEstado(etapa, o.estado);
  const responsable = o.responsable?.nombre ?? null;
  const cierre = o.fecha_cierre ? `Cerrada el ${formatFecha(o.fecha_cierre)}${motivo ? ` · ${motivo}` : ""}` : null;
  return (
    <Tr data-id={o.id}>
      <Td className="py-1">
        <div className="flex min-w-0 items-center gap-2">
          <Tooltip content={o.titulo} onlyWhenTruncated>
            <Link href={`/oportunidades/${o.id}`} data-nombre className={cn("block min-w-0 truncate rounded-[2px] font-medium text-(--crm-text) hover:underline", FOCUS)}>
              {o.titulo}
            </Link>
          </Tooltip>
          {o.tipo === "licitacion" && <Tag className="shrink-0">Licitación</Tag>}
        </div>
        {/* Línea 1 (< 45rem): valor (celular) · estado · etapa (celular) · cliente. En el celular una abierta no repite
            "Abierta" (lo dice su etapa) y una cerrada no repite la etapa si se llama como el estado. */}
        {/* Un renglón: lo corto entero y el cliente, al final, se recorta con "…" (entero en la ficha y en el tooltip). */}
        <div className={cn(TYPE.meta, "flex min-w-0 items-baseline gap-x-3 text-(--crm-text-2) @[45rem]:hidden")}>
          <span className="shrink-0 text-(--crm-text) @[30rem]:hidden">
            <Monto valor={o.monto ? Number(o.monto) : 0} />
          </span>
          <span className={cn("shrink-0", o.estado === "abierta" && "hidden @[30rem]:inline")}>
            <EstadoOportunidad estado={o.estado} />
          </span>
          {!repite && (
            <span className="shrink-0 @[30rem]:hidden">
              <StatusDot color={etapa?.color}>{etapa?.nombre ?? "—"}</StatusDot>
            </span>
          )}
          <Tooltip content={cliente ?? "Sin empresa / contacto"} onlyWhenTruncated>
            <span className="min-w-0 truncate">{cliente ?? "Sin empresa / contacto"}</span>
          </Tooltip>
        </div>
        {/* Línea 2: producto (< 90rem) · responsable (30–72rem; en el celular queda en la ficha) · cierre. */}
        <div
          className={cn(
            TYPE.meta,
            "flex flex-wrap gap-x-3 text-(--crm-text-2)",
            !cierre && (o.producto?.nombre ? "@[90rem]:hidden" : "hidden @[30rem]:flex @[72rem]:hidden"),
          )}
        >
          {o.producto?.nombre && <span className="min-w-0 truncate @[90rem]:hidden">{o.producto.nombre}</span>}
          <span className="hidden @[30rem]:inline @[72rem]:hidden">{responsable ?? "Sin asignar"}</span>
          {cierre && <span className="tabular-nums">{cierre}</span>}
        </div>
      </Td>
      <Td hideBelow="md">
        {cliente ? (
          <Tooltip content={cliente} onlyWhenTruncated>
            <span className="block truncate">{cliente}</span>
          </Tooltip>
        ) : (
          <span className="text-(--crm-text-2)">—</span>
        )}
      </Td>
      <Td className="hidden @[90rem]:table-cell">
        {o.producto?.nombre ? (
          <Tooltip content={o.producto.nombre} onlyWhenTruncated>
            <span className="flex min-w-0 items-center gap-2">
              <IconoEquipoSimple nombre={o.producto.nombre} className="size-4 text-(--crm-text-2)" />
              <span className="truncate">{o.producto.nombre}</span>
            </span>
          </Tooltip>
        ) : (
          <span className="text-(--crm-text-2)">—</span>
        )}
      </Td>
      <Td hideBelow="sm">
        {repite ? (
          // La etapa de cierre se llama como el estado (columna de al lado): no se repite.
          <span className="text-(--crm-text-2)">
            <span aria-hidden="true">—</span>
            <span className="sr-only">{etapa?.nombre}</span>
          </span>
        ) : (
          <Tooltip content={etapa?.nombre ?? "—"} onlyWhenTruncated>
            <StatusDot color={etapa?.color} className="max-w-full">
              {etapa?.nombre ?? "—"}
            </StatusDot>
          </Tooltip>
        )}
      </Td>
      <Td hideBelow="md">
        <EstadoOportunidad estado={o.estado} />
      </Td>
      <Td className="hidden @[72rem]:table-cell">
        {responsable ? (
          <Tooltip content={responsable} onlyWhenTruncated>
            <span className="block min-w-0">
              <CellPerson name={responsable} />
            </span>
          </Tooltip>
        ) : (
          <span className="text-(--crm-text-2)">Sin asignar</span>
        )}
      </Td>
      <Td align="right" hideBelow="sm">
        <Monto valor={o.monto ? Number(o.monto) : 0} />
      </Td>
      <Td className="overflow-visible px-1">
        <CellActions menu={menu} />
      </Td>
    </Tr>
  );
}

/**
 * Total de la página, como la fila de totales del legacy ("Con valor", "Sin responsable", "Valor de la página"; "En esta
 * página" ya lo dice "Mostrando N–M de T"): una fila de pie con la regla fuerte arriba y el valor bajo la columna Valor.
 */
function PieDePagina({ items }: { items: OportunidadRow[] }) {
  const valor = items.reduce((acc, o) => acc + (Number(o.monto) || 0), 0);
  const conValor = items.filter((o) => o.monto).length;
  const sinResponsable = items.filter((o) => !o.responsable_id).length;
  const celda = "h-9 border-t border-(--crm-border-strong) bg-(--crm-panel) px-3 align-middle";
  return (
    <tfoot className="sticky bottom-0 z-(--crm-z-sticky)">
      <tr>
        <td className={cn(celda, TYPE.table, "py-1")}>
          <p className="flex items-baseline gap-3 font-medium">
            <span className="truncate">Valor de la página</span>
            <span className="ml-auto @[30rem]:hidden">
              <Monto valor={valor} />
            </span>
          </p>
          <p className={cn(TYPE.meta, "tabular-nums text-(--crm-text-2)")}>
            {conValor} con valor · {sinResponsable} sin responsable
          </p>
        </td>
        <td className={cn(celda, "hidden @[45rem]:table-cell")} />
        <td className={cn(celda, "hidden @[90rem]:table-cell")} />
        <td className={cn(celda, "hidden @[30rem]:table-cell")} />
        <td className={cn(celda, "hidden @[45rem]:table-cell")} />
        <td className={cn(celda, "hidden @[72rem]:table-cell")} />
        <td className={cn(celda, "hidden text-right @[30rem]:table-cell")}>
          <Monto valor={valor} />
        </td>
        <td className={celda} />
      </tr>
    </tfoot>
  );
}
