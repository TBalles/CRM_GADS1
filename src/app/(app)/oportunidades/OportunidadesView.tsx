"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Eye,
  Handshake,
  LayoutGrid,
  Layers,
  List,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import Drawer from "@/components/Drawer";
import RowActions, { type RowAction } from "@/components/RowActions";
import CierreModal, { ACCION_CAMBIO, useCierre } from "@/components/CierreModal";
import { EstadoOportunidadPill, EtapaBadge, FALLBACK_COLOR, TipoOportunidadBadge } from "@/components/oportunidades";
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  Input,
  PageHeader,
  SectionTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  initials,
} from "@/components/ui/UIComponents";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { cambiarEtapa } from "@/lib/cambiarEtapa";
import { formatFecha, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import {
  accionesDisponibles,
  ESTADOS_OPORTUNIDAD,
  etapasAbiertas,
  mensajeErrorOportunidad,
  type OpcionContacto,
  type OpcionEmpresa,
  type OpcionProducto,
} from "@/lib/oportunidades";
import { cn } from "@/lib/utils";
import OportunidadForm from "./OportunidadForm";
import type { Tables } from "@/lib/supabase/types";

type Etapa = Tables<"etapas">;
type Oportunidad = Tables<"oportunidades">;
type Motivo = Pick<Tables<"motivos_perdida">, "id" | "nombre" | "activo" | "orden">;

export type OportunidadRow = Oportunidad & {
  empresa: { id: string; nombre: string } | null;
  contacto: { id: string; nombre: string; apellido: string | null } | null;
  producto: { id: string; nombre: string } | null;
  responsable: { id: string; nombre: string | null } | null;
};

type Vista = "tablero" | "lista";

const SIN_RESPONSABLE = "__sin_responsable";

function ResponsableAvatar({ nombre }: { nombre: string | null }) {
  if (!nombre) return <span className="text-muted-foreground">Sin asignar</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarFallback className="bg-secondary text-[9px] text-muted-foreground">{initials(nombre)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{nombre}</span>
    </span>
  );
}

function nombreCliente(o: OportunidadRow) {
  return o.empresa?.nombre ?? (o.contacto ? `${o.contacto.nombre} ${o.contacto.apellido ?? ""}`.trim() : null);
}

export default function OportunidadesView({
  etapas,
  oportunidades,
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
}: {
  etapas: Etapa[];
  oportunidades: OportunidadRow[];
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
}) {
  const router = useRouter();
  const [items, setItems] = useState(oportunidades);
  // One entry per in-flight row, not a single shared id: with a scalar, starting
  // a second stage change cleared the first row's busy state while its request
  // was still going, re-enabling it and letting two concurrent updates race.
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  // Drag and drop between stages (native HTML5: no dependency). It does not
  // work with touch; there, "Cambiar etapa" in the card menu does the same.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overEtapa, setOverEtapa] = useState<string | null>(null);

  const [vista, setVista] = useState<Vista>("tablero");
  const [query, setQuery] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("abierta");
  const [etapaFilter, setEtapaFilter] = useState("");
  const [responsableFilter, setResponsableFilter] = useState("");
  const [origenFilter, setOrigenFilter] = useState("");
  const { showToast } = useToast();
  const cierre = useCierre();

  // Payload outlives `open` so the drawer's title doesn't flip mid-animation.
  const [target, setTarget] = useState<Oportunidad | "new" | null>(null);
  const [open, setOpen] = useState(false);

  const columnas = useMemo(() => etapasAbiertas(etapas), [etapas]);
  const etapaById = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);
  const motivoById = useMemo(() => new Map(motivos.map((m) => [m.id, m.nombre])), [motivos]);

  function openDrawer(next: Oportunidad | "new") {
    if (!puedeEditar) return;
    setTarget(next);
    setOpen(true);
  }

  /** Mezcla la fila que devuelve la base sin perder los datos de las relaciones (empresa, responsable…). */
  function aplicarFila(row: Oportunidad) {
    setItems((prev) => prev.map((o) => (o.id === row.id ? { ...o, ...row } : o)));
  }

  async function mover(oportunidadId: string, etapaId: string) {
    const previous = items.find((o) => o.id === oportunidadId);
    // A card already in flight is not draggable, and this guard also rules out
    // two concurrent writes to the same opportunity. Closed ones don't move on the board.
    if (!previous || previous.estado !== "abierta" || previous.etapa_id === etapaId || pendingIds.has(oportunidadId)) return;

    // Optimistic: move the card now, roll it back if the write fails.
    setItems((prev) => prev.map((o) => (o.id === oportunidadId ? { ...o, etapa_id: etapaId } : o)));
    setPendingIds((prev) => new Set(prev).add(oportunidadId));

    const { row, error } = await cambiarEtapa({ oportunidadId, etapaId });

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
    aplicarFila(row);
  }

  function buildDisplayRow(raw: Oportunidad): OportunidadRow {
    const empresa = empresas.find((e) => e.id === raw.empresa_id);
    const contacto = contactos.find((c) => c.id === raw.contacto_id);
    const producto = productos.find((p) => p.id === raw.producto_id);
    const responsable = perfiles.find((p) => p.id === raw.responsable_id);
    return {
      ...raw,
      empresa: empresa ? { id: empresa.id, nombre: empresa.label } : null,
      contacto: contacto ? { id: contacto.id, nombre: contacto.label, apellido: null } : null,
      producto: producto ? { id: producto.id, nombre: producto.label } : null,
      responsable: responsable ? { id: responsable.id, nombre: responsable.nombre } : null,
    };
  }

  function handleOportunidadSaved(saved: Oportunidad) {
    const display = buildDisplayRow(saved);
    setItems((prev) => {
      const exists = prev.some((o) => o.id === saved.id);
      return exists ? prev.map((o) => (o.id === saved.id ? display : o)) : [display, ...prev];
    });
    setOpen(false);
  }

  /**
   * El menu de una fila o tarjeta. Mientras la oportunidad tiene un movimiento en vuelo
   * (arrastre) no se ofrece nada: abrir el modal o editar encima de un pedido pendiente
   * pisaria el resultado de uno con el otro.
   */
  function menuDe(o: OportunidadRow) {
    if (pendingIds.has(o.id)) {
      return <Loader2 aria-label="Guardando el cambio…" role="img" className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />;
    }
    return <RowActions label={`Acciones de ${o.titulo}`} items={accionesDe(o)} />;
  }

  function accionesDe(o: OportunidadRow): RowAction[] {
    const acciones: RowAction[] = [
      { label: "Ver detalle", icon: Eye, onClick: () => router.push(`/oportunidades/${o.id}`) },
    ];
    if (puedeEditar) acciones.push({ label: "Editar", icon: Pencil, onClick: () => openDrawer(o) });
    for (const modo of accionesDisponibles(o.estado, { puedeEditar, puedeReabrir })) {
      acciones.push({
        label: ACCION_CAMBIO[modo].label,
        icon: ACCION_CAMBIO[modo].icon,
        onClick: () => cierre.abrir({ modo, oportunidad: o }),
      });
    }
    return acciones;
  }

  // Filtros que valen en las dos vistas; el estado solo en la lista (el tablero es de las abiertas).
  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((o) => {
      if (etapaFilter && o.etapa_id !== etapaFilter) return false;
      if (responsableFilter === SIN_RESPONSABLE) {
        if (o.responsable_id) return false;
      } else if (responsableFilter && o.responsable_id !== responsableFilter) {
        return false;
      }
      if (origenFilter && o.origen_id !== origenFilter) return false;
      if (!q) return true;
      const haystack = [o.titulo, nombreCliente(o), o.producto?.nombre, o.responsable?.nombre];
      return haystack.some((v) => v?.toLowerCase().includes(q));
    });
  }, [items, query, etapaFilter, responsableFilter, origenFilter]);

  const abiertas = filtradas.filter((o) => o.estado === "abierta");
  const enLista = estadoFilter ? filtradas.filter((o) => o.estado === estadoFilter) : filtradas;
  const visibles = vista === "tablero" ? abiertas : enLista;
  const totalVisible = visibles.reduce((acc, o) => acc + (Number(o.monto) || 0), 0);
  const totalAbiertas = items.filter((o) => o.estado === "abierta").length;

  const hayFiltros =
    Boolean(query.trim() || etapaFilter || responsableFilter || origenFilter) || (vista === "lista" && estadoFilter !== "abierta");

  function limpiarFiltros() {
    setQuery("");
    setEtapaFilter("");
    setResponsableFilter("");
    setOrigenFilter("");
    setEstadoFilter("abierta");
  }

  function cambiarVista(next: Vista) {
    setVista(next);
    // El tablero solo tiene etapas abiertas: un filtro por una etapa de cierre lo dejaria vacio sin explicacion.
    if (next === "tablero" && etapaFilter && etapaById.get(etapaFilter)?.tipo !== "abierta") setEtapaFilter("");
  }

  const opcionesEtapa = (vista === "tablero" ? columnas : [...etapas].sort((a, b) => a.orden - b.orden)).map((e) => ({
    value: e.id,
    label: e.nombre,
    color: e.color,
  }));

  const meta = hayFiltros
    ? `${visibles.length} de ${vista === "tablero" ? totalAbiertas : items.length} oportunidades`
    : `${totalAbiertas} abiertas · ${items.length - totalAbiertas} cerradas`;

  return (
    <div className="flex w-full flex-col gap-4">
      {/* HEADER + TOOLBAR */}
      <PageHeader
        titulo="Oportunidades"
        eyebrow="El embudo"
        meta={meta}
        bajada="Tablero por etapa o lista con todo lo cerrado. Arrastrá una tarjeta para avanzarla y cerrala con ganada o perdida."
      >
        {puedeEditar && (
          <Button onClick={() => openDrawer("new")} aria-label="Nueva oportunidad" className="h-9 shrink-0 gap-1.5 px-3 text-sm">
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nueva oportunidad</span>
          </Button>
        )}
      </PageHeader>

      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, cliente o producto…"
            aria-label="Buscar oportunidad"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>
        {vista === "lista" && (
          <div className="w-[calc(50%-0.25rem)] sm:w-48">
            <Select
              value={estadoFilter}
              onChange={setEstadoFilter}
              placeholder="Todos los estados"
              options={[
                { value: "", label: "Todos los estados" },
                ...ESTADOS_OPORTUNIDAD.map((e) => ({ value: e.value, label: `${e.label}s` })),
              ]}
              className="h-9"
            />
          </div>
        )}
        <div className="w-[calc(50%-0.25rem)] sm:w-44">
          <Select
            value={etapaFilter}
            onChange={setEtapaFilter}
            placeholder="Todas las etapas"
            options={[{ value: "", label: "Todas las etapas" }, ...opcionesEtapa]}
            className="h-9"
          />
        </div>
        {puedeVerTodos && (
          <div className="w-[calc(50%-0.25rem)] sm:w-52">
            <Select
              value={responsableFilter}
              onChange={setResponsableFilter}
              placeholder="Todos los responsables"
              searchable={perfiles.length > 8}
              options={[
                { value: "", label: "Todos los responsables" },
                { value: SIN_RESPONSABLE, label: "Sin asignar" },
                ...perfiles.map((p) => ({ value: p.id, label: p.activo ? p.nombre : `${p.nombre} (de baja)` })),
              ]}
              className="h-9"
            />
          </div>
        )}
        <div className="w-[calc(50%-0.25rem)] sm:w-48">
          <Select
            value={origenFilter}
            onChange={setOrigenFilter}
            placeholder="Todos los orígenes"
            options={[{ value: "", label: "Todos los orígenes" }, ...origenes.map((o) => ({ value: o.id, label: o.nombre }))]}
            className="h-9"
          />
        </div>
        {hayFiltros && (
          <Button variant="ghost" size="sm" onClick={limpiarFiltros} className="h-9">
            Limpiar filtros
          </Button>
        )}
        <div role="group" aria-label="Vista" className="ml-auto inline-flex rounded-lg border bg-card p-0.5">
          {(
            [
              { value: "tablero", label: "Tablero", icon: LayoutGrid },
              { value: "lista", label: "Lista", icon: List },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={vista === value}
              onClick={() => cambiarVista(value)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                vista === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {!items.length ? (
        <EmptyState
          escena="cancha"
          text="El embudo está vacío"
          hint="Cargá la primera consulta y seguila etapa por etapa, hasta el cierre."
          action={
            puedeEditar ? (
              <Button onClick={() => openDrawer("new")} className="gap-2">
                <Plus aria-hidden="true" className="h-4 w-4" /> Nueva oportunidad
              </Button>
            ) : undefined
          }
        />
      ) : vista === "tablero" ? (
        /* EMBUDO: una columna por etapa abierta, con scroll horizontal e imán en pantallas chicas */
        <Card>
          <div className="p-5 pb-0">
            <SectionTitle
              icon={Layers}
              right={
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                  {abiertas.length} · {formatMoneyCompact(totalVisible)}
                </span>
              }
            >
              Embudo comercial
            </SectionTitle>
          </div>

          {columnas.length ? (
            <div
              role="region"
              aria-label="Columnas del embudo"
              tabIndex={0}
              className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto p-5 pt-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {columnas.map((etapa, i) => {
                const etapaItems = abiertas.filter((o) => o.etapa_id === etapa.id);
                const etapaTotal = etapaItems.reduce((acc, o) => acc + (Number(o.monto) || 0), 0);
                const color = etapa.color ?? FALLBACK_COLOR;

                return (
                  <div key={etapa.id} className="flex min-w-[78%] flex-1 snap-start flex-col sm:min-w-56">
                    <div className="rounded-t-lg border border-b-0 bg-card px-2.5 py-2" style={{ borderTop: `2px solid ${color}` }}>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <h3 className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide">{etapa.nombre}</h3>
                        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                          {etapaItems.length}
                        </span>
                      </div>
                      <p className="mt-0.5 flex min-w-0 items-baseline gap-1.5 text-[10px] tabular-nums text-muted-foreground">
                        {/* Numerada como los pasos de la landing: el embudo se lee
                            como una jugada que avanza hacia el arco. */}
                        <span className="shrink-0 font-mono font-bold text-brand" aria-hidden="true">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate">{etapaTotal ? formatMoneyCompact(etapaTotal) : "—"}</span>
                      </p>
                    </div>

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
                        "flex max-h-[26rem] min-h-[7rem] flex-1 flex-col gap-1.5 overflow-y-auto rounded-b-lg border bg-muted/30 p-1.5 transition-colors",
                        overEtapa === etapa.id && "bg-brand/10 ring-2 ring-inset ring-brand/40",
                      )}
                    >
                      {etapaItems.map((o) => {
                        const busy = pendingIds.has(o.id);
                        const arrastrable = puedeEditar && !busy;
                        const cliente = nombreCliente(o);
                        return (
                          <div
                            key={o.id}
                            draggable={arrastrable}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", o.id);
                              e.dataTransfer.effectAllowed = "move";
                              setDragId(o.id);
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setOverEtapa(null);
                            }}
                            className={cn(
                              "rounded-lg border bg-card p-2 shadow-sm transition-all hover:border-brand/30 hover:shadow-md",
                              arrastrable && "cursor-grab active:cursor-grabbing",
                              busy && "opacity-60",
                              dragId === o.id && "opacity-40",
                            )}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <Link
                                href={`/oportunidades/${o.id}`}
                                draggable={false}
                                title={o.titulo}
                                className="min-w-0 flex-1 truncate rounded-sm text-left text-xs font-semibold hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {o.titulo}
                              </Link>
                              {menuDe(o)}
                            </div>

                            <p className="mt-1 truncate text-[11px] text-muted-foreground">{cliente ?? "Sin empresa / contacto"}</p>

                            <div className="mt-1.5 flex items-center justify-between gap-1.5">
                              <span className="truncate text-xs font-bold tabular-nums text-brand">
                                {o.monto ? formatMoneyCompact(Number(o.monto)) : "—"}
                              </span>
                              <span className="flex shrink-0 items-center gap-1.5">
                                <TipoOportunidadBadge tipo={o.tipo} />
                                {o.responsable?.nombre && (
                                  <Avatar className="h-5 w-5" title={o.responsable.nombre}>
                                    <AvatarFallback className="bg-secondary text-[8px] text-muted-foreground">
                                      {initials(o.responsable.nombre)}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {!etapaItems.length && (
                        <p className="px-1 py-6 text-center text-[11px] text-muted-foreground">
                          {dragId ? "Soltá acá" : hayFiltros ? "Nada con ese filtro" : "Nada en esta etapa"}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              El embudo no tiene etapas abiertas. Quien administra el CRM las arma en Configuración.
            </p>
          )}
        </Card>
      ) : !enLista.length ? (
        <EmptyState
          escena="afuera"
          text={query.trim() ? `Ninguna oportunidad con «${query.trim()}»` : "Ninguna oportunidad con esos filtros"}
          hint="Probá con otro estado o etapa, o buscá por cliente o producto."
          action={
            hayFiltros ? (
              <Button variant="outline" onClick={limpiarFiltros}>
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* MOBILE: una card por fila */}
          <div className="space-y-2 md:hidden">
            {enLista.map((o) => {
              const etapa = etapaById.get(o.etapa_id);
              const cliente = nombreCliente(o);
              const motivo = o.motivo_perdida_id ? motivoById.get(o.motivo_perdida_id) : null;
              return (
                <div key={o.id} className="rounded-lg border bg-card p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/oportunidades/${o.id}`}
                      className="min-w-0 flex-1 rounded-sm text-left text-sm font-semibold hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {o.titulo}
                    </Link>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-brand">{formatMoney(o.monto ? Number(o.monto) : null)}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <EstadoOportunidadPill estado={o.estado} />
                      <EtapaBadge nombre={etapa?.nombre ?? "—"} color={etapa?.color} />
                      <TipoOportunidadBadge tipo={o.tipo} />
                    </div>
                    {menuDe(o)}
                  </div>

                  <div className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Building2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{cliente ?? "Sin empresa / contacto"}</span>
                    </span>
                    {o.producto?.nombre && (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Package aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{o.producto.nombre}</span>
                      </span>
                    )}
                    <span className="flex min-w-0 items-center gap-1.5">
                      <UserRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{o.responsable?.nombre ?? "Sin asignar"}</span>
                    </span>
                    {o.fecha_cierre && (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Handshake aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          Cerrada el {formatFecha(o.fecha_cierre)}
                          {motivo ? ` · ${motivo}` : ""}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP: tabla */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Empresa / Contacto</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Producto</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Responsable</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enLista.map((o) => {
                  const etapa = etapaById.get(o.etapa_id);
                  const motivo = o.motivo_perdida_id ? motivoById.get(o.motivo_perdida_id) : null;
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Link
                            href={`/oportunidades/${o.id}`}
                            className="rounded-sm text-left font-medium hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {o.titulo}
                          </Link>
                          <TipoOportunidadBadge tipo={o.tipo} />
                        </span>
                        {/* Folded into the primary cell where its own column is hidden */}
                        <div className="text-xs text-muted-foreground 2xl:hidden">{o.responsable?.nombre ?? "Sin asignar"}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{nombreCliente(o) ?? "—"}</TableCell>
                      <TableCell className="hidden text-muted-foreground 2xl:table-cell">{o.producto?.nombre ?? "—"}</TableCell>
                      <TableCell>
                        <EtapaBadge nombre={etapa?.nombre ?? "—"} color={etapa?.color} />
                      </TableCell>
                      <TableCell>
                        <EstadoOportunidadPill estado={o.estado} />
                        {o.fecha_cierre && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <span className="tabular-nums">{formatFecha(o.fecha_cierre)}</span>
                            {motivo && <span> · {motivo}</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden 2xl:table-cell">
                        <ResponsableAvatar nombre={o.responsable?.nombre ?? null} />
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-brand">
                        {formatMoney(o.monto ? Number(o.monto) : null)}
                      </TableCell>
                      <TableCell className="pl-0 pr-2 text-right">
                        {menuDe(o)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Fila de total (DESIGN.md §7.3) */}
            <div className="grid grid-cols-2 gap-px border-t bg-border sm:grid-cols-4">
              {[
                { label: "Oportunidades", value: String(enLista.length) },
                { label: "Con valor", value: String(enLista.filter((o) => o.monto).length) },
                { label: "Sin responsable", value: String(enLista.filter((o) => !o.responsable_id).length) },
                { label: "Valor total", value: formatMoney(totalVisible) },
              ].map((t) => (
                <div key={t.label} className="bg-muted/30 px-4 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</p>
                  <p className="text-sm font-bold tabular-nums">{t.value}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={target === "new" ? "Nueva oportunidad" : "Editar oportunidad"}
        subtitle={target && target !== "new" ? target.titulo : undefined}
        icon={Handshake}
      >
        {target !== null && (
          <OportunidadForm
            key={target === "new" ? "nueva" : target.id}
            oportunidad={target === "new" ? undefined : target}
            empresas={empresas}
            contactos={contactos}
            productos={productos}
            etapas={etapas}
            origenes={origenes}
            perfiles={perfiles}
            motivoNombre={target !== "new" && target.motivo_perdida_id ? motivoById.get(target.motivo_perdida_id) : null}
            puedeAsignar={puedeAsignar}
            yoId={yoId}
            onSaved={handleOportunidadSaved}
            onCancel={() => setOpen(false)}
          />
        )}
      </Drawer>

      <CierreModal
        {...cierre.modalProps}
        etapas={etapas}
        motivos={motivos}
        onHecho={aplicarFila}
      />
    </div>
  );
}
