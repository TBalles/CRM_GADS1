"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PanelRight, Plus } from "lucide-react";
import { Button, buttonClass } from "@/components/crm/Button";
import { DataTable, TBody, THead, Td, Th, TableMessage, Tr, CellNumber, CellPerson, CellActions } from "@/components/crm/DataTable";
import { EmptyState, LoadingStatus } from "@/components/crm/Feedback";
import { Menu, type MenuItem } from "@/components/crm/Menu";
import { PageBar } from "@/components/crm/PageBar";
import { Pagination } from "@/components/crm/Pagination";
import { Select } from "@/components/crm/Select";
import { SearchField, ToggleChip, Toolbar } from "@/components/crm/Toolbar";
import { Tooltip } from "@/components/crm/Tooltip";
import { EstadoCliente } from "@/components/crm/cuenta/estados";
import { hayCapaAbierta } from "@/components/crm/overlay";
import { FOCUS, TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { AnuncioResultados, useFiltrosUrl } from "@/components/FiltrosUrl";
import { ESTADOS, TIPOS_CLIENTE, etiquetaTipoCliente, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import { TAMANIO_POR_DEFECTO, TAMANIOS_PAGINA, urlConParams } from "@/lib/paginacion";
import type { Tables } from "@/lib/supabase/types";
import { itemsFila, useAccionesEmpresa } from "./acciones";
import { vecinoSel } from "./seleccion";

type Empresa = Tables<"empresas">;

/** Desde acá hay vista previa (master-detail); debajo, la fila abre la ficha. Igual que `xl` de Tailwind. */
const MASTER_DETAIL = "(min-width: 1280px)";
const COLUMNAS = 7;
/** Con la tecla apretada (↓↓↓) se navega una sola vez, a la última fila, cuando las flechas paran este tiempo. */
const ESPERA_FLECHAS_MS = 200;

/**
 * Lista de empresas (CRM 2.0) + el lugar de la vista previa (`panel`, un server component que dibuja la página).
 *
 * La selección es la URL (`?sel=`). Para que la fila marcada se mueva al instante, la lista muestra una selección
 * optimista (`vista.sel`) mientras la navegación está en vuelo y la suelta cuando el servidor contesta con ese mismo
 * `sel` (o cuando la URL cambia por otro camino: atrás/adelante). No hay otra copia del estado.
 */
export default function EmpresasList({
  empresas,
  total,
  page,
  pageSize,
  q,
  hayFiltro,
  cuentasOk,
  visiblesSinFiltro,
  dadasDeBaja,
  totalContactos,
  contactosPorEmpresa,
  perfiles,
  origenes,
  puedeEditar,
  puedeAsignar,
  puedeVerTodos,
  yoId,
  sel,
  panel,
}: {
  /** Solo la página actual: el servidor busca, filtra y pagina. */
  empresas: Empresa[];
  total: number;
  page: number;
  pageSize: number;
  /** La búsqueda ya limpia, para repetirla en el "no hay resultados". */
  q: string;
  hayFiltro: boolean;
  /** Falso si algún conteo falló: no se sabe si hay empresas, así que no se muestra el vacío de "primera vez". */
  cuentasOk: boolean;
  visiblesSinFiltro: number;
  dadasDeBaja: number;
  totalContactos: number;
  contactosPorEmpresa: Record<string, number>;
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  /** Permisos del rol. Solo UX: la base exige cada uno igual. */
  puedeEditar: boolean;
  puedeAsignar: boolean;
  /** `clientes.ver_todos`: sin él, la base ya devuelve solo la cartera propia. */
  puedeVerTodos: boolean;
  yoId: string;
  /** La empresa elegida para la vista previa (`?sel=`), ya validada como uuid. */
  sel: string | null;
  /** La vista previa (`<Suspense key={sel}><VistaPrevia/></Suspense>`), o nada. */
  panel?: React.ReactNode;
}) {
  const router = useRouter();
  const filtros = useFiltrosUrl();
  const tabla = React.useRef<HTMLDivElement>(null);
  const buscador = React.useRef<HTMLDivElement>(null);
  const timer = React.useRef<number | undefined>(undefined);
  /** Fila a enfocar cuando vuelva la lista (la que tenía el foco puede desaparecer al darla de baja). */
  const focoTras = React.useRef<string | null>(null);
  const [navegando, startNav] = React.useTransition();
  const acciones = useAccionesEmpresa({ perfiles, origenes, puedeAsignar, yoId }, filtros.refrescar);
  const verBajas = filtros.valor("bajas") === "1";

  // Selección que se VE. `pedido`: lo último que se mandó a la URL (undefined = nada en vuelo; null = cerrar).
  const [vista, setVista] = React.useState<{ sel: string | null; base: string | null; pedido: string | null | undefined }>({
    sel,
    base: sel,
    pedido: undefined,
  });
  if (vista.base !== sel) {
    // La URL cambió. Si es la respuesta a lo último pedido (o un cambio ajeno: atrás/adelante), se sigue a la URL;
    // si es la respuesta a un pedido VIEJO (las flechas siguieron), se mantiene lo que la persona ya está viendo.
    const enVuelo = vista.pedido !== undefined && vista.pedido !== sel;
    setVista({ sel: enVuelo ? vista.sel : sel, base: sel, pedido: enVuelo ? vista.pedido : undefined });
  }
  const selVista = vista.sel;
  const cargandoPanel = navegando || vista.pedido !== undefined;

  const perfilPorId = React.useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles]);
  const origenPorId = React.useMemo(() => new Map(origenes.map((o) => [o.id, o.nombre])), [origenes]);

  const base = Math.max(visiblesSinFiltro, total);
  const vacioReal = cuentasOk && !hayFiltro && visiblesSinFiltro + (verBajas ? 0 : dadasDeBaja) === 0;
  const contador = !cuentasOk
    ? `${total} empresas`
    : hayFiltro
      ? `${total} de ${base} empresas`
      : `${visiblesSinFiltro} empresas · ${totalContactos} contactos`;

  const hrefSel = (id: string | null) => urlConParams(filtros.pathname, filtros.params, { sel: id });
  const ids = empresas.map((e) => e.id);

  /** Elige (o quita, con null) la vista previa: marca al instante y navega (ya, o al soltar las flechas). */
  function elegir(id: string | null, { esperar = false } = {}) {
    setVista((v) => ({ ...v, sel: id, pedido: id }));
    window.clearTimeout(timer.current);
    const ir = () => startNav(() => router.push(hrefSel(id), { scroll: false }));
    if (esperar) timer.current = window.setTimeout(ir, ESPERA_FLECHAS_MS);
    else ir();
  }
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  /** Foco al nombre de la fila `id` (Enter ahí abre la ficha: es un link). */
  function enfocarFila(id: string) {
    tabla.current?.querySelector<HTMLElement>(`tr[data-id="${id}"] [data-nombre]`)?.focus();
  }

  // ↑/↓ mueven la selección desde la fila CON FOCO. Solo con vista previa (≥ 1280).
  function alTeclado(e: React.KeyboardEvent) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const objetivo = e.target as HTMLElement;
    const fila = objetivo.closest<HTMLElement>("tr[data-id]");
    if (!fila || objetivo.closest("[aria-haspopup]")) return;
    if (!window.matchMedia(MASTER_DETAIL).matches) return;
    e.preventDefault();
    const destino = vecinoSel(ids, selVista, fila.dataset.id ?? null, e.key === "ArrowDown" ? "next" : "prev");
    if (!destino) return;
    enfocarFila(destino);
    if (destino !== selVista) elegir(destino, { esperar: true });
  }

  // Esc cierra la vista previa. Este listener se registra ANTES que el de un menú o drawer que se abra después (mismo
  // `document`, orden de registro), así que no alcanza con `defaultPrevented`: si hay una capa abierta, el Esc es suyo.
  React.useEffect(() => {
    if (!selVista) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (hayCapaAbierta() || document.querySelector('[aria-modal="true"]')) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, [contenteditable], [role="menu"], [role="listbox"], [role="dialog"]')) return;
      if (!window.matchMedia(MASTER_DETAIL).matches) return;
      e.preventDefault();
      const cerrada = selVista;
      elegir(null);
      enfocarFila(cerrada);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // Debajo de 1280 no hay vista previa: un `?sel=` (link directo, ventana que se achica) se quita de la URL para que
  // el servidor deje de dibujar un panel que no se ve. Un link con `sel` abierto en una pantalla ancha no se toca.
  React.useEffect(() => {
    const mq = window.matchMedia(MASTER_DETAIL);
    const quitar = () => {
      if (!mq.matches && sel) router.replace(urlConParams(filtros.pathname, filtros.params, { sel: null }), { scroll: false });
    };
    quitar();
    mq.addEventListener("change", quitar);
    return () => mq.removeEventListener("change", quitar);
  }, [sel, router, filtros.pathname, filtros.params]);

  // Volvió la lista después de una baja o reactivación: el foco a la fila que corresponde (o al buscador).
  React.useEffect(() => {
    const id = focoTras.current;
    if (!id) return;
    focoTras.current = null;
    const fila = ids.includes(id) ? id : null;
    if (fila) enfocarFila(fila);
    else buscador.current?.querySelector("input")?.focus();
  }, [empresas]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Menú de una fila: si la acción puede sacar la fila de la lista, se recuerda a dónde llevar el foco. */
  function menuDe(e: Empresa): MenuItem[] {
    const i = ids.indexOf(e.id);
    const siguiente = ids[i + 1] ?? ids[i - 1] ?? null;
    return itemsFila(e, puedeEditar, acciones, () => router.push(`/empresas/${e.id}`)).map((it) =>
      it.label === "Dar de baja" || it.label === "Reactivar"
        ? {
            ...it,
            onSelect: () => {
              focoTras.current = it.label === "Dar de baja" && !verBajas ? siguiente : e.id;
              it.onSelect();
            },
          }
        : it,
    );
  }

  /** Clic en la fila (fuera de sus links y botones): ≥ 1280 la elige; debajo abre la ficha. */
  function alClickFila(ev: React.MouseEvent, id: string) {
    if ((ev.target as HTMLElement).closest("a, button, input")) return;
    if (window.matchMedia(MASTER_DETAIL).matches) elegir(id);
    else router.push(`/empresas/${id}`);
  }

  const estadoValor = filtros.valor("estado");
  const tipoValor = filtros.valor("tipo");
  const responsableValor = filtros.valor("responsable");
  const origenValor = filtros.valor("origen");

  const nuevaEmpresa = puedeEditar && (
    <Button variant="primary" icon={Plus} onClick={acciones.nueva} aria-label="Nueva empresa" className="max-sm:w-8 max-sm:px-0">
      <span className="max-sm:sr-only">Nueva empresa</span>
    </Button>
  );

  return (
    // Una fila: la lista ocupa el resto y, con una empresa elegida (desde 1280), la vista previa a la derecha.
    <div className={cn(UI_ROOT, "flex h-full min-h-0 bg-(--crm-canvas)")}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 xl:px-6">
        <PageBar title="Empresas" count={contador} actions={nuevaEmpresa} />

        {!vacioReal && (
          <Toolbar>
            <div ref={buscador} className="contents">
              <SearchField filtros={filtros} label="Buscar empresa o contacto" placeholder="Buscar empresa o contacto…" />
            </div>
            <Menu
              label="Filtrar por estado"
              chip={{ label: "Estado", value: ESTADOS.find((s) => s.value === estadoValor)?.label }}
              items={[{ value: "", label: "Todos los estados" }, ...ESTADOS].map((s) => ({
                label: s.label,
                checked: s.value === estadoValor,
                onSelect: () => filtros.aplicar({ estado: s.value || null }),
              }))}
              align="start"
            />
            <Menu
              label="Filtrar por tipo de cliente"
              chip={{ label: "Tipo", value: TIPOS_CLIENTE.find((t) => t.value === tipoValor)?.label }}
              items={[{ value: "", label: "Todos los tipos" }, ...TIPOS_CLIENTE].map((t) => ({
                label: t.label,
                checked: t.value === tipoValor,
                onSelect: () => filtros.aplicar({ tipo: t.value || null }),
              }))}
              align="start"
            />
            {puedeVerTodos && (
              <Menu
                label="Filtrar por responsable"
                chip={{ label: "Responsable", value: perfiles.find((p) => p.id === responsableValor)?.nombre }}
                items={[{ id: "", nombre: "Todos los responsables" }, ...perfiles].map((p) => ({
                  label: p.nombre,
                  checked: p.id === responsableValor,
                  onSelect: () => filtros.aplicar({ responsable: p.id || null }),
                }))}
                align="start"
              />
            )}
            <Menu
              label="Filtrar por origen"
              chip={{ label: "Origen", value: origenes.find((o) => o.id === origenValor)?.nombre }}
              items={[{ id: "", nombre: "Todos los orígenes" }, ...origenes].map((o) => ({
                label: o.nombre,
                checked: o.id === origenValor,
                onSelect: () => filtros.aplicar({ origen: o.id || null }),
              }))}
              align="start"
            />
            <ToggleChip pressed={verBajas} onPressedChange={(v) => filtros.aplicar({ bajas: v ? "1" : null })}>
              Ver dadas de baja
              <span className="text-[12px] tabular-nums text-(--crm-text-2)">{dadasDeBaja}</span>
            </ToggleChip>
            {hayFiltro && (
              <Button variant="ghost" size="sm" onClick={() => filtros.limpiar(["vista", "tab", "pageSize", "sel"])}>
                Limpiar filtros
              </Button>
            )}
          </Toolbar>
        )}

        <AnuncioResultados total={total} />

        {vacioReal ? (
          <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
            <EmptyState
              title={puedeVerTodos ? "La cartera está vacía" : "Tu cartera está vacía"}
              description={
                puedeVerTodos
                  ? "Cargá el primer club, cancha de fútbol 5 o escuela. Después entrá a su ficha y sumale su gente."
                  : "Acá ves las empresas que cargás o que te asignan. Cargá la primera, o pedile a tu responsable comercial que te asigne alguna."
              }
              action={
                puedeEditar ? (
                  <Button variant="primary" icon={Plus} onClick={acciones.nueva}>
                    Nueva empresa
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* onKeyDown en el contenedor: las flechas llegan burbujeando desde los links de cada fila. */}
            <div ref={tabla} onKeyDown={alTeclado} className="flex min-h-0 flex-col pb-3">
              <DataTable label="Empresas" busy={filtros.pending} className="min-h-0">
                <THead>
                  <Th>Empresa</Th>
                  <Th width={168} hideBelow="lg">
                    Tipo
                  </Th>
                  <Th width={120} hideBelow="sm">
                    Estado
                  </Th>
                  <Th width={160} hideBelow="sm">
                    Responsable
                  </Th>
                  <Th width={152} hideBelow="lg">
                    Origen
                  </Th>
                  <Th width={88} align="right" hideBelow="md">
                    Contactos
                  </Th>
                  <Th width={72}>
                    <span className="sr-only">Acciones</span>
                  </Th>
                </THead>
                <TBody>
                  {total === 0 ? (
                    <TableMessage colSpan={COLUMNAS}>
                      <EmptyState
                        compact
                        title={
                          q
                            ? `Ninguna empresa con «${q}»`
                            : visiblesSinFiltro === 0 && !hayFiltro
                              ? "No hay empresas activas"
                              : "Ninguna empresa con esos filtros"
                        }
                        description={
                          visiblesSinFiltro === 0 && !hayFiltro
                            ? `Las ${dadasDeBaja} que tenés están dadas de baja. Activá «Ver dadas de baja» para verlas o reactivarlas.`
                            : "Probá con el CUIT, el mail o el nombre de uno de sus contactos, o aflojá los filtros."
                        }
                        action={
                          hayFiltro ? (
                            <Button size="sm" onClick={() => filtros.limpiar(["vista", "tab", "pageSize", "sel"])}>
                              Limpiar filtros
                            </Button>
                          ) : undefined
                        }
                      />
                    </TableMessage>
                  ) : (
                    empresas.map((e) => (
                      <Fila
                        key={e.id}
                        empresa={e}
                        seleccionada={e.id === selVista}
                        responsable={(e.responsable_id && perfilPorId.get(e.responsable_id)) || null}
                        origen={(e.origen_id && origenPorId.get(e.origen_id)) || null}
                        gente={contactosPorEmpresa[e.id] ?? 0}
                        hrefPreview={hrefSel(e.id)}
                        menu={menuDe(e)}
                        onClickFila={(ev) => alClickFila(ev, e.id)}
                        onPreview={() => elegir(e.id)}
                      />
                    ))
                  )}
                </TBody>
              </DataTable>
            </div>

            {/* Banda de pie, pegada abajo del área de trabajo: la tabla queda a su alto natural y el rango no flota. */}
            {total > 0 && (
              <div className="-mx-4 mt-auto flex min-h-10 shrink-0 items-center border-t border-(--crm-border) bg-(--crm-panel) px-4 py-1 xl:-mx-6 xl:px-6">
                <Pagination
                  total={total}
                  page={page}
                  pageSize={pageSize}
                  pathname={filtros.pathname}
                  params={filtros.params}
                  ir={filtros.ir}
                  className="w-full"
                  pageSizeControl={
                    total > TAMANIOS_PAGINA[0] && (
                      <Select
                        dense
                        aria-label="Filas por página"
                        className="w-36"
                        value={String(pageSize)}
                        onChange={(v) => filtros.aplicar({ pageSize: v === String(TAMANIO_POR_DEFECTO) ? null : v })}
                        options={TAMANIOS_PAGINA.map((n) => ({ value: String(n), label: `${n} por página` }))}
                      />
                    )
                  }
                />
              </div>
            )}
          </>
        )}

        {acciones.overlays}
      </div>

      {panel && (
        // La vista previa que llega del servidor; mientras la nueva está en camino, la vieja se atenúa y avisa.
        <div
          aria-busy={cargandoPanel || undefined}
          className={cn("hidden min-h-0 transition-opacity duration-(--crm-dur-fast) xl:flex", cargandoPanel && "opacity-60 motion-reduce:transition-none")}
        >
          {cargandoPanel && <LoadingStatus label="Cargando vista previa…" />}
          {panel}
        </div>
      )}
    </div>
  );
}

/**
 * Una fila. Las columnas que el contenedor esconde no se pierden: pasan a una línea de apoyo (12, secundaria) debajo
 * del nombre (MASTER.md §10.13):
 * - < 30rem (celular): estado · tipo · responsable · N contactos (sin columnas de estado ni responsable).
 * - 30–45rem: tipo · origen · mail/teléfono · N contactos.
 * - 45–60rem (vista previa abierta): tipo · origen · mail/teléfono.
 * - ≥ 60rem: una sola línea; tipo y origen en sus columnas, el mail en gris junto al nombre.
 */
function Fila({
  empresa: e,
  seleccionada,
  responsable,
  origen,
  gente,
  hrefPreview,
  menu,
  onClickFila,
  onPreview,
}: {
  empresa: Empresa;
  seleccionada: boolean;
  responsable: string | null;
  origen: string | null;
  gente: number;
  hrefPreview: string;
  menu: MenuItem[];
  onClickFila: (ev: React.MouseEvent) => void;
  onPreview: () => void;
}) {
  const tipo = etiquetaTipoCliente(e.tipo_cliente);
  const contacto = e.email ?? e.telefono;
  return (
    <Tr
      data-id={e.id}
      selected={seleccionada}
      onClick={onClickFila}
      // Sin vista previa (< 1280) un `?sel=` no se marca: la fila no tiene panel al que apuntar.
      className="cursor-pointer max-xl:data-selected:bg-transparent max-xl:data-selected:hover:bg-(--crm-hover) max-xl:data-selected:[&>td:first-child]:shadow-none"
    >
      <Td className="py-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <Tooltip content={e.nombre} onlyWhenTruncated>
            <Link href={`/empresas/${e.id}`} data-nombre className={cn("block min-w-0 truncate rounded-[2px] font-medium text-(--crm-text) hover:underline", FOCUS)}>
              {e.nombre}
            </Link>
          </Tooltip>
          {contacto && <span className="hidden min-w-0 shrink-[2] truncate text-(--crm-text-2) @[60rem]:block">{contacto}</span>}
        </div>
        {/* Una sola línea que recorta con "…" al final: lo primero (estado, tipo) siempre se ve. */}
        <div className={cn(TYPE.meta, "truncate text-(--crm-text-2) @[60rem]:hidden [&>span]:mr-3")}>
          <span className="@[30rem]:hidden">
            <EstadoCliente estado={e.estado} className="align-[-1px]" />
          </span>
          {tipo && <span>{tipo}</span>}
          <span className="@[30rem]:hidden">{responsable ?? "Sin asignar"}</span>
          {origen && <span className="hidden @[30rem]:inline">{origen}</span>}
          {contacto && <span className="hidden @[30rem]:inline">{contacto}</span>}
          <span className="tabular-nums @[45rem]:hidden">
            {gente} {gente === 1 ? "contacto" : "contactos"}
          </span>
        </div>
      </Td>
      <Td hideBelow="lg">{tipo ?? <span className="text-(--crm-text-2)">—</span>}</Td>
      <Td hideBelow="sm">
        <EstadoCliente estado={e.estado} />
      </Td>
      <Td hideBelow="sm">{responsable ? <CellPerson name={responsable} /> : <span className="text-(--crm-text-2)">Sin asignar</span>}</Td>
      <Td hideBelow="lg">{origen ?? <span className="text-(--crm-text-2)">—</span>}</Td>
      <Td align="right" hideBelow="md">
        <CellNumber>{gente}</CellNumber>
      </Td>
      <Td className="overflow-visible px-1">
        <CellActions menu={<Menu label={`Acciones de ${e.nombre}`} size="sm" items={menu} />}>
          {/* Elegir para la vista previa: link real (`?sel=`, se puede abrir en otra pestaña), solo desde 1280. Fuera
              del orden de Tab: con teclado se elige con ↑/↓ (y Enter en el nombre abre la ficha). */}
          <Tooltip content="Vista previa">
            <Link
              href={hrefPreview}
              scroll={false}
              tabIndex={-1}
              data-preview
              aria-label={`Vista previa de ${e.nombre}`}
              onClick={(ev) => {
                if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
                ev.preventDefault();
                onPreview();
              }}
              className={buttonClass({ variant: "ghost", size: "sm", className: "hidden w-7 px-0 xl:inline-flex" })}
            >
              <PanelRight aria-hidden="true" strokeWidth={1.75} />
            </Link>
          </Tooltip>
        </CellActions>
      </Td>
    </Tr>
  );
}
