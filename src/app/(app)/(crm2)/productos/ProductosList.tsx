"use client";

import * as React from "react";
import { Pencil, Plus, Power } from "lucide-react";
import { IconoEquipoSimple } from "@/components/Equipamiento";
import { Button } from "@/components/crm/Button";
import { DataTable, TBody, THead, Td, Th, TableMessage, Tr, CellActions, CellNumber } from "@/components/crm/DataTable";
import { ConfirmDialog } from "@/components/crm/Dialog";
import { EmptyState } from "@/components/crm/Feedback";
import { ListFooter, useFocoFilas } from "@/components/crm/Lista";
import { Menu, type MenuItem } from "@/components/crm/Menu";
import { PageBar } from "@/components/crm/PageBar";
import { StatusDot } from "@/components/crm/Status";
import { useCrmToast } from "@/components/crm/Toast";
import { SearchField, Toolbar } from "@/components/crm/Toolbar";
import { Tooltip } from "@/components/crm/Tooltip";
import { useApertura } from "@/components/crm/cuenta/FormDrawer";
import { TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { AnuncioResultados, useFiltrosUrl } from "@/components/FiltrosUrl";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/money";
import type { Tables } from "@/lib/supabase/types";
import ProductoForm from "./ProductoForm";

type Producto = Tables<"productos">;

const ESTADOS = [
  { value: "", label: "Activos y de baja" },
  { value: "activo", label: "Activos" },
  { value: "baja", label: "De baja" },
];

/**
 * "5 años" / "18 meses": la vida útil es la que dispara las alertas de recambio, así que es un dato propio y en texto
 * plano. Sin cargar (el producto no lleva seguimiento) no hay texto: "—" en la columna (con "Sin seguimiento" para
 * lectores de pantalla) y nada en la línea de apoyo del celular.
 */
function textoVida(meses: number): string {
  const anios = meses / 12;
  return meses >= 12 && Number.isInteger(anios) ? `${anios} ${anios === 1 ? "año" : "años"}` : `${meses} ${meses === 1 ? "mes" : "meses"}`;
}

function VidaUtil({ meses }: { meses: number | null }) {
  if (meses == null)
    return (
      <span className="text-(--crm-text-2)">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Sin seguimiento</span>
      </span>
    );
  return <span className="tabular-nums">{textoVida(meses)}</span>;
}

/** Activo / De baja: punto + palabra (el color nunca es la única señal). */
function EstadoProducto({ activo, className }: { activo: boolean; className?: string }) {
  return (
    <StatusDot tone={activo ? "success" : "neutral"} className={className}>
      {activo ? "Activo" : "De baja"}
    </StatusDot>
  );
}

/** Precio de lista: "$" en gris y la cifra en mono; sin precio cargado, "—" (no es lo mismo que $ 0). */
function Precio({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="text-(--crm-text-2)">—</span>;
  return (
    <CellNumber unit="$" unitPosition="before">
      {formatMoney(valor).replace(/^\$/, "")}
    </CellNumber>
  );
}

/**
 * Catálogo de productos (CRM 2.0): PageBar, toolbar (búsqueda, categoría y estado por URL), DataTable de 36 px y la banda
 * de pie. Sin ficha ni vista previa: la fila no navega; editar y dar de baja / reactivar van en su `⋮` (con
 * `productos.editar`). Un producto no se borra: se da de baja (las ventas lo referencian).
 */
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
  categorias,
  puedeEditar,
}: {
  /** Solo la página actual: el servidor busca, filtra y pagina. */
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
  categorias: string[];
  /** Sin `productos.editar`: solo lectura. La base igual lo exige. */
  puedeEditar: boolean;
}) {
  const filtros = useFiltrosUrl();
  const tabla = React.useRef<HTMLDivElement>(null);
  const buscador = React.useRef<HTMLDivElement>(null);
  const foco = useFocoFilas(productos, { tabla, buscador });
  const editor = useApertura<Producto | null>();
  const [dandoDeBaja, setDandoDeBaja] = React.useState<Producto | null>(null);
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(new Set());
  const { showToast } = useCrmToast();
  const estadoValor = filtros.valor("estado");
  const categoriaValor = filtros.valor("categoria");

  function refrescar() {
    foco.trasCambio();
    filtros.refrescar();
  }

  /**
   * Un producto no se borra: se da de baja. Borrarlo rompería el historial de ventas que lo referencia (la FK es
   * `on delete restrict` justamente para eso) y dejaría alertas huérfanas de equipos que sí se entregaron.
   */
  async function cambiarActivo(producto: Producto) {
    if (pendingIds.has(producto.id)) return;
    const proximo = !producto.activo;
    setPendingIds((prev) => new Set(prev).add(producto.id));
    const { error } = await createClient().from("productos").update({ activo: proximo }).eq("id", producto.id);
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
    refrescar();
  }

  /** El `⋮` de una fila. Si el cambio de estado la saca de la lista (filtro "Activos" o "De baja"), el foco va a la siguiente. */
  function menuDe(p: Producto): MenuItem[] {
    const items: MenuItem[] = [
      { label: "Editar", icon: Pencil, onSelect: () => editor.abrir(p) },
      p.activo
        ? { label: "Dar de baja", icon: Power, variant: "danger", onSelect: () => setDandoDeBaja(p) }
        : { label: "Reactivar", icon: Power, onSelect: () => void cambiarActivo(p) },
    ];
    return foco.conFoco(items, p.id);
  }

  function nuevo() {
    foco.olvidar();
    editor.abrir(null);
  }

  const vacioReal = cuentasOk && totalCatalogo === 0;
  const contador = !cuentasOk
    ? `${total} productos`
    : hayFiltro
      ? `${total} de ${totalCatalogo} productos`
      : `${totalCatalogo} productos · ${conSeguimiento} con vida útil`;
  const columnas = puedeEditar ? 6 : 5;

  const nuevoProducto = puedeEditar && (
    <Button variant="primary" icon={Plus} onClick={nuevo} aria-label="Nuevo producto" className="max-sm:w-8 max-sm:px-0">
      <span className="max-sm:sr-only">Nuevo producto</span>
    </Button>
  );

  return (
    <div className={cn(UI_ROOT, "flex h-full min-h-0 flex-col bg-(--crm-canvas) px-4 xl:px-6")}>
      <PageBar title="Productos" count={contador} actions={nuevoProducto} />

      {!vacioReal && (
        <Toolbar>
          <div ref={buscador} className="contents">
            <SearchField filtros={filtros} label="Buscar producto" placeholder="Buscar producto…" />
          </div>
          <Menu
            label="Filtrar por categoría"
            chip={{ label: "Categoría", value: categorias.find((c) => c === categoriaValor) }}
            items={["", ...categorias].map((c) => ({
              label: c || "Todas las categorías",
              checked: c === categoriaValor,
              onSelect: () => filtros.aplicar({ categoria: c || null }),
            }))}
            align="start"
          />
          <Menu
            label="Filtrar por estado"
            chip={{ label: "Estado", value: ESTADOS.find((s) => s.value && s.value === estadoValor)?.label }}
            items={ESTADOS.map((s) => ({
              label: s.label,
              checked: s.value === estadoValor,
              onSelect: () => filtros.aplicar({ estado: s.value || null }),
            }))}
            align="start"
          />
          {hayFiltro && (
            <Button variant="ghost" size="sm" onClick={() => filtros.limpiar()}>
              Limpiar filtros
            </Button>
          )}
        </Toolbar>
      )}

      <AnuncioResultados total={total} />

      {vacioReal ? (
        <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
          <EmptyState
            title="El catálogo está vacío"
            description="Cargá lo que vendés —arcos, redes, conos— con su vida útil en meses. Ese número es el que después dispara los avisos."
            action={
              puedeEditar ? (
                <Button variant="primary" icon={Plus} onClick={nuevo}>
                  Nuevo producto
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div ref={tabla} className="flex min-h-0 flex-col pb-3">
            <DataTable label="Productos" busy={filtros.pending} className="min-h-0">
              <THead>
                <Th>Producto</Th>
                <Th width={168} hideBelow="md">
                  Categoría
                </Th>
                <Th width={128} align="right" hideBelow="sm">
                  Precio
                </Th>
                <Th width={152} hideBelow="md">
                  Vida útil
                </Th>
                <Th width={112} hideBelow="sm">
                  Estado
                </Th>
                {puedeEditar && (
                  <Th width={48}>
                    <span className="sr-only">Acciones</span>
                  </Th>
                )}
              </THead>
              <TBody>
                {total === 0 ? (
                  <TableMessage colSpan={columnas}>
                    <EmptyState
                      compact
                      title={q ? `«${q}» no está en el catálogo` : "Ningún producto con esos filtros"}
                      description="Probá por marca o por categoría: redes, arcos, pelotas…"
                      action={
                        hayFiltro ? (
                          <Button size="sm" onClick={() => filtros.limpiar()}>
                            Limpiar filtros
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableMessage>
                ) : (
                  productos.map((p) => <Fila key={p.id} producto={p} menu={puedeEditar ? menuDe(p) : null} />)
                )}
              </TBody>
            </DataTable>
          </div>

          <ListFooter filtros={filtros} total={total} page={page} pageSize={pageSize} />
        </>
      )}

      <ProductoForm
        key={editor.n}
        open={editor.abierto}
        onClose={editor.cerrar}
        producto={editor.valor ?? undefined}
        onSaved={() => {
          editor.cerrar();
          refrescar();
        }}
      />
      <ConfirmDialog
        open={Boolean(dandoDeBaja)}
        onClose={() => setDandoDeBaja(null)}
        onConfirm={async () => {
          if (dandoDeBaja) await cambiarActivo(dandoDeBaja);
        }}
        title="Dar de baja el producto"
        description={
          dandoDeBaja
            ? `"${dandoDeBaja.nombre}" deja de aparecer al cargar ventas nuevas. El historial de ventas y las alertas de los equipos ya entregados no se tocan.`
            : ""
        }
        confirmText="Dar de baja"
        variant="danger"
      />
    </div>
  );
}

/**
 * Una fila (MASTER.md §10.14). Las columnas que el contenedor esconde pasan a una línea de apoyo bajo el nombre:
 * - < 30rem (celular): "De baja" (solo si lo está: "Activo" en cada fila es ruido) · precio · categoría · vida útil · marca
 *   (lo que más pesa primero: la línea recorta al final).
 * - 30–45rem: categoría · vida útil · marca (precio y estado en sus columnas).
 * - ≥ 45rem: una sola línea; la marca en gris junto al nombre.
 * Un producto de baja lleva el nombre en `--crm-text-2` (6.8:1, AA) además del punto + palabra: se distingue sin atenuar
 * la fila entera (la opacidad bajaba el contraste debajo de AA).
 */
function Fila({ producto: p, menu }: { producto: Producto; menu: MenuItem[] | null }) {
  return (
    <Tr data-id={p.id}>
      <Td className="py-1">
        <div className="flex min-w-0 items-center gap-2">
          <IconoEquipoSimple nombre={p.nombre} categoria={p.categoria} className="size-4 shrink-0 text-(--crm-text-2)" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-2">
              <Tooltip content={p.nombre} onlyWhenTruncated>
                <span className={cn("block min-w-0 truncate font-medium", !p.activo && "text-(--crm-text-2)")}>{p.nombre}</span>
              </Tooltip>
              {p.marca && <span className="hidden min-w-0 shrink-[2] truncate text-(--crm-text-2) @[45rem]:block">{p.marca}</span>}
            </div>
            <div className={cn(TYPE.meta, "truncate text-(--crm-text-2) @[45rem]:hidden [&>span]:mr-3")}>
              {!p.activo && (
                <span className="@[30rem]:hidden">
                  <EstadoProducto activo={false} className="align-[-1px]" />
                </span>
              )}
              {p.precio != null && <span className="tabular-nums @[30rem]:hidden">{formatMoney(p.precio)}</span>}
              {p.categoria && <span>{p.categoria}</span>}
              {p.vida_util_meses != null && <span className="tabular-nums">{textoVida(p.vida_util_meses)}</span>}
              {p.marca && <span>{p.marca}</span>}
            </div>
          </div>
        </div>
      </Td>
      <Td hideBelow="md">{p.categoria ?? <span className="text-(--crm-text-2)">—</span>}</Td>
      <Td align="right" hideBelow="sm">
        <Precio valor={p.precio} />
      </Td>
      <Td hideBelow="md">
        <VidaUtil meses={p.vida_util_meses} />
      </Td>
      <Td hideBelow="sm">
        <EstadoProducto activo={p.activo} />
      </Td>
      {menu && (
        <Td className="overflow-visible px-1">
          <CellActions menu={<Menu label={`Acciones de ${p.nombre}`} size="sm" items={menu} />} />
        </Td>
      )}
    </Tr>
  );
}
