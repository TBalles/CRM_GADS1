"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, NotebookPen, Pencil, Plus, Power } from "lucide-react";
import { Button, IconButton } from "@/components/crm/Button";
import { DataTable, TBody, THead, Td, Th, Tr, CellActions, CellDate, CellNumber, CellText } from "@/components/crm/DataTable";
import { EmptyState, InlineBanner } from "@/components/crm/Feedback";
import { Menu } from "@/components/crm/Menu";
import { DetailHeader, SectionBar } from "@/components/crm/PageBar";
import { DefinitionList } from "@/components/crm/Panel";
import { StatStrip } from "@/components/crm/StatStrip";
import { Avatar } from "@/components/crm/Status";
import { Tabs, TabPanel, type TabItem } from "@/components/crm/Tabs";
import { Tooltip } from "@/components/crm/Tooltip";
import { FOCUS, TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { useApertura } from "@/components/crm/cuenta/FormDrawer";
import { ActividadDrawer } from "@/components/crm/cuenta/ActividadDrawer";
import { ContactoDrawer } from "@/components/crm/cuenta/ContactoDrawer";
import { AvisoEstadoCrm, EstadoCliente, EstadoOportunidad } from "@/components/crm/cuenta/estados";
import { HistoriaCuenta, MovimientosRecientes, ResumenIACrm } from "@/components/crm/cuenta/HistoriaCuenta";
import { statsCuenta } from "@/components/crm/cuenta/resumen";
import { estaDeBaja, estadoInfo, etiquetaTipoCliente, formatFecha, nombreCompleto, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import type { GrupoParque } from "@/lib/parque";
import { TOPES, type AvisoCuenta, type CambioEtapaFila, type Cuenta360, type EtapaCuenta, type OportunidadCuenta, type VentaCuenta } from "@/lib/cuenta360";
import { formatMoney } from "@/lib/money";
import { resumenCuenta } from "@/lib/timeline360";
import type { Tables } from "@/lib/supabase/types";
import { itemsEdicion, useAccionesEmpresa } from "../acciones";
import { datosEmpresa } from "../datos";
import CanchasSeccion from "./CanchasSeccion";
import { ParqueInstalado } from "./ParqueInstalado";

type Empresa = Tables<"empresas">;
type Contacto = Tables<"contactos">;
type Actividad = Tables<"bitacora_entradas">;
type Tipo = Pick<Tables<"tipos_actividad">, "id" | "nombre" | "codigo" | "activo" | "orden">;
type Cancha = Tables<"canchas">;

export type TabFicha = "resumen" | "actividad" | "oportunidades" | "ventas" | "contactos" | "canchas";

const ETIQUETA_TAB: Record<TabFicha, string> = {
  resumen: "Resumen",
  actividad: "Actividad",
  oportunidades: "Oportunidades",
  ventas: "Ventas",
  contactos: "Contactos",
  canchas: "Canchas y parque",
};

/** Monto en pesos: símbolo en gris, cifra mono; sin monto, "—". */
function Monto({ valor }: { valor: number }) {
  if (!valor) return <span className="text-(--crm-text-2)">—</span>;
  return (
    <CellNumber unit="$" unitPosition="before">
      {formatMoney(valor).replace(/^\$/, "")}
    </CellNumber>
  );
}

const LINK = cn("rounded-[2px] text-(--crm-accent-text) underline-offset-2 hover:underline", FOCUS);

/**
 * Ficha de empresa (CRM 2.0): franja de identidad (h1 = nombre exacto, estado, tipo, responsable, CUIT) con UNA acción
 * primaria y "Más acciones"; debajo, tabs por URL (`?tab=`): Resumen · Actividad · Oportunidades · Ventas · Contactos ·
 * Canchas y parque (cada una con las condiciones de permisos y de datos de siempre). Los datos llegan del servidor; cada
 * mutación hace `router.refresh()` (la URL y el servidor son la fuente de verdad: no hay copias locales que se desfasen).
 */
export default function EmpresaDetalle({
  empresa,
  contactos,
  oportunidades,
  etapas,
  ventas,
  actividades,
  cambios,
  avisos,
  truncado,
  primeraCompra,
  parqueTruncado,
  hoy,
  tipos,
  perfiles,
  origenes,
  parque,
  canchas,
  mostrarAvisoMigracion,
  puedeCrearOportunidad,
  yoId,
  puedeEditar,
  puedeAsignar,
  puedeVerOportunidades,
  puedeVerVentas,
  puedeVerActividades,
  puedeVerAvisos,
  puedeEscribirActividad,
  iaDisponible,
  tabs,
  tab,
}: {
  empresa: Empresa;
  contactos: Contacto[];
  oportunidades: OportunidadCuenta[];
  etapas: EtapaCuenta[];
  ventas: VentaCuenta[];
  actividades: Actividad[];
  cambios: CambioEtapaFila[];
  avisos: AvisoCuenta[];
  truncado: Cuenta360["truncado"];
  /** Fecha de la primera compra de toda la cuenta (aunque las ventas que se muestran estén recortadas). */
  primeraCompra: string | null;
  /** El parque instalado se leyó con tope y la empresa tiene más equipos de los que se ven. */
  parqueTruncado: boolean;
  /** Hoy en horario argentino (`aaaa-mm-dd`), calculado en el servidor para que no se desfase al hidratar. */
  hoy: string;
  tipos: Tipo[];
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  /** Equipamiento entregado, agrupado por urgencia. `null` si el rol no puede ver ventas. */
  parque: GrupoParque[] | null;
  /** Canchas de la empresa. `null` si la base todavía no tiene la tabla (migración 0011). */
  canchas: Cancha[] | null;
  mostrarAvisoMigracion: boolean;
  puedeCrearOportunidad: boolean;
  yoId: string;
  /** Permisos del rol. Solo UX: la base exige cada uno igual. */
  puedeEditar: boolean;
  puedeAsignar: boolean;
  puedeVerOportunidades: boolean;
  puedeVerVentas: boolean;
  puedeVerActividades: boolean;
  puedeVerAvisos: boolean;
  puedeEscribirActividad: boolean;
  iaDisponible: boolean;
  /** Las tabs que existen para este rol y esta empresa (las arma el servidor). */
  tabs: TabFicha[];
  /** La tab activa, ya validada (`?tab=`; inválida → Resumen). */
  tab: TabFicha;
}) {
  const router = useRouter();
  // Cambiar de tab navega (la URL es el estado): en una transición, con el panel marcado `busy` hasta que llega.
  const [cambiandoTab, startTab] = useTransition();
  const nombreEtapa = useMemo(() => new Map(etapas.map((e) => [e.id, e.nombre])), [etapas]);
  const abiertas = oportunidades.filter((o) => o.estado === "abierta");
  // Señal de recambio: lo mismo que dice el encabezado del Parque instalado (mismo dato y mismo permiso: ventas.ver).
  const vencidas = parque?.find((g) => g.estado === "vencido")?.unidades ?? 0;
  const porVencer = parque?.find((g) => g.estado === "por_vencer")?.unidades ?? 0;
  const recambio =
    vencidas || porVencer
      ? [vencidas ? `${vencidas} ${vencidas === 1 ? "unidad" : "unidades"} para recambiar ya` : "", porVencer ? `${porVencer} por vencer` : ""]
          .filter(Boolean)
          .join(" · ")
      : null;
  const refrescar = () => router.refresh();
  const acciones = useAccionesEmpresa({ perfiles, origenes, puedeAsignar, yoId }, refrescar);
  const actividad = useApertura<true>();
  const contactoEd = useApertura<Contacto | null>();

  const puedeRegistrar = puedeEscribirActividad && puedeVerActividades;
  const perfilPorId = useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles]);
  const responsable = (empresa.responsable_id && perfilPorId.get(empresa.responsable_id)) || null;
  const origen = origenes.find((o) => o.id === empresa.origen_id)?.nombre ?? null;
  const tipoCliente = etiquetaTipoCliente(empresa.tipo_cliente);

  const contactosOpciones = contactos.filter((c) => !estaDeBaja(c.estado)).map((c) => ({ id: c.id, label: nombreCompleto(c) }));
  const contactosNombres = useMemo(() => contactos.map((c) => ({ id: c.id, label: nombreCompleto(c) })), [contactos]);
  const oportunidadesOpciones = oportunidades.filter((o) => o.estado === "abierta").map((o) => ({ id: o.id, label: o.titulo }));
  const ver = useMemo(
    () => ({ actividades: puedeVerActividades, etapas: puedeVerOportunidades, ventas: puedeVerVentas, avisos: puedeVerAvisos && puedeVerVentas }),
    [puedeVerActividades, puedeVerOportunidades, puedeVerVentas, puedeVerAvisos],
  );
  const fuentes = { actividades, cambios, oportunidades, ventas, avisos, etapas, tipos, perfiles, contactos: contactosNombres, ver };

  const resumen = useMemo(
    () => resumenCuenta({ ventas, oportunidades, actividades: puedeVerActividades ? actividades : null, hoy, primeraCompra }),
    [ventas, oportunidades, actividades, puedeVerActividades, hoy, primeraCompra],
  );
  const stats = statsCuenta(resumen, { ventas: puedeVerVentas, oportunidades: puedeVerOportunidades, contacto: puedeVerActividades }, truncado);

  // Con tope (`truncado`) el contador lleva "+": hay más de las que se leyeron.
  const contar: Partial<Record<TabFicha, number | string>> = {
    oportunidades: truncado.oportunidades ? `${oportunidades.length}+` : oportunidades.length,
    ventas: truncado.ventas ? `${ventas.length}+` : ventas.length,
    contactos: contactos.length,
    ...(canchas ? { canchas: canchas.filter((c) => c.activa).length } : {}),
  };
  const items: TabItem[] = tabs.map((t) => ({
    value: t,
    label: ETIQUETA_TAB[t],
    count: contar[t],
    href: t === "resumen" ? `/empresas/${empresa.id}` : `/empresas/${empresa.id}?tab=${t}`,
  }));

  const registrar = puedeRegistrar ? (
    <Button variant="primary" icon={NotebookPen} onClick={() => actividad.abrir(true)}>
      Registrar actividad
    </Button>
  ) : null;
  const masAcciones = itemsEdicion(empresa, puedeEditar, acciones);
  // Sin permiso para registrar, "Editar" pasa a ser la acción visible (y el `⋮` queda con el resto).
  const primaria = registrar ?? (puedeEditar ? (
    <Button variant="primary" icon={Pencil} onClick={() => acciones.editar(empresa)}>
      Editar
    </Button>
  ) : null);
  const overflow = registrar ? masAcciones : masAcciones.slice(1);

  const agregarContacto = puedeEditar ? (
    <Button size="sm" icon={Plus} onClick={() => contactoEd.abrir(null)}>
      Agregar
    </Button>
  ) : undefined;

  return (
    <div className={cn(UI_ROOT, "flex min-h-full flex-col bg-(--crm-canvas)")}>
      <DetailHeader
        title={empresa.nombre}
        meta={
          <>
            <EstadoCliente estado={empresa.estado} className="text-(--crm-text)" />
            {tipoCliente && <span>{tipoCliente}</span>}
            <span className="inline-flex items-center gap-1.5">
              {responsable && <Avatar name={responsable} size="xs" />}
              <span>
                <span className="sr-only">Responsable: </span>
                {responsable ?? "Sin asignar"}
              </span>
            </span>
            {empresa.cuit && (
              <span>
                CUIT <span className={cn(TYPE.mono, "text-(--crm-text)")}>{empresa.cuit}</span>
              </span>
            )}
          </>
        }
        actions={
          (primaria || overflow.length > 0) && (
            <>
              {primaria}
              {overflow.length > 0 && <Menu label="Más acciones" items={overflow} />}
            </>
          )
        }
        tabs={
          <Tabs
            id="ficha-empresa"
            label="Secciones de la ficha"
            items={items}
            value={tab}
            navigate={(href) => startTab(() => router.push(href, { scroll: false }))}
          />
        }
      />

      <TabPanel tabsId="ficha-empresa" value={tab} busy={cambiandoTab} className="flex flex-1 flex-col gap-4 px-4 py-4 xl:px-6">
        <AvisoEstadoCrm
          estado={empresa.estado}
          entidad="empresa"
          accion={
            empresa.estado === "inactivo" && puedeEditar ? (
              <Button size="sm" icon={Power} onClick={() => void acciones.reactivar(empresa)}>
                Reactivar
              </Button>
            ) : undefined
          }
        />

        {tab === "resumen" && (
          // Superficie de trabajo, no una card: columna principal (lo que se opera) + riel de propiedades (Datos).
          <div className="grid min-w-0 items-start gap-x-6 gap-y-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-5">
              {stats.length > 0 && (
                <section aria-labelledby="resumen-cuenta">
                  <h2 id="resumen-cuenta" className="sr-only">
                    Resumen de la cuenta
                  </h2>
                  <p id="resumen-cuenta-nota" className="sr-only">
                    Calculado con lo que está cargado en el CRM, sin estimaciones.
                  </p>
                  <StatStrip items={stats} describedBy="resumen-cuenta-nota" />
                </section>
              )}

              {recambio && (
                <p className={cn(TYPE.table, "-mt-1 flex flex-wrap items-center gap-x-3 gap-y-1")}>
                  <span className="inline-flex items-center gap-1.5 font-medium text-(--crm-warning)">
                    <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="size-4" />
                    {recambio}
                  </span>
                  <Link href={`/empresas/${empresa.id}?tab=canchas`} className={LINK}>
                    Ver parque
                  </Link>
                </p>
              )}

              {puedeVerOportunidades && (
                <section className="flex min-w-0 flex-col">
                  <SectionBar
                    title="Oportunidades abiertas"
                    count={abiertas.length}
                    actions={
                      oportunidades.length > 0 && (
                        <Link href={`/empresas/${empresa.id}?tab=oportunidades`} className={cn(TYPE.table, LINK)}>
                          Ver todas
                        </Link>
                      )
                    }
                  />
                  {abiertas.length ? (
                    <DataTable label="Oportunidades abiertas">
                      <THead>
                        <Th>Oportunidad</Th>
                        <Th width={200} hideBelow="sm">
                          Etapa
                        </Th>
                        <Th width={136} align="right">
                          Monto
                        </Th>
                      </THead>
                      <TBody>
                        {abiertas.map((o) => (
                          <Tr key={o.id}>
                            <Td>
                              <CellText href={`/oportunidades/${o.id}`}>{o.titulo}</CellText>
                            </Td>
                            <Td hideBelow="sm">{nombreEtapa.get(o.etapa_id) ?? <span className="text-(--crm-text-2)">Sin etapa</span>}</Td>
                            <Td align="right">
                              <Monto valor={o.monto ? Number(o.monto) : 0} />
                            </Td>
                          </Tr>
                        ))}
                      </TBody>
                    </DataTable>
                  ) : (
                    <p className={cn(TYPE.table, "text-(--crm-text-2)")}>Ninguna abierta.</p>
                  )}
                </section>
              )}

              <section className="flex min-w-0 flex-col">
                <SectionBar title="Contactos" count={contactos.length} actions={agregarContacto} />
                {contactos.length ? (
                  <DataTable label="Contactos">
                    <THead>
                      <Th>Nombre</Th>
                      <Th width={128}>Teléfono</Th>
                      <Th width={248} hideBelow="md">
                        Email
                      </Th>
                    </THead>
                    <TBody>
                      {contactos.slice(0, 6).map((c) => (
                        <Tr key={c.id}>
                          <Td>
                            <CellText
                              href={`/contactos/${c.id}`}
                              secondary={[c.cargo, estaDeBaja(c.estado) ? estadoInfo(c.estado).label : null].filter(Boolean).join(" · ") || undefined}
                            >
                              {nombreCompleto(c)}
                            </CellText>
                          </Td>
                          <Td>{c.telefono ? <span className={TYPE.mono}>{c.telefono}</span> : <span className="text-(--crm-text-2)">—</span>}</Td>
                          <Td hideBelow="md">
                            {c.email ? (
                              <a href={`mailto:${c.email}`} className={cn(LINK, "block truncate")}>
                                {c.email}
                              </a>
                            ) : (
                              <span className="text-(--crm-text-2)">—</span>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </DataTable>
                ) : (
                  <p className={cn(TYPE.table, "text-(--crm-text-2)")}>
                    Todavía no hay a quién escribirle. Sumá quién compra en este cliente: nombre, mail y teléfono.
                  </p>
                )}
                {contactos.length > 6 && (
                  <Link href={`/empresas/${empresa.id}?tab=contactos`} className={cn(TYPE.table, LINK, "mt-2 self-start")}>
                    Ver los {contactos.length} contactos
                  </Link>
                )}
              </section>

              {tabs.includes("actividad") && (
                <section className="flex min-w-0 flex-col">
                  <SectionBar
                    title="Actividad reciente"
                    actions={
                      <Link href={`/empresas/${empresa.id}?tab=actividad`} className={cn(TYPE.table, LINK)}>
                        Ver toda la actividad
                      </Link>
                    }
                  />
                  <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) px-3">
                    <MovimientosRecientes limite={5} {...fuentes} />
                  </div>
                </section>
              )}
            </div>

            {/* Riel de propiedades: una columna, término a la izquierda, hairlines entre filas. */}
            <aside aria-label="Datos de la empresa" className="flex min-w-0 flex-col border-(--crm-border) xl:border-l xl:pl-6">
              <SectionBar title="Datos" />
              <DefinitionList inline columns={1} items={datosEmpresa(empresa, { responsable, origen })} />
              {empresa.notas && (
                <div className="mt-3 flex flex-col gap-1">
                  <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>Observaciones</p>
                  <p className="max-w-prose whitespace-pre-line text-[13px] leading-[1.55]">{empresa.notas}</p>
                </div>
              )}
            </aside>
          </div>
        )}

        {tab === "actividad" && (
          <HistoriaCuenta
            {...fuentes}
            truncado={truncado}
            ia={iaDisponible ? <ResumenIACrm tipo="empresa" id={empresa.id} /> : undefined}
            accion={
              puedeRegistrar ? (
                <Button size="sm" icon={Plus} onClick={() => actividad.abrir(true)}>
                  Registrar
                </Button>
              ) : undefined
            }
          />
        )}

        {tab === "oportunidades" && (
          <section className="flex min-w-0 flex-col">
            <SectionBar title="Oportunidades" count={truncado.oportunidades ? `${oportunidades.length}+` : oportunidades.length} />
            <DataTable label="Oportunidades de la empresa">
              <THead>
                <Th>Oportunidad</Th>
                <Th width={200} hideBelow="sm">
                  Etapa
                </Th>
                <Th width={112}>Estado</Th>
                <Th width={136} align="right">
                  Monto
                </Th>
              </THead>
              <TBody>
                {oportunidades.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <EmptyState
                        compact
                        title="Todavía no hay oportunidades."
                        description={
                          <>
                            Se cargan desde{" "}
                            <Link href="/oportunidades" className={LINK}>
                              Oportunidades
                            </Link>
                            .
                          </>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  oportunidades.map((o) => (
                    <Tr key={o.id}>
                      <Td>
                        <CellText href={`/oportunidades/${o.id}`}>{o.titulo}</CellText>
                      </Td>
                      <Td hideBelow="sm">{etapas.find((e) => e.id === o.etapa_id)?.nombre ?? <span className="text-(--crm-text-2)">Sin etapa</span>}</Td>
                      <Td>
                        <EstadoOportunidad estado={o.estado} />
                      </Td>
                      <Td align="right">
                        {o.monto ? (
                          <CellNumber unit="$" unitPosition="before">
                            {formatMoney(Number(o.monto)).replace(/^\$/, "")}
                          </CellNumber>
                        ) : (
                          <span className="text-(--crm-text-2)">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </DataTable>
            {truncado.oportunidades && <p className={cn(TYPE.meta, "mt-2 text-(--crm-text-2)")}>Se muestran las {TOPES.oportunidades} más recientes.</p>}
          </section>
        )}

        {tab === "ventas" && (
          <section className="flex min-w-0 flex-col">
            <SectionBar title="Ventas" count={truncado.ventas ? `${ventas.length}+` : ventas.length} />
            <DataTable label="Ventas de la empresa">
              <THead>
                <Th width={120}>Fecha</Th>
                <Th>Comprobante</Th>
                <Th width={160} align="right">
                  Total
                </Th>
              </THead>
              <TBody>
                {ventas.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-0">
                      <EmptyState
                        compact
                        title="Todavía no compró."
                        description={
                          <>
                            Las entregas se cargan desde{" "}
                            <Link href="/ventas" className={LINK}>
                              Ventas
                            </Link>
                            .
                          </>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  ventas.map((v) => (
                    <Tr key={v.id}>
                      <Td>
                        <CellDate dateTime={v.fecha}>{formatFecha(v.fecha)}</CellDate>
                      </Td>
                      <Td>{v.comprobante ? <span className={TYPE.mono}>{v.comprobante}</span> : <span className="text-(--crm-text-2)">—</span>}</Td>
                      <Td align="right">
                        {v.total ? (
                          <CellNumber unit="$" unitPosition="before">
                            {formatMoney(v.total).replace(/^\$/, "")}
                          </CellNumber>
                        ) : (
                          <span className="text-(--crm-text-2)">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </DataTable>
            {truncado.ventas && <p className={cn(TYPE.meta, "mt-2 text-(--crm-text-2)")}>Se muestran las {TOPES.ventas} más recientes.</p>}
          </section>
        )}

        {tab === "contactos" && (
          <section className="flex min-w-0 flex-col">
            <SectionBar title="Contactos" count={contactos.length} actions={agregarContacto} />
            <DataTable label="Contactos de la empresa">
              <THead>
                <Th>Nombre</Th>
                <Th width={200} hideBelow="md">
                  Cargo
                </Th>
                <Th width={240} hideBelow="lg">
                  Email
                </Th>
                <Th width={144} hideBelow="sm">
                  Teléfono
                </Th>
                <Th width={120}>Estado</Th>
                {puedeEditar && (
                  <Th width={48}>
                    <span className="sr-only">Acciones</span>
                  </Th>
                )}
              </THead>
              <TBody>
                {contactos.length === 0 ? (
                  <tr>
                    <td colSpan={puedeEditar ? 6 : 5} className="p-0">
                      <EmptyState
                        compact
                        title="Todavía no hay a quién escribirle."
                        description="Sumá quién compra en este cliente: nombre, mail y teléfono."
                      />
                    </td>
                  </tr>
                ) : (
                  contactos.map((c) => (
                    <Tr key={c.id}>
                      <Td>
                        <CellText href={`/contactos/${c.id}`}>{nombreCompleto(c)}</CellText>
                      </Td>
                      <Td hideBelow="md">{c.cargo ?? <span className="text-(--crm-text-2)">—</span>}</Td>
                      <Td hideBelow="lg">
                        {c.email ? (
                          <a href={`mailto:${c.email}`} className={cn(LINK, "block truncate")}>
                            {c.email}
                          </a>
                        ) : (
                          <span className="text-(--crm-text-2)">—</span>
                        )}
                      </Td>
                      <Td hideBelow="sm">{c.telefono ? <span className={TYPE.mono}>{c.telefono}</span> : <span className="text-(--crm-text-2)">—</span>}</Td>
                      <Td>
                        <EstadoCliente estado={c.estado} />
                      </Td>
                      {puedeEditar && (
                        <Td className="px-1">
                          <CellActions>
                            <Tooltip content="Editar">
                              <IconButton size="sm" icon={Pencil} label={`Editar ${nombreCompleto(c)}`} onClick={() => contactoEd.abrir(c)} />
                            </Tooltip>
                          </CellActions>
                        </Td>
                      )}
                    </Tr>
                  ))
                )}
              </TBody>
            </DataTable>
          </section>
        )}

        {tab === "canchas" && (
          <div className="flex flex-col gap-4">
            {mostrarAvisoMigracion && (
              <InlineBanner tone="info" title="Se activa al aplicar la migración 0011.">
                Hasta entonces la ficha de canchas y el equipamiento sugerido no aparece. Los pasos están en la guía de despliegue.
              </InlineBanner>
            )}
            <div className="grid min-w-0 items-start gap-6 2xl:grid-cols-2">
              {canchas && (
                <CanchasSeccion
                  empresa={{ id: empresa.id, nombre: empresa.nombre }}
                  canchas={canchas}
                  parque={parque}
                  etapas={etapas}
                  origenes={origenes}
                  yoId={yoId}
                  puedeEditar={puedeEditar}
                  puedeCrearOportunidad={puedeCrearOportunidad && puedeVerOportunidades}
                />
              )}
              {parque && <ParqueInstalado grupos={parque} truncado={parqueTruncado} />}
            </div>
          </div>
        )}
      </TabPanel>

      {acciones.overlays}
      {puedeRegistrar && (
        <ActividadDrawer
          key={`a-${actividad.n}`}
          open={actividad.abierto}
          onClose={actividad.cerrar}
          empresaId={empresa.id}
          tipos={tipos}
          contactos={contactosOpciones}
          oportunidades={oportunidadesOpciones}
          avisoNoContactar={empresa.estado === "no_contactar"}
          description={empresa.nombre}
          onSaved={() => {
            actividad.cerrar();
            refrescar();
          }}
        />
      )}
      <ContactoDrawer
        key={`c-${contactoEd.n}`}
        open={contactoEd.abierto}
        onClose={contactoEd.cerrar}
        contacto={contactoEd.valor ?? undefined}
        empresaId={empresa.id}
        empresas={[{ id: empresa.id, nombre: empresa.nombre, estado: empresa.estado }]}
        perfiles={perfiles}
        origenes={origenes}
        puedeAsignar={puedeAsignar}
        yoId={yoId}
        description={empresa.nombre}
        onSaved={() => {
          contactoEd.cerrar();
          refrescar();
        }}
      />
    </div>
  );
}
