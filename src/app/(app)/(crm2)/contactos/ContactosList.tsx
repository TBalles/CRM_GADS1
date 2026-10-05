"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/crm/Button";
import { DataTable, TBody, THead, Td, Th, TableMessage, Tr, CellPerson, CellActions } from "@/components/crm/DataTable";
import { EmptyState } from "@/components/crm/Feedback";
import { FILA_SELECCIONABLE, LinkVistaPrevia, ListFooter, PanelVistaPrevia, useFocoFilas, useSeleccionUrl } from "@/components/crm/Lista";
import { Menu, type MenuItem } from "@/components/crm/Menu";
import { PageBar } from "@/components/crm/PageBar";
import { Tag } from "@/components/crm/Status";
import { ANCHO_FILTROS, FiltroOpciones, FiltroSiNo, MasFiltros, SearchField, ToggleChip, Toolbar } from "@/components/crm/Toolbar";
import { Tooltip } from "@/components/crm/Tooltip";
import { EstadoCliente } from "@/components/crm/cuenta/estados";
import { FOCUS, TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { AnuncioResultados, useFiltrosUrl } from "@/components/FiltrosUrl";
import { ESTADOS, nombreCompleto, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import type { EmpresaOpcion } from "@/lib/formularios/contacto";
import type { Tables } from "@/lib/supabase/types";
import { itemsFila, useAccionesContacto } from "./acciones";

type Contacto = Tables<"contactos">;
/** La fila de la lista: el contacto y el nombre de su empresa (la trae la consulta, no depende de otra lista). */
type ContactoFila = Contacto & { empresa: { id: string; nombre: string } | null };

const VINCULOS = [
  { value: "", label: "Con y sin empresa" },
  { value: "empresa", label: "De una empresa" },
  { value: "individual", label: "Clientes individuales" },
];
const COLUMNAS = 5;
const LIMPIAR_CONSERVA = ["vista", "tab", "pageSize", "sel"];

/**
 * Lista de contactos (CRM 2.0) + el lugar de la vista previa (`panel`, un server component que dibuja la página). Mismo
 * master-detail que Empresas (`useSeleccionUrl`): la selección es la URL (`?sel=`), con selección optimista, ↑/↓, Esc
 * y Enter en el nombre. Mismas columnas, filtros, permisos y textos que la lista legacy.
 */
export default function ContactosList({
  contactos,
  total,
  page,
  pageSize,
  q,
  hayFiltro,
  cuentasOk,
  visiblesSinFiltro,
  dadosDeBaja,
  individuales,
  empresas,
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
  contactos: ContactoFila[];
  /** Coincidencias con los filtros, en todas las páginas. */
  total: number;
  page: number;
  pageSize: number;
  /** La búsqueda ya limpia, para repetirla en el "no hay resultados". */
  q: string;
  hayFiltro: boolean;
  /** Falso si algún conteo falló: no se sabe si hay contactos, así que no se muestra el vacío de "primera vez". */
  cuentasOk: boolean;
  /** Contactos que se verían sin ningún filtro (respetando "Ver bajas"). */
  visiblesSinFiltro: number;
  dadosDeBaja: number;
  individuales: number;
  /** Para el formulario (a qué empresa pertenece); no sale de la página. */
  empresas: EmpresaOpcion[];
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  /** Permisos del rol. Solo UX: la base exige cada uno igual. */
  puedeEditar: boolean;
  puedeAsignar: boolean;
  /** `clientes.ver_todos`: sin él, la base ya devuelve solo la cartera propia. */
  puedeVerTodos: boolean;
  yoId: string;
  /** El contacto elegido para la vista previa (`?sel=`), ya validado como uuid. */
  sel: string | null;
  /** La vista previa (`<Suspense key={sel}><VistaPrevia/></Suspense>`), o nada. */
  panel?: React.ReactNode;
}) {
  const router = useRouter();
  const filtros = useFiltrosUrl();
  const tabla = React.useRef<HTMLDivElement>(null);
  const buscador = React.useRef<HTMLDivElement>(null);
  const foco = useFocoFilas(contactos, { tabla, buscador });
  const ids = contactos.map((c) => c.id);
  const seleccion = useSeleccionUrl({ sel, ids, filtros, ficha: (id) => `/contactos/${id}`, enfocarFila: foco.enfocarFila });
  const acciones = useAccionesContacto({ empresas, perfiles, origenes, puedeAsignar, yoId }, () => {
    foco.trasCambio();
    filtros.refrescar();
  });
  const verBajas = filtros.valor("bajas") === "1";

  const perfilPorId = React.useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles]);

  const base = Math.max(visiblesSinFiltro, total);
  const vacioReal = cuentasOk && !hayFiltro && visiblesSinFiltro + (verBajas ? 0 : dadosDeBaja) === 0;
  const n = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`;
  const contador = !cuentasOk
    ? n(total, "contacto", "contactos")
    : hayFiltro
      ? `${total} de ${n(base, "contacto", "contactos")}`
      : `${n(visiblesSinFiltro, "contacto", "contactos")} · ${n(individuales, "individual", "individuales")}`;

  /** Menú de una fila. Si dar de baja o reactivar la saca de la lista, el foco va a la siguiente (`useFocoFilas`). */
  function menuDe(c: Contacto): MenuItem[] {
    const items = itemsFila(c, puedeEditar, acciones, () => router.push(`/contactos/${c.id}`));
    return foco.conFoco(items, c.id);
  }

  function nuevo() {
    foco.olvidar();
    acciones.nuevo();
  }

  const estadoValor = filtros.valor("estado");
  const vinculoValor = filtros.valor("vinculo");
  const responsableValor = filtros.valor("responsable");
  const origenValor = filtros.valor("origen");
  const opcionesResponsable = [{ value: "", label: "Todos los responsables" }, ...perfiles.map((p) => ({ value: p.id, label: p.nombre }))];
  const opcionesOrigen = [{ value: "", label: "Todos los orígenes" }, ...origenes.map((o) => ({ value: o.id, label: o.nombre }))];
  /** Un valor de la URL que no es una opción se ve como "todos" (igual que en el servidor). */
  const valido = (opciones: readonly { value: string }[], v: string) => (opciones.some((o) => o.value === v) ? v : "");
  // Los que "Más filtros" junta y cuenta (con ancho, cada uno es su chip).
  const secundariosActivos = [
    valido(VINCULOS, vinculoValor),
    puedeVerTodos ? valido(opcionesResponsable, responsableValor) : "",
    valido(opcionesOrigen, origenValor),
    verBajas ? "1" : "",
  ].filter(Boolean).length;

  const nuevoContacto = puedeEditar && (
    <Button variant="primary" icon={Plus} onClick={nuevo} aria-label="Nuevo contacto" className="max-sm:w-8 max-sm:px-0">
      <span className="max-sm:sr-only">Nuevo contacto</span>
    </Button>
  );

  return (
    // Una fila: la lista ocupa el resto y, con un contacto elegido (desde 1280), la vista previa a la derecha.
    <div className={cn(UI_ROOT, "flex h-full min-h-0 bg-(--crm-canvas)")}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 xl:px-6">
        <PageBar title="Contactos" count={contador} actions={nuevoContacto} />

        {!vacioReal && (
          <Toolbar>
            <div ref={buscador} className="contents">
              <SearchField filtros={filtros} label="Buscar contacto" placeholder="Buscar contacto…" className={ANCHO_FILTROS.buscador} />
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
                label="Filtrar por empresa o individual"
                chip={{ label: "Vínculo", value: VINCULOS.find((v) => v.value && v.value === vinculoValor)?.label }}
                items={VINCULOS.map((v) => ({
                  label: v.label,
                  checked: v.value === vinculoValor,
                  onSelect: () => filtros.aplicar({ vinculo: v.value || null }),
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
                Ver bajas
                <span className="text-[12px] tabular-nums text-(--crm-text-2)">{dadosDeBaja}</span>
              </ToggleChip>
            </div>
            <div className={ANCHO_FILTROS.mas}>
              <MasFiltros activos={secundariosActivos}>
                <FiltroOpciones
                  label="Vínculo"
                  value={valido(VINCULOS, vinculoValor)}
                  options={VINCULOS}
                  onChange={(v) => filtros.aplicar({ vinculo: v || null })}
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
                  label={`Ver bajas (${dadosDeBaja})`}
                  checked={verBajas}
                  onChange={(v) => filtros.aplicar({ bajas: v ? "1" : null })}
                />
              </MasFiltros>
            </div>
            {hayFiltro && (
              <Button variant="ghost" size="sm" onClick={() => filtros.limpiar(LIMPIAR_CONSERVA)}>
                Limpiar filtros
              </Button>
            )}
          </Toolbar>
        )}

        <AnuncioResultados total={total} />

        {vacioReal ? (
          <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
            <EmptyState
              title={puedeVerTodos ? "Todavía no hay contactos" : "Tu cartera de contactos está vacía"}
              description={
                puedeVerTodos
                  ? "Cargá a quien te atiende en cada club, o a un cliente que compra por su cuenta. Con nombre, mail y teléfono alcanza."
                  : "Acá ves los contactos que cargás o que te asignan, y los de tus empresas. Cargá el primero."
              }
              action={
                puedeEditar ? (
                  <Button variant="primary" icon={Plus} onClick={nuevo}>
                    Nuevo contacto
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* onKeyDown en el contenedor: las flechas llegan burbujeando desde los links de cada fila. */}
            <div ref={tabla} onKeyDown={seleccion.alTeclado} className="flex min-h-0 flex-col pb-3">
              <DataTable label="Contactos" busy={filtros.pending} className="min-h-0">
                <THead>
                  <Th>Contacto</Th>
                  <Th width={184} hideBelow="sm">
                    Empresa
                  </Th>
                  <Th width={120} hideBelow="sm">
                    Estado
                  </Th>
                  <Th width={160} hideBelow="lg">
                    Responsable
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
                            ? `Ningún contacto con «${q}»`
                            : visiblesSinFiltro === 0 && !hayFiltro
                              ? "No hay contactos activos"
                              : "Ningún contacto con esos filtros"
                        }
                        description={
                          visiblesSinFiltro === 0 && !hayFiltro
                            ? `Los ${dadosDeBaja} que tenés están dados de baja. Activá «Ver bajas» para verlos o reactivarlos.`
                            : "Probá con el mail, el teléfono, el documento o el nombre de la empresa, o aflojá los filtros."
                        }
                        action={
                          hayFiltro ? (
                            <Button size="sm" onClick={() => filtros.limpiar(LIMPIAR_CONSERVA)}>
                              Limpiar filtros
                            </Button>
                          ) : undefined
                        }
                      />
                    </TableMessage>
                  ) : (
                    contactos.map((c) => (
                      <Fila
                        key={c.id}
                        contacto={c}
                        seleccionada={c.id === seleccion.selVista}
                        conPanel={Boolean(panel)}
                        responsable={(c.responsable_id && perfilPorId.get(c.responsable_id)) || null}
                        hrefPreview={seleccion.hrefSel(c.id)}
                        menu={menuDe(c)}
                        onClickFila={(ev) => seleccion.alClickFila(ev, c.id)}
                        onPreview={() => seleccion.elegir(c.id)}
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

/** Empresa del contacto: link a su ficha, "Individual" (cliente sin empresa) o "Empresa de otra cartera" (la RLS no la muestra). */
function Vinculo({ c, link = true }: { c: ContactoFila; link?: boolean }) {
  if (!c.empresa_id) return <Tag>Individual</Tag>;
  if (!c.empresa) return <span className="text-(--crm-text-2)">Empresa de otra cartera</span>;
  if (!link) return <>{c.empresa.nombre}</>;
  return (
    <Tooltip content={c.empresa.nombre} onlyWhenTruncated>
      <Link href={`/empresas/${c.empresa_id}`} className={cn("block min-w-0 truncate rounded-[2px] hover:underline", FOCUS)}>
        {c.empresa.nombre}
      </Link>
    </Tooltip>
  );
}

/**
 * Una fila. Las columnas que el contenedor esconde no se pierden: pasan a una línea de apoyo (12, secundaria) debajo
 * del nombre (MASTER.md §10.14):
 * - < 30rem (celular): estado · empresa (o Individual) · cargo · responsable (como la tarjeta legacy de celular).
 * - 30–60rem: cargo · mail · teléfono · responsable (Empresa y Estado en columnas). Con la vista previa abierta (1280 y
 *   1440) sin el mail: cargo · teléfono · responsable (el mail está en el panel de al lado y en la ficha).
 * - ≥ 60rem: una sola línea; cargo, mail y teléfono en gris junto al nombre, responsable en su columna.
 */
function Fila({
  contacto: c,
  seleccionada,
  conPanel,
  responsable,
  hrefPreview,
  menu,
  onClickFila,
  onPreview,
}: {
  contacto: ContactoFila;
  seleccionada: boolean;
  /** Hay vista previa (`?sel=`): desde 1280 la línea de apoyo deja el mail al panel. */
  conPanel: boolean;
  responsable: string | null;
  hrefPreview: string;
  menu: MenuItem[];
  onClickFila: (ev: React.MouseEvent) => void;
  onPreview: () => void;
}) {
  const nombre = nombreCompleto(c);
  const datos = [c.cargo, c.email, c.telefono].filter(Boolean);
  return (
    <Tr data-id={c.id} selected={seleccionada} onClick={onClickFila} className={FILA_SELECCIONABLE}>
      <Td className="py-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <Tooltip content={nombre} onlyWhenTruncated>
            <Link href={`/contactos/${c.id}`} data-nombre className={cn("block min-w-0 truncate rounded-[2px] font-medium text-(--crm-text) hover:underline", FOCUS)}>
              {nombre}
            </Link>
          </Tooltip>
          <span className="hidden min-w-0 shrink-[2] truncate text-(--crm-text-2) @[60rem]:block [&>span]:mr-3">
            {datos.length ? (
              <>
                {c.cargo && <span>{c.cargo}</span>}
                {c.email && <span>{c.email}</span>}
                {c.telefono && <span>{c.telefono}</span>}
              </>
            ) : (
              "Sin datos de contacto"
            )}
          </span>
        </div>
        {/* Una sola línea que recorta con "…" al final: lo primero (estado, empresa) siempre se ve. */}
        <div className={cn(TYPE.meta, "truncate text-(--crm-text-2) @[60rem]:hidden [&>span]:mr-3")}>
          <span className="@[30rem]:hidden">
            <EstadoCliente estado={c.estado} className="align-[-1px]" />
          </span>
          <span className="@[30rem]:hidden">
            <Vinculo c={c} link={false} />
          </span>
          {c.cargo && <span>{c.cargo}</span>}
          {c.email && <span className={conPanel ? "hidden @[30rem]:max-xl:inline" : "hidden @[30rem]:inline"}>{c.email}</span>}
          {c.telefono && <span className="hidden @[30rem]:inline">{c.telefono}</span>}
          {!datos.length && <span className="hidden @[30rem]:inline">Sin datos de contacto</span>}
          <span>{responsable ?? "Sin asignar"}</span>
        </div>
      </Td>
      <Td hideBelow="sm">
        <Vinculo c={c} />
      </Td>
      <Td hideBelow="sm">
        <EstadoCliente estado={c.estado} />
      </Td>
      <Td hideBelow="lg">{responsable ? <CellPerson name={responsable} /> : <span className="text-(--crm-text-2)">Sin asignar</span>}</Td>
      <Td className="overflow-visible px-1">
        <CellActions menu={<Menu label={`Acciones de ${nombre}`} size="sm" items={menu} />}>
          <LinkVistaPrevia href={hrefPreview} nombre={nombre} onPreview={onPreview} />
        </CellActions>
      </Td>
    </Tr>
  );
}
