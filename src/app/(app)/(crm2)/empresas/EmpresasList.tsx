"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/crm/Button";
import { DataTable, TBody, THead, Td, Th, TableMessage, Tr, CellNumber, CellPerson, CellActions } from "@/components/crm/DataTable";
import { EmptyState } from "@/components/crm/Feedback";
import { FILA_SELECCIONABLE, LinkVistaPrevia, ListFooter, PanelVistaPrevia, useFocoFilas, useSeleccionUrl } from "@/components/crm/Lista";
import { Menu, type MenuItem } from "@/components/crm/Menu";
import { PageBar } from "@/components/crm/PageBar";
import { ANCHO_FILTROS, FiltroOpciones, FiltroSiNo, MasFiltros, SearchField, ToggleChip, Toolbar } from "@/components/crm/Toolbar";
import { Tooltip } from "@/components/crm/Tooltip";
import { EstadoCliente } from "@/components/crm/cuenta/estados";
import { FOCUS, TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { AnuncioResultados, useFiltrosUrl } from "@/components/FiltrosUrl";
import { ESTADOS, TIPOS_CLIENTE, etiquetaTipoCliente, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import type { Tables } from "@/lib/supabase/types";
import { itemsFila, useAccionesEmpresa } from "./acciones";

type Empresa = Tables<"empresas">;

const COLUMNAS = 7;

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
  const foco = useFocoFilas(empresas, { tabla, buscador });
  const ids = empresas.map((e) => e.id);
  const seleccion = useSeleccionUrl({ sel, ids, filtros, ficha: (id) => `/empresas/${id}`, enfocarFila: foco.enfocarFila });
  const acciones = useAccionesEmpresa({ perfiles, origenes, puedeAsignar, yoId }, () => {
    foco.trasCambio();
    filtros.refrescar();
  });
  const verBajas = filtros.valor("bajas") === "1";

  const perfilPorId = React.useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles]);
  const origenPorId = React.useMemo(() => new Map(origenes.map((o) => [o.id, o.nombre])), [origenes]);

  const base = Math.max(visiblesSinFiltro, total);
  const vacioReal = cuentasOk && !hayFiltro && visiblesSinFiltro + (verBajas ? 0 : dadasDeBaja) === 0;
  const contador = !cuentasOk
    ? `${total} empresas`
    : hayFiltro
      ? `${total} de ${base} empresas`
      : `${visiblesSinFiltro} empresas · ${totalContactos} contactos`;

  /** Menú de una fila. Si dar de baja o reactivar la saca de la lista, el foco va a la siguiente (`useFocoFilas`). */
  function menuDe(e: Empresa): MenuItem[] {
    const items = itemsFila(e, puedeEditar, acciones, () => router.push(`/empresas/${e.id}`));
    return foco.conFoco(items, e.id);
  }

  function nueva() {
    foco.olvidar();
    acciones.nueva();
  }

  const estadoValor = filtros.valor("estado");
  const tipoValor = filtros.valor("tipo");
  const responsableValor = filtros.valor("responsable");
  const origenValor = filtros.valor("origen");
  const opcionesTipo = [{ value: "", label: "Todos los tipos" }, ...TIPOS_CLIENTE.map((t) => ({ value: t.value, label: t.label }))];
  const opcionesResponsable = [{ value: "", label: "Todos los responsables" }, ...perfiles.map((p) => ({ value: p.id, label: p.nombre }))];
  const opcionesOrigen = [{ value: "", label: "Todos los orígenes" }, ...origenes.map((o) => ({ value: o.id, label: o.nombre }))];
  /** Un valor de la URL que no es una opción se ve como "todos" (igual que en el servidor). */
  const valido = (opciones: readonly { value: string }[], v: string) => (opciones.some((o) => o.value === v) ? v : "");
  // Los que "Más filtros" junta y cuenta (con ancho, cada uno es su chip).
  const secundariosActivos = [
    valido(opcionesTipo, tipoValor),
    puedeVerTodos ? valido(opcionesResponsable, responsableValor) : "",
    valido(opcionesOrigen, origenValor),
    verBajas ? "1" : "",
  ].filter(Boolean).length;

  const nuevaEmpresa = puedeEditar && (
    <Button variant="primary" icon={Plus} onClick={nueva} aria-label="Nueva empresa" className="max-sm:w-8 max-sm:px-0">
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
              <SearchField filtros={filtros} label="Buscar empresa o contacto" placeholder="Buscar empresa o contacto…" className={ANCHO_FILTROS.buscador} />
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
            {/* Filtros secundarios: chips sueltos con ancho; con poco ancho, juntos en "Más filtros" (ANCHO_FILTROS). */}
            <div className={ANCHO_FILTROS.chips}>
              <Menu
                label="Filtrar por tipo de cliente"
                chip={{ label: "Tipo", value: TIPOS_CLIENTE.find((t) => t.value === tipoValor)?.label }}
                items={opcionesTipo.map((t) => ({
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
                  items={opcionesResponsable.map((o) => ({
                    label: o.label,
                    checked: o.value === responsableValor,
                    onSelect: () => filtros.aplicar({ responsable: o.value || null }),
                  }))}
                  align="start"
                />
              )}
              <Menu
                label="Filtrar por origen"
                chip={{ label: "Origen", value: origenes.find((o) => o.id === origenValor)?.nombre }}
                items={opcionesOrigen.map((o) => ({
                  label: o.label,
                  checked: o.value === origenValor,
                  onSelect: () => filtros.aplicar({ origen: o.value || null }),
                }))}
                align="start"
              />
              <ToggleChip pressed={verBajas} onPressedChange={(v) => filtros.aplicar({ bajas: v ? "1" : null })}>
                Ver dadas de baja
                <span className="text-[12px] tabular-nums text-(--crm-text-2)">{dadasDeBaja}</span>
              </ToggleChip>
            </div>
            <div className={ANCHO_FILTROS.mas}>
              <MasFiltros activos={secundariosActivos}>
                <FiltroOpciones
                  label="Tipo"
                  value={valido(opcionesTipo, tipoValor)}
                  options={opcionesTipo}
                  onChange={(v) => filtros.aplicar({ tipo: v || null })}
                />
                {puedeVerTodos && (
                  <FiltroOpciones
                    label="Responsable"
                    value={valido(opcionesResponsable, responsableValor)}
                    options={opcionesResponsable}
                    onChange={(v) => filtros.aplicar({ responsable: v || null })}
                  />
                )}
                <FiltroOpciones
                  label="Origen"
                  value={valido(opcionesOrigen, origenValor)}
                  options={opcionesOrigen}
                  onChange={(v) => filtros.aplicar({ origen: v || null })}
                />
                <FiltroSiNo
                  label={`Ver dadas de baja (${dadasDeBaja})`}
                  checked={verBajas}
                  onChange={(v) => filtros.aplicar({ bajas: v ? "1" : null })}
                />
              </MasFiltros>
            </div>
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
                  <Button variant="primary" icon={Plus} onClick={nueva}>
                    Nueva empresa
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* onKeyDown en el contenedor: las flechas llegan burbujeando desde los links de cada fila. */}
            <div ref={tabla} onKeyDown={seleccion.alTeclado} className="flex min-h-0 flex-col pb-3">
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
                        seleccionada={e.id === seleccion.selVista}
                        responsable={(e.responsable_id && perfilPorId.get(e.responsable_id)) || null}
                        origen={(e.origen_id && origenPorId.get(e.origen_id)) || null}
                        gente={contactosPorEmpresa[e.id] ?? 0}
                        hrefPreview={seleccion.hrefSel(e.id)}
                        menu={menuDe(e)}
                        onClickFila={(ev) => seleccion.alClickFila(ev, e.id)}
                        onPreview={() => seleccion.elegir(e.id)}
                      />
                    ))
                  )}
                </TBody>
              </DataTable>
            </div>

            <ListFooter filtros={filtros} total={total} page={page} pageSize={pageSize} />
          </>
        )}

        {acciones.overlays}
      </div>

      {panel && <PanelVistaPrevia cargando={seleccion.cargandoPanel}>{panel}</PanelVistaPrevia>}
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
      className={FILA_SELECCIONABLE}
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
          <LinkVistaPrevia href={hrefPreview} nombre={e.nombre} onPreview={onPreview} />
        </CellActions>
      </Td>
    </Tr>
  );
}
