"use client";

import { useState } from "react";
import { Package, Pencil, Plus, Power } from "lucide-react";
import { IconoEquipo } from "@/components/Equipamiento";
import Drawer from "@/components/Drawer";
import RowActions from "@/components/RowActions";
import ConfirmModal from "@/components/ConfirmModal";
import {
  Button,
  Card,
  PageHeader,
  Pill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/UIComponents";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnuncioResultados, BarraPendiente, CajaBusqueda, FiltroSelect, useFiltrosUrl } from "@/components/FiltrosUrl";
import { Paginacion } from "@/components/Paginacion";
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
 *
 * La barrita es cuanto dura contra lo que MAS dura del catalogo: un arco de
 * cinco años y una pelota de uno se distinguen sin leer el numero.
 */
function VidaUtil({ meses, max }: { meses: number | null; max: number }) {
  if (meses == null) {
    return <span className="text-xs text-muted-foreground">Sin seguimiento</span>;
  }
  const anios = meses / 12;
  const detalle =
    meses >= 12 && Number.isInteger(anios)
      ? `${anios} ${anios === 1 ? "año" : "años"}`
      : `${meses} ${meses === 1 ? "mes" : "meses"}`;
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium">
      <span aria-hidden="true" className="relative h-1 w-10 overflow-hidden rounded-full bg-muted">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-brand"
          style={{ width: `${max ? Math.min(100, (meses / max) * 100) : 0}%` }}
        />
      </span>
      <span className="tabular-nums">{detalle}</span>
    </span>
  );
}

export default function ProductosList({
  productos,
  total,
  page,
  pageSize,
  q,
  hayFiltro,
  cuentasOk,
  totalCatalogo,
  conSeguimiento,
  maxVida,
  categorias,
  puedeEditar,
}: {
  /** Solo la página actual: el servidor busca, filtra y pagina (F3). */
  productos: Producto[];
  /** Coincidencias con los filtros, en todas las páginas. */
  total: number;
  page: number;
  pageSize: number;
  /** La búsqueda ya limpia, para repetirla en el "no hay resultados". */
  q: string;
  hayFiltro: boolean;
  /** Falso si algún conteo falló: no se sabe si hay productos, así que no se muestra el vacío de "primera vez". */
  cuentasOk: boolean;
  /** Productos del catálogo entero, sin filtros. */
  totalCatalogo: number;
  conSeguimiento: number;
  /** La vida útil más larga del catálogo entero: la barrita se mide contra ella. */
  maxVida: number;
  categorias: string[];
  /** Sin `productos.editar`: solo lectura. La base igual lo exige. */
  puedeEditar: boolean;
}) {
  const filtros = useFiltrosUrl();
  const [editing, setEditing] = useState<Producto | null>(null);
  const [open, setOpen] = useState(false);
  const [toggling, setToggling] = useState<Producto | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const { showToast } = useToast();

  function openDrawer(producto: Producto | null) {
    setEditing(producto);
    setOpen(true);
  }

  // La lista sale del servidor: después de guardar se le vuelve a pedir.
  function handleSaved() {
    setOpen(false);
    filtros.refrescar();
  }

  /**
   * Un producto no se borra: se da de baja. Borrarlo rompería el historial de
   * ventas que lo referencia (la FK es `on delete restrict` justamente para
   * eso) y dejaría alertas huérfanas de equipos que sí se entregaron.
   */
  async function handleToggleActivo(producto: Producto) {
    if (pendingIds.has(producto.id)) return;
    const proximo = !producto.activo;

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
      showToast("No se pudo cambiar el estado del producto.", "error");
      return;
    }

    showToast(proximo ? "Producto reactivado." : "Producto dado de baja.", "success");
    filtros.refrescar();
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        titulo="Productos"
        eyebrow="La base"
        meta={!cuentasOk ? `${total} productos` : hayFiltro ? `${total} de ${totalCatalogo} productos` : `${totalCatalogo} productos · ${conSeguimiento} con vida útil`}
        bajada="Lo que vendés y cuánto dura. Los que tienen vida útil cargada son los que disparan las alertas de recambio."
      >
        <CajaBusqueda filtros={filtros} etiqueta="Buscar producto" placeholder="Buscar producto…" />
        {puedeEditar && (
          <Button onClick={() => openDrawer(null)} className="h-9 shrink-0 gap-1.5 px-3 text-sm">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nuevo producto</span>
          </Button>
        )}
      </PageHeader>

      {(totalCatalogo > 0 || !cuentasOk) && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
          <FiltroSelect
            filtros={filtros}
            param="categoria"
            etiqueta="Filtrar por categoría"
            className="sm:w-52"
            opciones={[{ value: "", label: "Todas las categorías" }, ...categorias.map((c) => ({ value: c, label: c }))]}
          />
          <FiltroSelect
            filtros={filtros}
            param="estado"
            etiqueta="Filtrar por estado"
            className="sm:w-44"
            opciones={[
              { value: "", label: "Activos y de baja" },
              { value: "activo", label: "Activos" },
              { value: "baja", label: "De baja" },
            ]}
          />
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
        {cuentasOk && totalCatalogo === 0 ? (
          <EmptyState
            escena="cancha"
            text="El catálogo está vacío"
            hint="Cargá lo que vendés —arcos, redes, conos— con su vida útil en meses. Ese número es el que después dispara los avisos."
            action={
              puedeEditar ? (
                <Button onClick={() => openDrawer(null)} className="gap-2">
                  <Plus className="h-4 w-4" /> Nuevo producto
                </Button>
              ) : undefined
            }
          />
        ) : total === 0 ? (
          <EmptyState
            escena="afuera"
            text={q ? `«${q}» no está en el catálogo` : "Ningún producto con esos filtros"}
            hint="Probá por marca o por categoría: redes, arcos, pelotas…"
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
                  {productos.map((p) => (
                    <TableRow key={p.id} className={cn(!p.activo && "opacity-55")}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <IconoEquipo nombre={p.nombre} categoria={p.categoria} />
                          <div className="min-w-0">
                            <span className="block font-medium">{p.nombre}</span>
                            {p.marca && (
                              <span className="block text-xs text-muted-foreground">{p.marca}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.categoria ? <Pill>{p.categoria}</Pill> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.precio == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          formatMoney(p.precio)
                        )}
                      </TableCell>
                      <TableCell>
                        <VidaUtil meses={p.vida_util_meses} max={maxVida} />
                      </TableCell>
                      <TableCell>
                        <Pill tono={p.activo ? "verde" : "gris"}>{p.activo ? "Activo" : "De baja"}</Pill>
                      </TableCell>
                      <TableCell>
                        {puedeEditar && (
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
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Tarjetas en mobile: una tabla de 6 columnas no entra en un teléfono */}
            <div className="space-y-2 md:hidden">
              {productos.map((p) => (
                <Card key={p.id} className={cn("p-3", !p.activo && "opacity-55")}>
                  <div className="flex items-start gap-3">
                    <IconoEquipo nombre={p.nombre} categoria={p.categoria} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.nombre}</p>
                      {p.marca && <p className="truncate text-xs text-muted-foreground">{p.marca}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {p.categoria && <Pill>{p.categoria}</Pill>}
                        <VidaUtil meses={p.vida_util_meses} max={maxVida} />
                        {p.precio != null && (
                          <span className="text-xs font-semibold tabular-nums">
                            {formatMoney(p.precio)}
                          </span>
                        )}
                        {!p.activo && <Pill tono="gris">De baja</Pill>}
                      </div>
                    </div>
                    {puedeEditar && (
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
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <Paginacion total={total} page={page} pageSize={pageSize} filtros={filtros} />
          </>
        )}
      </div>

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
