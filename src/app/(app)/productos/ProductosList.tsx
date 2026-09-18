"use client";

import { useMemo, useState } from "react";
import { Boxes, Package, Pencil, Plus, Power, Search, Timer } from "lucide-react";
import Drawer from "@/components/Drawer";
import RowActions from "@/components/RowActions";
import ConfirmModal from "@/components/ConfirmModal";
import {
  Badge,
  Button,
  Card,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import ProductoForm from "./ProductoForm";
import type { Tables } from "@/lib/supabase/types";

type Producto = Tables<"productos">;

/**
 * La vida util es la columna que le da sentido a toda la seccion de alertas,
 * asi que se muestra como un dato propio y no escondida en la descripcion.
 * Sin cargar se ve distinto de "0 meses": uno es "no hace seguimiento", el
 * otro seria un dato invalido.
 */
function VidaUtil({ meses }: { meses: number | null }) {
  if (meses == null) {
    return <span className="text-xs text-muted-foreground/70">Sin seguimiento</span>;
  }
  const anios = meses / 12;
  const detalle =
    meses >= 12 && Number.isInteger(anios)
      ? `${anios} ${anios === 1 ? "año" : "años"}`
      : `${meses} ${meses === 1 ? "mes" : "meses"}`;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <Timer className="h-3.5 w-3.5 shrink-0 text-brand" />
      <span className="tabular-nums">{detalle}</span>
    </span>
  );
}

export default function ProductosList({ productos }: { productos: Producto[] }) {
  const [items, setItems] = useState(productos);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Producto | null>(null);
  const [open, setOpen] = useState(false);
  const [toggling, setToggling] = useState<Producto | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const { showToast } = useToast();

  function openDrawer(producto: Producto | null) {
    setEditing(producto);
    setOpen(true);
  }

  function handleSaved(saved: Producto) {
    setItems((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      const next = exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved];
      return [...next].sort((a, b) => a.nombre.localeCompare(b.nombre));
    });
    setOpen(false);
  }

  /**
   * Un producto no se borra: se da de baja. Borrarlo rompería el historial de
   * ventas que lo referencia (la FK es `on delete restrict` justamente para
   * eso) y dejaría alertas huérfanas de equipos que sí se entregaron.
   */
  async function handleToggleActivo(producto: Producto) {
    if (pendingIds.has(producto.id)) return;
    const proximo = !producto.activo;

    setItems((prev) =>
      prev.map((p) => (p.id === producto.id ? { ...p, activo: proximo } : p)),
    );
    setPendingIds((prev) => new Set(prev).add(producto.id));

    const supabase = createClient();
    const { error } = await supabase
      .from("productos")
      .update({ activo: proximo })
      .eq("id", producto.id);

    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(producto.id);
      return next;
    });

    if (error) {
      setItems((prev) =>
        prev.map((p) => (p.id === producto.id ? { ...p, activo: producto.activo } : p)),
      );
      showToast("No se pudo cambiar el estado del producto.", "error");
      return;
    }

    showToast(proximo ? "Producto reactivado." : "Producto dado de baja.", "success");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const matches = (v: string | null) => Boolean(v && v.toLowerCase().includes(q));
    return items.filter(
      (p) => matches(p.nombre) || matches(p.marca) || matches(p.categoria) || matches(p.descripcion),
    );
  }, [items, query]);

  const conSeguimiento = items.filter((p) => p.vida_util_meses != null).length;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="hidden shrink-0 md:block">
          <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de equipamiento. {conSeguimiento} de {items.length} tienen vida útil cargada y
            generan alertas de recambio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className="relative min-w-[7rem] flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar producto…"
              aria-label="Buscar producto"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Button onClick={() => openDrawer(null)} className="h-9 shrink-0 gap-1.5 px-3 text-sm">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nuevo producto</span>
          </Button>
        </div>
      </div>

      {!items.length ? (
        <EmptyState
          icon={Boxes}
          text="Todavía no hay productos en el catálogo"
          hint="Cargá tu primer producto con su duración estimada para empezar a seguir recambios."
          action={
            <Button onClick={() => openDrawer(null)} className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo producto
            </Button>
          }
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={Search}
          text={`Sin resultados para "${query.trim()}"`}
          hint="Probá con otro nombre, marca o categoría."
        />
      ) : (
        <>
          {/* Tabla en desktop */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead>Vida útil</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} className={cn(!p.activo && "opacity-55")}>
                    <TableCell>
                      <span className="block font-medium">{p.nombre}</span>
                      {p.marca && (
                        <span className="block text-xs text-muted-foreground">{p.marca}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.categoria ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.precio == null ? (
                        <span className="text-muted-foreground/70">—</span>
                      ) : (
                        formatMoney(p.precio)
                      )}
                    </TableCell>
                    <TableCell>
                      <VidaUtil meses={p.vida_util_meses} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.activo ? "success" : "secondary"}>
                        {p.activo ? "Activo" : "De baja"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RowActions
                        label={`Acciones de ${p.nombre}`}
                        items={[
                          { label: "Editar", icon: Pencil, onClick: () => openDrawer(p) },
                          {
                            label: p.activo ? "Dar de baja" : "Reactivar",
                            icon: Power,
                            variant: p.activo ? "destructive" : "default",
                            onClick: () => (p.activo ? setToggling(p) : handleToggleActivo(p)),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Tarjetas en mobile: una tabla de 6 columnas no entra en un teléfono */}
          <div className="space-y-2 md:hidden">
            {filtered.map((p) => (
              <Card key={p.id} className={cn("p-3", !p.activo && "opacity-55")}>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                    <Package className="h-4 w-4 text-brand" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.marca, p.categoria].filter(Boolean).join(" · ") || "Sin categoría"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <VidaUtil meses={p.vida_util_meses} />
                      {p.precio != null && (
                        <span className="text-xs font-semibold tabular-nums">
                          {formatMoney(p.precio)}
                        </span>
                      )}
                      {!p.activo && <Badge variant="secondary">De baja</Badge>}
                    </div>
                  </div>
                  <RowActions
                    label={`Acciones de ${p.nombre}`}
                    items={[
                      { label: "Editar", icon: Pencil, onClick: () => openDrawer(p) },
                      {
                        label: p.activo ? "Dar de baja" : "Reactivar",
                        icon: Power,
                        variant: p.activo ? "destructive" : "default",
                        onClick: () => (p.activo ? setToggling(p) : handleToggleActivo(p)),
                      },
                    ]}
                  />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar producto" : "Nuevo producto"}
        subtitle={editing?.nombre}
        icon={Package}
      >
        <ProductoForm
          key={editing?.id ?? "nuevo-producto"}
          producto={editing ?? undefined}
          onSaved={handleSaved}
          onCancel={() => setOpen(false)}
        />
      </Drawer>

      <ConfirmModal
        isOpen={Boolean(toggling)}
        onClose={() => setToggling(null)}
        onConfirm={() => {
          if (toggling) handleToggleActivo(toggling);
          setToggling(null);
        }}
        title="Dar de baja el producto"
        description={
          toggling
            ? `"${toggling.nombre}" deja de aparecer al cargar ventas nuevas. El historial de ventas y las alertas de los equipos ya entregados no se tocan.`
            : ""
        }
        confirmText="Dar de baja"
        variant="danger"
        icon={<Power className="h-6 w-6" />}
      />
    </div>
  );
}
