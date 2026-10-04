"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  Plus,
  Receipt,
  Timer,
} from "lucide-react";
import Drawer from "@/components/Drawer";
import { Badge, Card, Button, PageHeader } from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { OverlayCarga } from "@/components/ui/OverlayCarga";
import { AnuncioResultados, BarraPendiente, CajaBusqueda, FiltroFecha, FiltroSelect, useFiltrosUrl } from "@/components/FiltrosUrl";
import { Paginacion } from "@/components/Paginacion";
import { IconoEquipo } from "@/components/Equipamiento";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import VentaForm from "./VentaForm";
import type { Tables } from "@/lib/supabase/types";

type Venta = Tables<"ventas">;
type VentaItem = Tables<"venta_items">;
type Empresa = Tables<"empresas">;
/** La fila de la lista: la venta y el nombre de su cliente (lo trae la consulta, no depende de otra lista). */
type VentaFila = Venta & { empresa: { id: string; nombre: string } | null };
type Contacto = Tables<"contactos">;
type Producto = Tables<"productos">;

/** dd/mm/aaaa desde un `date` de Postgres, sin arrastrar zona horaria. */
function formatFecha(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default function VentasList({
  ventas,
  total,
  page,
  pageSize,
  q,
  hayFiltro,
  cuentasOk,
  totalVentas,
  items,
  empresas,
  contactos,
  productos,
  puedeEditar,
}: {
  /** Sin `ventas.editar`: solo lectura. La base igual lo exige. */
  puedeEditar: boolean;
  /** Solo la página actual: el servidor busca, filtra y pagina (F3). */
  ventas: VentaFila[];
  /** Coincidencias con los filtros, en todas las páginas. */
  total: number;
  page: number;
  pageSize: number;
  /** La búsqueda ya limpia, para repetirla en el "no hay resultados". */
  q: string;
  hayFiltro: boolean;
  /** Falso si el conteo falló: no se sabe si hay ventas, así que no se muestra el vacío de "primera vez". */
  cuentasOk: boolean;
  /** Ventas registradas, sin filtros. */
  totalVentas: number;
  /** Los ítems de las ventas de esta página. */
  items: VentaItem[];
  empresas: Empresa[];
  contactos: Contacto[];
  productos: Producto[];
}) {
  const router = useRouter();
  const filtros = useFiltrosUrl();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [actualizando, startTransition] = useTransition();

  const productoPorId = useMemo(
    () => new Map(productos.map((p) => [p.id, p])),
    [productos],
  );
  const itemsPorVenta = useMemo(() => {
    const mapa = new Map<string, VentaItem[]>();
    for (const it of items) {
      const lista = mapa.get(it.venta_id);
      if (lista) lista.push(it);
      else mapa.set(it.venta_id, [it]);
    }
    return mapa;
  }, [items]);

  const totalDe = (ventaId: string) =>
    (itemsPorVenta.get(ventaId) ?? []).reduce(
      (acc, it) => acc + (it.precio_unitario ?? 0) * it.cantidad,
      0,
    );

  /**
   * Después de registrar una venta hay que refrescar desde el servidor: la
   * fila nueva trae campos que completó un trigger en la base (la vida útil
   * copiada del catálogo), así que no se puede reconstruir en el cliente sin
   * adivinar. `router.refresh()` vuelve a correr el Server Component.
   */
  function handleSaved() {
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <OverlayCarga visible={actualizando} texto="Actualizando…" />
      <PageHeader
        titulo="Ventas"
        eyebrow="Arranca el reloj"
        meta={!cuentasOk ? `${total} ventas` : hayFiltro ? `${total} de ${totalVentas} ventas` : `${totalVentas} ventas registradas`}
        bajada="Historial de entregas. Es de acá que salen las alertas de recambio."
      >
        <CajaBusqueda filtros={filtros} etiqueta="Buscar venta" placeholder="Buscar cliente, comprobante o producto…" />
        {puedeEditar && (
          <Button onClick={() => setOpen(true)} className="h-9 shrink-0 gap-1.5 px-3 text-sm">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nueva venta</span>
          </Button>
        )}
      </PageHeader>

      {(totalVentas > 0 || !cuentasOk) && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
          <FiltroSelect
            filtros={filtros}
            param="empresa"
            etiqueta="Filtrar por cliente"
            className="sm:w-60"
            searchable={empresas.length > 8}
            opciones={[{ value: "", label: "Todos los clientes" }, ...empresas.map((e) => ({ value: e.id, label: e.nombre }))]}
          />
          <FiltroFecha filtros={filtros} param="desde" etiqueta="Desde" max={filtros.valor("hasta")} />
          <FiltroFecha filtros={filtros} param="hasta" etiqueta="Hasta" min={filtros.valor("desde")} />
          {hayFiltro && (
            <Button variant="ghost" size="sm" onClick={() => filtros.limpiar()} className="h-9">
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4" aria-busy={filtros.pending}>
        <BarraPendiente pending={filtros.pending} />
        <AnuncioResultados total={total} />
        {cuentasOk && totalVentas === 0 ? (
          <EmptyState
            escena="cancha"
            text="Todavía no hay entregas asentadas"
            hint="Asentá la primera venta: la fecha de entrega arranca el reloj del recambio."
            action={
              puedeEditar ? (
                <Button onClick={() => setOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> Nueva venta
                </Button>
              ) : undefined
            }
          />
        ) : total === 0 ? (
          <EmptyState
            escena="afuera"
            text={q ? `Ninguna venta con «${q}»` : "Ninguna venta con esos filtros"}
            hint="Probá por cliente, número de comprobante o producto, o con otras fechas."
            action={
              hayFiltro ? (
                <Button variant="outline" onClick={() => filtros.limpiar()}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              {ventas.map((venta) => {
                const empresa = venta.empresa;
                const detalle = itemsPorVenta.get(venta.id) ?? [];
                const expanded = expandedId === venta.id;

                return (
                  <Card
                    key={venta.id}
                    className={cn(
                      "overflow-hidden transition-all",
                      expanded ? "border-brand/30 shadow-md" : "hover:border-brand/20 hover:shadow-md",
                    )}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      onClick={() => setExpandedId(expanded ? null : venta.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedId(expanded ? null : venta.id);
                        }
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 p-3 text-left transition-colors hover:bg-muted/30"
                    >
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          expanded && "rotate-90",
                        )}
                      />
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                        <Receipt className="h-4 w-4 text-brand" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {empresa?.nombre ?? "Cliente eliminado"}
                        </p>
                        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            {formatFecha(venta.fecha)}
                          </span>
                          {venta.comprobante && (
                            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{venta.comprobante}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Que se entrego, sin desplegar: los equipos de la venta
                          apilados. Decorativo; el detalle abierto los nombra. */}
                      {detalle.length > 0 && (
                        <div aria-hidden="true" className="hidden shrink-0 -space-x-2 sm:flex">
                          {detalle.slice(0, 3).map((it) => {
                            const producto = productoPorId.get(it.producto_id);
                            return (
                              <IconoEquipo
                                key={it.id}
                                nombre={producto?.nombre}
                                categoria={producto?.categoria}
                                className="h-8 w-8 rounded-full border border-brand/25 bg-card ring-2 ring-card [&>svg]:h-4 [&>svg]:w-4"
                              />
                            );
                          })}
                        </div>
                      )}

                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold tabular-nums">{formatMoney(totalDe(venta.id))}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {detalle.length} {detalle.length === 1 ? "ítem" : "ítems"}
                        </p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "grid transition-[grid-template-rows] duration-300 ease-in-out",
                        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="space-y-1.5 border-t bg-muted/20 p-3">
                          {detalle.map((it) => {
                            const producto = productoPorId.get(it.producto_id);
                            return (
                              <div
                                key={it.id}
                                className="flex items-center gap-3 rounded-lg border bg-card p-2.5 shadow-sm"
                              >
                                <IconoEquipo nombre={producto?.nombre} categoria={producto?.categoria} className="h-8 w-8" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">
                                    {producto?.nombre ?? "Producto eliminado"}
                                  </p>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                    <span className="text-xs text-muted-foreground">
                                      Entrega {formatFecha(it.fecha_entrega)}
                                    </span>
                                    {it.vida_util_meses != null && (
                                      <span className="flex items-center gap-1 text-xs font-medium text-brand">
                                        <Timer className="h-3 w-3 shrink-0" />
                                        {it.vida_util_meses} meses
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Badge variant="secondary" className="shrink-0 tabular-nums">
                                  ×{it.cantidad}
                                </Badge>
                                <span className="shrink-0 text-sm font-semibold tabular-nums">
                                  {formatMoney((it.precio_unitario ?? 0) * it.cantidad)}
                                </span>
                              </div>
                            );
                          })}

                          {venta.notas && (
                            <p className="pt-1.5 text-xs leading-relaxed text-muted-foreground">
                              {venta.notas}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <Paginacion total={total} page={page} pageSize={pageSize} filtros={filtros} />
          </>
        )}
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva venta"
        subtitle="El detalle define las alertas de recambio"
        icon={Receipt}
      >
        <VentaForm
          empresas={empresas}
          contactos={contactos}
          productos={productos}
          onSaved={handleSaved}
          onCancel={() => setOpen(false)}
        />
      </Drawer>
    </div>
  );
}
