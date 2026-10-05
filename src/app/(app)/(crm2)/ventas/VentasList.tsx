"use client";

import * as React from "react";
import { ChevronRight, Plus } from "lucide-react";
import { IconoEquipoSimple } from "@/components/Equipamiento";
import { Button } from "@/components/crm/Button";
import { DataTable, TBody, THead, Td, Th, TableMessage, Tr, CellDate, CellNumber } from "@/components/crm/DataTable";
import { EmptyState } from "@/components/crm/Feedback";
import { FilaCompleta } from "@/components/crm/FilaCompleta";
import { ListFooter } from "@/components/crm/Lista";
import { PageBar } from "@/components/crm/PageBar";
import { Select } from "@/components/crm/Select";
import { ANCHO_FILTROS, FechaFiltro, FiltroOpciones, MasFiltros, SearchField, Toolbar } from "@/components/crm/Toolbar";
import { Tooltip } from "@/components/crm/Tooltip";
import { useApertura } from "@/components/crm/cuenta/FormDrawer";
import { FOCUS, TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { AnuncioResultados, useFiltrosUrl } from "@/components/FiltrosUrl";
import { formatFecha } from "@/lib/clientes";
import { formatMoney } from "@/lib/money";
import type { Tables } from "@/lib/supabase/types";
import VentaForm from "./VentaForm";
import { agruparItems, textoItems, totalItems } from "./logica";

type Venta = Tables<"ventas">;
type VentaItem = Tables<"venta_items">;
type Empresa = Tables<"empresas">;
/** La fila de la lista: la venta y el nombre de su cliente (lo trae la consulta, no depende de otra lista). */
type VentaFila = Venta & { empresa: { id: string; nombre: string } | null };
type Contacto = Tables<"contactos">;
type Producto = Tables<"productos">;

const COLUMNAS = 5;

/** "$" en gris y la cifra en mono (MASTER §4): las columnas alinean por los dígitos. */
function Monto({ valor }: { valor: number }) {
  return (
    <CellNumber unit="$" unitPosition="before">
      {formatMoney(valor).replace(/^\$/, "")}
    </CellNumber>
  );
}

/**
 * Historial de ventas (CRM 2.0, MASTER.md §10.16): PageBar, toolbar (búsqueda, cliente, desde y hasta por URL, los mismos
 * parámetros de siempre), DataTable de 36 px con una fila desplegable por venta (el detalle de productos que mostraba el
 * acordeón) y la banda de pie. Una venta no se edita ni se borra desde acá (nunca se pudo): la única acción es
 * "Nueva venta" (`ventas.editar`).
 */
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
  /** Solo la página actual: el servidor busca, filtra y pagina. */
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
  const filtros = useFiltrosUrl();
  const editor = useApertura<null>();
  // Una venta abierta a la vez, como el acordeón de antes.
  const [abierta, setAbierta] = React.useState<string | null>(null);

  const productoPorId = React.useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const itemsPorVenta = React.useMemo(() => agruparItems(items), [items]);

  const desde = filtros.valor("desde");
  const hasta = filtros.valor("hasta");
  const empresaValor = filtros.valor("empresa");
  const opcionesCliente = React.useMemo(
    () => [{ value: "", label: "Todos los clientes" }, ...empresas.map((e) => ({ value: e.id, label: e.nombre }))],
    [empresas],
  );
  const empresaElegida = opcionesCliente.some((o) => o.value === empresaValor) ? empresaValor : "";
  const secundariosActivos = [empresaElegida, desde, hasta].filter(Boolean).length;
  const aplicarCliente = (v: string) => filtros.aplicar({ empresa: v || null });

  const vacioReal = cuentasOk && totalVentas === 0;
  const contador = !cuentasOk ? `${total} ventas` : hayFiltro ? `${total} de ${totalVentas} ventas` : `${totalVentas} ventas registradas`;

  const nuevaVenta = puedeEditar && (
    <Button variant="primary" icon={Plus} onClick={() => editor.abrir(null)} aria-label="Nueva venta" className="max-sm:w-8 max-sm:px-0">
      <span className="max-sm:sr-only">Nueva venta</span>
    </Button>
  );

  return (
    <div className={cn(UI_ROOT, "flex h-full min-h-0 flex-col bg-(--crm-canvas) px-4 xl:px-6")}>
      <PageBar title="Ventas" count={contador} actions={nuevaVenta} />

      {!vacioReal && (
        <Toolbar>
          <SearchField filtros={filtros} label="Buscar venta" placeholder="Cliente, comprobante o producto…" className="sm:w-48 @[52rem]:w-72" />
          {/* Con ancho, cada filtro a la vista; con poco, juntos en "Más filtros". Mismos parámetros en los dos modos. */}
          <div className={ANCHO_FILTROS.chips}>
            <Select
              dense
              aria-label="Filtrar por cliente"
              className="w-52"
              searchable={empresas.length > 8}
              value={empresaElegida}
              onChange={aplicarCliente}
              options={opcionesCliente}
            />
            <FechaFiltro inline filtros={filtros} param="desde" label="Desde" max={hasta} />
            <FechaFiltro inline filtros={filtros} param="hasta" label="Hasta" min={desde} />
          </div>
          <div className={ANCHO_FILTROS.mas}>
            <MasFiltros activos={secundariosActivos}>
              <FiltroOpciones label="Cliente" value={empresaElegida} options={opcionesCliente} onChange={aplicarCliente} />
              <FechaFiltro filtros={filtros} param="desde" label="Desde" max={hasta} />
              <FechaFiltro filtros={filtros} param="hasta" label="Hasta" min={desde} />
            </MasFiltros>
          </div>
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
            title="Todavía no hay entregas asentadas"
            description="Asentá la primera venta: la fecha de entrega arranca el reloj del recambio."
            action={
              puedeEditar ? (
                <Button variant="primary" icon={Plus} onClick={() => editor.abrir(null)}>
                  Nueva venta
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-col pb-3">
            <DataTable label="Ventas" busy={filtros.pending} className="min-h-0">
              <THead>
                <Th width={112} hideBelow="sm">
                  Fecha
                </Th>
                <Th>Cliente</Th>
                <Th width={208} hideBelow="lg">
                  Comprobante
                </Th>
                <Th width={168} hideBelow="md">
                  Productos
                </Th>
                <Th align="right" className="w-28 @[30rem]:w-[136px]">
                  Total
                </Th>
              </THead>
              <TBody>
                {total === 0 ? (
                  <TableMessage colSpan={COLUMNAS}>
                    <EmptyState
                      compact
                      title={q ? `Ninguna venta con «${q}»` : "Ninguna venta con esos filtros"}
                      description="Probá por cliente, número de comprobante o producto, o con otras fechas."
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
                  ventas.map((v) => (
                    <FilaVenta
                      key={v.id}
                      venta={v}
                      detalle={itemsPorVenta.get(v.id) ?? []}
                      productoPorId={productoPorId}
                      abierta={abierta === v.id}
                      onAlternar={() => setAbierta((a) => (a === v.id ? null : v.id))}
                    />
                  ))
                )}
              </TBody>
            </DataTable>
          </div>

          <ListFooter filtros={filtros} total={total} page={page} pageSize={pageSize} />
        </>
      )}

      {puedeEditar && (
        <VentaForm
          key={editor.n}
          open={editor.abierto}
          onClose={editor.cerrar}
          empresas={empresas}
          contactos={contactos}
          productos={productos}
          onSaved={() => {
            editor.cerrar();
            // La fila nueva trae campos que completó un trigger (la vida útil copiada del catálogo): se vuelve a pedir.
            filtros.refrescar();
          }}
        />
      )}
    </div>
  );
}

/**
 * Una venta y, abierta, su detalle (MASTER.md §10.16). El disparador es un `<button>` con el nombre del cliente
 * (`aria-expanded`, `aria-controls` → la fila del detalle; Enter y Espacio nativos); el clic en el resto de la fila
 * también alterna. Las columnas que el contenedor esconde pasan a la línea de apoyo bajo el cliente:
 * - < 30rem: fecha · comprobante (los N ítems, bajo el total, como antes).
 * - 30–45rem: comprobante · N ítems.
 * - 45–60rem: comprobante (los productos tienen su columna).
 * - ≥ 60rem: una sola línea.
 */
function FilaVenta({
  venta: v,
  detalle,
  productoPorId,
  abierta,
  onAlternar,
}: {
  venta: VentaFila;
  detalle: VentaItem[];
  productoPorId: Map<string, Producto>;
  abierta: boolean;
  onAlternar: () => void;
}) {
  const detalleId = `venta-${v.id}-detalle`;
  const cliente = v.empresa?.nombre ?? "Cliente eliminado";
  const fecha = formatFecha(v.fecha);
  const total = totalItems(detalle);
  const items = textoItems(detalle.length);
  // Sin comprobante, entre 45 y 60rem la línea de apoyo no tendría nada: se esconde ahí también.
  const apoyo = v.comprobante ? "@[60rem]:hidden" : "@[45rem]:hidden";

  return (
    <>
      <Tr
        data-id={v.id}
        data-abierta={abierta || undefined}
        onClick={(ev) => {
          if ((ev.target as HTMLElement).closest("a, button")) return;
          onAlternar();
        }}
        className="cursor-pointer data-abierta:[&>td]:border-b-transparent"
      >
        <Td hideBelow="sm">
          <CellDate dateTime={v.fecha}>{fecha}</CellDate>
        </Td>
        <Td className="py-1">
          <button
            type="button"
            aria-expanded={abierta}
            aria-controls={abierta ? detalleId : undefined}
            aria-label={`${cliente}, ${fecha}`}
            onClick={onAlternar}
            className={cn("-ml-1 flex max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-(--crm-radius-sm) pl-1 pr-1 text-left", FOCUS)}
          >
            <ChevronRight
              aria-hidden="true"
              strokeWidth={1.75}
              className={cn(
                "size-4 shrink-0 text-(--crm-text-2) transition-transform duration-(--crm-dur-fast) motion-reduce:transition-none",
                abierta && "rotate-90",
              )}
            />
            <Tooltip content={cliente} onlyWhenTruncated>
              <span className="block min-w-0 truncate font-medium">{cliente}</span>
            </Tooltip>
          </button>
          {/* Puede ocupar dos renglones en el celular: cada dato entero (el comprobante no se recorta ni se parte). */}
          <div className={cn(TYPE.meta, "whitespace-normal pl-6 text-(--crm-text-2) [&>span]:mr-3", apoyo)}>
            <span className={cn(TYPE.mono, "inline-block @[30rem]:hidden")}>{fecha}</span>
            {v.comprobante && <span className={cn(TYPE.mono, "inline-block")}>{v.comprobante}</span>}
            <span className="hidden tabular-nums @[30rem]:inline-block @[45rem]:hidden">{items}</span>
          </div>
        </Td>
        <Td hideBelow="lg">
          {v.comprobante ? (
            <Tooltip content={v.comprobante} onlyWhenTruncated>
              <span className={cn(TYPE.mono, "block truncate text-(--crm-text-2)")}>{v.comprobante}</span>
            </Tooltip>
          ) : (
            <span className="text-(--crm-text-2)">—</span>
          )}
        </Td>
        <Td hideBelow="md">
          <span className="flex items-center gap-2">
            {/* Qué se entregó, sin desplegar: hasta tres equipos. Decorativo; el detalle abierto los nombra. */}
            <span aria-hidden="true" className="flex shrink-0 items-center gap-1">
              {detalle.slice(0, 3).map((it) => {
                const p = productoPorId.get(it.producto_id);
                return <IconoEquipoSimple key={it.id} nombre={p?.nombre} categoria={p?.categoria} className="size-4 text-(--crm-text-2)" />;
              })}
            </span>
            <span className="tabular-nums text-(--crm-text-2)">{items}</span>
          </span>
        </Td>
        <Td align="right" className="py-1">
          <Monto valor={total} />
          <span className={cn(TYPE.meta, "block tabular-nums text-(--crm-text-2) @[30rem]:hidden")}>{items}</span>
        </Td>
      </Tr>
      {abierta && (
        // Ocupa las columnas visibles (no las 5: las escondidas crearían columnas fantasma en el celular).
        <FilaCompleta id={detalleId} colSpan={COLUMNAS} className="border-b border-(--crm-border) bg-(--crm-canvas) py-2 pl-9 pr-3 @[30rem]:pl-[148px]">
          <DetalleVenta detalle={detalle} productoPorId={productoPorId} notas={v.notas} />
        </FilaCompleta>
      )}
    </>
  );
}

/**
 * El detalle de una venta, alineado bajo el nombre del cliente: una línea por producto (ícono, nombre, entrega, vida
 * útil, cantidad y subtotal) y las notas. Desde 45rem de contenedor, columnas; más angosto, la entrega, la vida útil y
 * la cantidad pasan a una segunda línea.
 */
function DetalleVenta({ detalle, productoPorId, notas }: { detalle: VentaItem[]; productoPorId: Map<string, Producto>; notas: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <ul aria-label="Productos de la venta" className="flex flex-col">
        {detalle.map((it) => {
          const p = productoPorId.get(it.producto_id);
          const entrega = `Entrega ${it.fecha_entrega ? formatFecha(it.fecha_entrega) : "—"}`;
          const vida = it.vida_util_meses != null ? `Vida útil ${it.vida_util_meses} meses` : null;
          return (
            <li
              key={it.id}
              className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-baseline gap-x-2 py-1 @[45rem]:grid-cols-[16px_minmax(0,1fr)_128px_152px_48px_120px]"
            >
              <IconoEquipoSimple nombre={p?.nombre} categoria={p?.categoria} className="size-4 translate-y-[3px] text-(--crm-text-2)" />
              <span className="min-w-0">
                <span className="block truncate">{p?.nombre ?? "Producto eliminado"}</span>
                <span className={cn(TYPE.meta, "block text-(--crm-text-2) @[45rem]:hidden")}>
                  {[entrega, vida, `×${it.cantidad}`].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className={cn(TYPE.meta, "hidden text-(--crm-text-2) tabular-nums @[45rem]:block")}>{entrega}</span>
              <span className={cn(TYPE.meta, "hidden text-(--crm-text-2) tabular-nums @[45rem]:block")}>{vida ?? ""}</span>
              <span className={cn(TYPE.mono, "hidden text-right text-(--crm-text-2) @[45rem]:block")}>×{it.cantidad}</span>
              <span className="text-right">
                <Monto valor={(it.precio_unitario ?? 0) * it.cantidad} />
              </span>
            </li>
          );
        })}
      </ul>
      {notas && <p className="max-w-prose whitespace-pre-line pb-1 text-[13px] leading-5 text-(--crm-text-2)">{notas}</p>}
    </div>
  );
}
