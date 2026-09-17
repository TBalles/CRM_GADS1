"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Handshake,
  Inbox,
  Layers,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Drawer from "@/components/Drawer";
import RowActions from "@/components/RowActions";
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  Input,
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
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { cn } from "@/lib/utils";
import OportunidadForm from "./OportunidadForm";
import type { Tables } from "@/lib/supabase/types";

type Etapa = Tables<"etapas">;
type Oportunidad = Tables<"oportunidades">;
type Opcion = { id: string; label: string; color?: string | null };

type OportunidadRow = Oportunidad & {
  empresa: { id: string; nombre: string } | null;
  contacto: { id: string; nombre: string; apellido: string | null } | null;
  producto: { id: string; nombre: string } | null;
  responsable: { id: string; nombre: string | null } | null;
};

const FALLBACK_COLOR = "#64748b";

/**
 * Stage pill. The stage colours stored in the DB are light 400-level tones, so
 * white text on a solid fill lands around 1.8:1 — unreadable. A tinted surface
 * plus a saturated dot keeps the stage's identity and stays legible in both
 * themes, and it matches the dot the funnel and the Select already use.
 */
function EtapaBadge({
  nombre,
  color,
  className,
}: {
  nombre: string;
  color?: string | null;
  className?: string;
}) {
  const c = color ?? FALLBACK_COLOR;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        className,
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${c} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${c} 38%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: c }} />
      {nombre}
    </span>
  );
}

function ResponsableAvatar({ nombre }: { nombre: string | null }) {
  if (!nombre) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarFallback className="bg-secondary text-[9px] text-muted-foreground">
          {initials(nombre)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{nombre}</span>
    </span>
  );
}

export default function OportunidadesView({
  etapas,
  oportunidades,
  empresas,
  contactos,
  productos,
  perfiles,
}: {
  etapas: Etapa[];
  oportunidades: OportunidadRow[];
  empresas: Opcion[];
  contactos: Opcion[];
  productos: Opcion[];
  perfiles: Opcion[];
}) {
  const [items, setItems] = useState(oportunidades);
  // One entry per in-flight row, not a single shared id: with a scalar, starting
  // a second stage change cleared the first row's busy state while its request
  // was still going, re-enabling its Select and letting two concurrent updates
  // race — last response to land wins in the DB, which is not necessarily the
  // stage on screen, and neither request errors so nothing rolls back.
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [etapaFilter, setEtapaFilter] = useState("");
  const { showToast } = useToast();

  // Payload outlives `open` so the drawer's title doesn't flip mid-animation.
  const [target, setTarget] = useState<Oportunidad | "new" | null>(null);
  const [open, setOpen] = useState(false);

  const etapaOptions: Opcion[] = etapas.map((e) => ({
    id: e.id,
    label: e.nombre,
    color: e.color,
  }));
  const selectOptions = etapaOptions.map((e) => ({
    value: e.id,
    label: e.label,
    color: e.color,
  }));

  function openDrawer(next: Oportunidad | "new") {
    setTarget(next);
    setOpen(true);
  }

  function closeDrawer() {
    setOpen(false);
  }

  async function handleChangeEtapa(oportunidadId: string, etapaId: string) {
    const previous = items.find((o) => o.id === oportunidadId)?.etapa_id;
    // A row already in flight has its Select disabled, so this also rules out
    // two concurrent writes to the same opportunity.
    if (!previous || previous === etapaId || pendingIds.has(oportunidadId)) return;

    // Optimistic: move the card now, roll it back if the write fails.
    setItems((prev) => prev.map((o) => (o.id === oportunidadId ? { ...o, etapa_id: etapaId } : o)));
    setPendingIds((prev) => new Set(prev).add(oportunidadId));

    const supabase = createClient();
    const { error } = await supabase
      .from("oportunidades")
      .update({ etapa_id: etapaId })
      .eq("id", oportunidadId);

    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(oportunidadId);
      return next;
    });

    if (error) {
      setItems((prev) =>
        prev.map((o) => (o.id === oportunidadId ? { ...o, etapa_id: previous } : o)),
      );
      showToast("No se pudo cambiar la etapa.", "error");
    }
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
      responsable: responsable ? { id: responsable.id, nombre: responsable.label } : null,
    };
  }

  function handleOportunidadSaved(saved: Oportunidad) {
    const display = buildDisplayRow(saved);
    setItems((prev) => {
      const exists = prev.some((o) => o.id === saved.id);
      return exists ? prev.map((o) => (o.id === saved.id ? display : o)) : [display, ...prev];
    });
    closeDrawer();
  }

  const etapaById = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((o) => {
      if (etapaFilter && o.etapa_id !== etapaFilter) return false;
      if (!q) return true;
      const haystack = [
        o.titulo,
        o.empresa?.nombre,
        o.contacto?.nombre,
        o.producto?.nombre,
        o.responsable?.nombre,
      ];
      return haystack.some((v) => v?.toLowerCase().includes(q));
    });
  }, [items, query, etapaFilter]);

  const totalFiltrado = filtered.reduce((acc, o) => acc + (Number(o.monto) || 0), 0);

  return (
    <div className="flex w-full flex-col gap-4">
      {/* HEADER + TOOLBAR */}
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="hidden shrink-0 md:block">
          <h1 className="text-2xl font-bold tracking-tight">Oportunidades</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Embudo comercial y listado. Cambiá de etapa desde la tarjeta o editá cualquier fila.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className="relative min-w-[7rem] flex-1 sm:w-60 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar oportunidad…"
              aria-label="Buscar oportunidad"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="w-full sm:w-44">
            <Select
              value={etapaFilter}
              onChange={setEtapaFilter}
              placeholder="Todas las etapas"
              options={[{ value: "", label: "Todas las etapas" }, ...selectOptions]}
              className="h-9"
            />
          </div>
          <Button onClick={() => openDrawer("new")} className="h-9 shrink-0 gap-1.5 px-3 text-sm">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nueva oportunidad</span>
          </Button>
        </div>
      </div>

      {/* EMBUDO — sin scroll horizontal: 2 columnas en mobile, 6 en desktop */}
      <Card>
        <div className="p-5 pb-0">
          <SectionTitle
            icon={Layers}
            right={
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                {filtered.length} · {formatMoneyCompact(totalFiltrado)}
              </span>
            }
          >
            Embudo comercial
          </SectionTitle>
        </div>

        <div className="grid grid-cols-2 gap-2 p-5 pt-0 sm:grid-cols-3 lg:grid-cols-6 lg:gap-2.5">
          {etapas.map((etapa) => {
            const etapaItems = filtered.filter((o) => o.etapa_id === etapa.id);
            const etapaTotal = etapaItems.reduce((acc, o) => acc + (Number(o.monto) || 0), 0);
            const color = etapa.color ?? FALLBACK_COLOR;

            return (
              <div key={etapa.id} className="flex min-w-0 flex-col">
                <div
                  className="rounded-t-lg border border-b-0 bg-card px-2.5 py-2"
                  style={{ borderTop: `2px solid ${color}` }}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <h3 className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide">
                      {etapa.nombre}
                    </h3>
                    <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                      {etapaItems.length}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] tabular-nums text-muted-foreground">
                    {etapaTotal ? formatMoneyCompact(etapaTotal) : "—"}
                  </p>
                </div>

                <div className="flex max-h-[26rem] min-h-[7rem] flex-1 flex-col gap-1.5 overflow-y-auto rounded-b-lg border bg-muted/30 p-1.5">
                  {etapaItems.map((o) => {
                    const busy = pendingIds.has(o.id);
                    return (
                      <div
                        key={o.id}
                        className={cn(
                          "rounded-lg border bg-card p-2 shadow-sm transition-all hover:border-brand/30 hover:shadow-md",
                          busy && "opacity-60",
                        )}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => openDrawer(o)}
                            title={o.titulo}
                            className="min-w-0 flex-1 truncate text-left text-xs font-semibold hover:text-brand"
                          >
                            {o.titulo}
                          </button>
                          {busy ? (
                            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                          ) : (
                            <RowActions
                              label={`Acciones de ${o.titulo}`}
                              items={[
                                { label: "Editar", icon: Pencil, onClick: () => openDrawer(o) },
                              ]}
                            />
                          )}
                        </div>

                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          {o.empresa?.nombre ?? o.contacto?.nombre ?? "Sin empresa / contacto"}
                        </p>

                        <div className="mt-1.5 flex items-center justify-between gap-1.5">
                          <span className="truncate text-xs font-bold tabular-nums text-brand">
                            {o.monto ? formatMoneyCompact(Number(o.monto)) : "—"}
                          </span>
                          {o.responsable?.nombre && (
                            <Avatar className="h-5 w-5" title={o.responsable.nombre}>
                              <AvatarFallback className="bg-secondary text-[8px] text-muted-foreground">
                                {initials(o.responsable.nombre)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>

                        <div className="mt-2">
                          <Select
                            value={o.etapa_id}
                            onChange={(v) => handleChangeEtapa(o.id, v)}
                            options={selectOptions}
                            disabled={busy}
                            searchable={false}
                            className="h-7 px-1.5 text-[11px]"
                          />
                        </div>
                      </div>
                    );
                  })}

                  {!etapaItems.length && (
                    <p className="px-1 py-6 text-center text-[11px] text-muted-foreground/70">
                      Sin oportunidades
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* LISTADO */}
      {!items.length ? (
        <EmptyState
          icon={Handshake}
          text="Todavía no hay oportunidades registradas"
          hint="Creá tu primera oportunidad y seguila por el embudo."
          action={
            <Button onClick={() => openDrawer("new")} className="gap-2">
              <Plus className="h-4 w-4" /> Nueva oportunidad
            </Button>
          }
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={Inbox}
          text="Ninguna oportunidad coincide con el filtro"
          hint="Ajustá la búsqueda o elegí otra etapa."
        />
      ) : (
        <>
          {/* MOBILE: una card por fila */}
          <div className="space-y-2 md:hidden">
            {filtered.map((o) => {
              const etapa = etapaById.get(o.etapa_id);
              return (
                <div key={o.id} className="rounded-lg border bg-card p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openDrawer(o)}
                      className="min-w-0 flex-1 text-left text-sm font-semibold hover:text-brand"
                    >
                      {o.titulo}
                    </button>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-brand">
                      {formatMoney(o.monto ? Number(o.monto) : null)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <EtapaBadge nombre={etapa?.nombre ?? "—"} color={etapa?.color} />
                    <RowActions
                      label={`Acciones de ${o.titulo}`}
                      items={[{ label: "Editar", icon: Pencil, onClick: () => openDrawer(o) }]}
                    />
                  </div>

                  <div className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {o.empresa?.nombre ?? o.contacto?.nombre ?? "Sin empresa / contacto"}
                      </span>
                    </span>
                    {o.producto?.nombre && (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{o.producto.nombre}</span>
                      </span>
                    )}
                    <span className="flex min-w-0 items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{o.responsable?.nombre ?? "Sin asignar"}</span>
                    </span>
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
                  <TableHead className="hidden lg:table-cell">Producto</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="hidden lg:table-cell">Responsable</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => {
                  const etapa = etapaById.get(o.etapa_id);
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => openDrawer(o)}
                          className="text-left font-medium hover:text-brand"
                        >
                          {o.titulo}
                        </button>
                        {/* Folded into the primary cell where its own column is hidden */}
                        <div className="text-[10px] text-muted-foreground lg:hidden">
                          {o.responsable?.nombre ?? "Sin asignar"}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {o.empresa?.nombre ?? o.contacto?.nombre ?? "—"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {o.producto?.nombre ?? "—"}
                      </TableCell>
                      <TableCell>
                        <EtapaBadge nombre={etapa?.nombre ?? "—"} color={etapa?.color} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <ResponsableAvatar nombre={o.responsable?.nombre ?? null} />
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-brand">
                        {formatMoney(o.monto ? Number(o.monto) : null)}
                      </TableCell>
                      <TableCell className="pl-0 pr-2 text-right">
                        <RowActions
                          label={`Acciones de ${o.titulo}`}
                          items={[{ label: "Editar", icon: Pencil, onClick: () => openDrawer(o) }]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Fila de total (DESIGN.md §7.3) */}
            <div className="grid grid-cols-2 gap-px border-t bg-border sm:grid-cols-4">
              {[
                { label: "Oportunidades", value: String(filtered.length) },
                { label: "Con monto", value: String(filtered.filter((o) => o.monto).length) },
                { label: "Sin responsable", value: String(filtered.filter((o) => !o.responsable_id).length) },
                { label: "Monto total", value: formatMoney(totalFiltrado) },
              ].map((t) => (
                <div key={t.label} className="bg-muted/30 px-4 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t.label}
                  </p>
                  <p className="text-sm font-bold tabular-nums">{t.value}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <Drawer
        open={open}
        onClose={closeDrawer}
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
            etapas={etapaOptions}
            perfiles={perfiles}
            onSaved={handleOportunidadSaved}
            onCancel={closeDrawer}
          />
        )}
      </Drawer>
    </div>
  );
}
