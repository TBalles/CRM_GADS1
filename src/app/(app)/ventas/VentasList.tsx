"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  Plus,
  Receipt,
  Search,
  Timer,
} from "lucide-react";
import Drawer from "@/components/Drawer";
import { Badge, Card, Button, Input } from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import VentaForm from "./VentaForm";
import type { Tables } from "@/lib/supabase/types";

type Venta = Tables<"ventas">;
type VentaItem = Tables<"venta_items">;
type Empresa = Tables<"empresas">;
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
  items,
  empresas,
  contactos,
  productos,
}: {
  ventas: Venta[];
  items: VentaItem[];
  empresas: Empresa[];
  contactos: Contacto[];
  productos: Producto[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const empresaPorId = useMemo(
    () => new Map(empresas.map((e) => [e.id, e])),
    [empresas],
  );
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ventas;
    return ventas.filter((v) => {
      const empresa = empresaPorId.get(v.empresa_id);
      const productosDeLaVenta = (itemsPorVenta.get(v.id) ?? [])
        .map((it) => productoPorId.get(it.producto_id)?.nombre ?? "")
        .join(" ");
      return `${empresa?.nombre ?? ""} ${v.comprobante ?? ""} ${productosDeLaVenta}`
        .toLowerCase()
        .includes(q);
    });
  }, [ventas, query, empresaPorId, itemsPorVenta, productoPorId]);

  /**
   * Después de registrar una venta hay que refrescar desde el servidor: la
   * fila nueva trae campos que completó un trigger en la base (la vida útil
   * copiada del catálogo), así que no se puede reconstruir en el cliente sin
   * adivinar. `router.refresh()` vuelve a correr el Server Component.
   */
  function handleSaved() {
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="hidden shrink-0 md:block">
          <h1 className="text-2xl font-bold tracking-tight">Ventas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Historial de entregas. Es de acá que salen las alertas de recambio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className="relative min-w-[7rem] flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, comprobante o producto…"
              aria-label="Buscar venta"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Button onClick={() => setOpen(true)} className="h-9 shrink-0 gap-1.5 px-3 text-sm">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nueva venta</span>
          </Button>
        </div>
      </div>

      {!ventas.length ? (
        <EmptyState
          icon={Receipt}
          text="Todavía no hay ventas registradas"
          hint="Registrá tu primera entrega para empezar a seguir el recambio de esos equipos."
          action={
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nueva venta
            </Button>
          }
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={Search}
          text={`Sin resultados para "${query.trim()}"`}
          hint="Probá con otro cliente, comprobante o producto."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((venta) => {
            const empresa = empresaPorId.get(venta.empresa_id);
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
      )}

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
