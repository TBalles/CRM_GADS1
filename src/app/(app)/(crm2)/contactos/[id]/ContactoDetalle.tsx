"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NotebookPen, Pencil, Plus, Power } from "lucide-react";
import { Button } from "@/components/crm/Button";
import { Menu } from "@/components/crm/Menu";
import { DetailHeader } from "@/components/crm/PageBar";
import { Avatar, Tag } from "@/components/crm/Status";
import { Tabs, TabPanel, type TabItem } from "@/components/crm/Tabs";
import { FOCUS, UI_ROOT, cn } from "@/components/crm/cx";
import { useApertura } from "@/components/crm/cuenta/FormDrawer";
import { ActividadDrawer } from "@/components/crm/cuenta/ActividadDrawer";
import { AvisoEstadoCrm, EstadoCliente } from "@/components/crm/cuenta/estados";
import { HistoriaCuenta, ResumenIACrm } from "@/components/crm/cuenta/HistoriaCuenta";
import { statsCuenta } from "@/components/crm/cuenta/resumen";
import { ActividadReciente, OportunidadesAbiertas, OportunidadesTab, ResumenStats, RielDatos, VentasTab } from "@/components/crm/cuenta/SeccionesCuenta";
import { nombreCompleto, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import type { EmpresaOpcion } from "@/lib/formularios/contacto";
import type { AvisoCuenta, CambioEtapaFila, Cuenta360, EtapaCuenta, OportunidadCuenta, VentaCuenta } from "@/lib/cuenta360";
import { resumenCuenta } from "@/lib/timeline360";
import type { Tables } from "@/lib/supabase/types";
import { itemsEdicion, oportunidadesParaActividad, useAccionesContacto } from "../acciones";
import { datosContacto } from "../datos";

type Contacto = Tables<"contactos">;
type Actividad = Tables<"bitacora_entradas">;
type Tipo = Pick<Tables<"tipos_actividad">, "id" | "nombre" | "codigo" | "activo" | "orden">;

export type TabFicha = "resumen" | "actividad" | "oportunidades" | "ventas";

const ETIQUETA_TAB: Record<TabFicha, string> = {
  resumen: "Resumen",
  actividad: "Actividad",
  oportunidades: "Oportunidades",
  ventas: "Ventas",
};

const LINK = cn("rounded-[2px] text-(--crm-accent-text) underline-offset-2 hover:underline", FOCUS);

/**
 * Ficha de contacto (CRM 2.0), con la forma de la de empresa (MASTER.md §10.13–§10.14): franja de identidad (h1 = nombre
 * exacto, estado, empresa o "Cliente individual", cargo, responsable) con UNA acción primaria y "Más acciones"; debajo,
 * tabs por URL (`?tab=`): Resumen · Actividad · Oportunidades · Ventas, con las condiciones de permisos de la ficha legacy.
 * Los datos llegan del servidor; cada mutación hace `router.refresh()` (no hay copias locales que se desfasen).
 */
export default function ContactoDetalle({
  contacto,
  empresas,
  oportunidades,
  etapas,
  ventas,
  actividades,
  cambios,
  avisos,
  truncado,
  primeraCompra,
  hoy,
  tipos,
  perfiles,
  origenes,
  tabs,
  tab,
  yoId,
  puedeEditar,
  puedeAsignar,
  puedeVerOportunidades,
  puedeVerVentas,
  puedeVerActividades,
  puedeVerAvisos,
  puedeEscribirActividad,
  iaDisponible,
}: {
  contacto: Contacto;
  /** Las empresas que la persona ve (para el formulario); de acá sale la del contacto. */
  empresas: EmpresaOpcion[];
  oportunidades: OportunidadCuenta[];
  etapas: EtapaCuenta[];
  ventas: VentaCuenta[];
  actividades: Actividad[];
  cambios: CambioEtapaFila[];
  avisos: AvisoCuenta[];
  truncado: Cuenta360["truncado"];
  /** Fecha de la primera compra de toda la cuenta (aunque las ventas que se muestran estén recortadas). */
  primeraCompra: string | null;
  /** Hoy en horario argentino (`aaaa-mm-dd`), calculado en el servidor para que no se desfase al hidratar. */
  hoy: string;
  tipos: Tipo[];
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  /** Las tabs que existen para este rol (las arma el servidor). */
  tabs: TabFicha[];
  /** La tab activa, ya validada (`?tab=`; inválida → Resumen). */
  tab: TabFicha;
  yoId: string;
  /** Permisos del rol. Solo UX: la base exige cada uno igual. */
  puedeEditar: boolean;
  puedeAsignar: boolean;
  puedeVerOportunidades: boolean;
  puedeVerVentas: boolean;
  puedeVerActividades: boolean;
  puedeVerAvisos: boolean;
  puedeEscribirActividad: boolean;
  /** La IA está activada en el servidor (hay clave). Sin ella no se ofrece nada. */
  iaDisponible: boolean;
}) {
  const router = useRouter();
  // Cambiar de tab navega (la URL es el estado): en una transición, con el panel marcado `busy` hasta que llega.
  const [cambiandoTab, startTab] = useTransition();
  const refrescar = () => router.refresh();
  const acciones = useAccionesContacto({ empresas, perfiles, origenes, puedeAsignar, yoId }, refrescar);
  const actividad = useApertura<true>();

  const nombre = nombreCompleto(contacto);
  const puedeRegistrar = puedeEscribirActividad && puedeVerActividades;
  // La empresa del contacto, si la persona la ve (puede ser de otra cartera).
  const empresa = empresas.find((e) => e.id === contacto.empresa_id) ?? null;
  const responsable = (contacto.responsable_id && perfiles.find((p) => p.id === contacto.responsable_id)?.nombre) || null;
  const origen = origenes.find((o) => o.id === contacto.origen_id)?.nombre ?? null;
  const fichaHref = `/contactos/${contacto.id}`;

  const ver = useMemo(
    () => ({ actividades: puedeVerActividades, etapas: puedeVerOportunidades, ventas: puedeVerVentas, avisos: puedeVerAvisos && puedeVerVentas }),
    [puedeVerActividades, puedeVerOportunidades, puedeVerVentas, puedeVerAvisos],
  );
  const fuentes = { actividades, cambios, oportunidades, ventas, avisos, etapas, tipos, perfiles, ver };

  const resumen = useMemo(
    () => resumenCuenta({ ventas, oportunidades, actividades: puedeVerActividades ? actividades : null, hoy, primeraCompra }),
    [ventas, oportunidades, actividades, puedeVerActividades, hoy, primeraCompra],
  );
  // Sin ninguno de los tres permisos que lo alimentan, no hay cifras (igual que la ficha legacy).
  const stats = statsCuenta(resumen, { ventas: puedeVerVentas, oportunidades: puedeVerOportunidades, contacto: puedeVerActividades }, truncado);

  // Con tope (`truncado`) el contador lleva "+": hay más de las que se leyeron.
  const contar: Partial<Record<TabFicha, number | string>> = {
    oportunidades: truncado.oportunidades ? `${oportunidades.length}+` : oportunidades.length,
    ventas: truncado.ventas ? `${ventas.length}+` : ventas.length,
  };
  const items: TabItem[] = tabs.map((t) => ({
    value: t,
    label: ETIQUETA_TAB[t],
    count: contar[t],
    href: t === "resumen" ? fichaHref : `${fichaHref}?tab=${t}`,
  }));

  const registrar = puedeRegistrar ? (
    <Button variant="primary" icon={NotebookPen} onClick={() => actividad.abrir(true)}>
      Registrar actividad
    </Button>
  ) : null;
  const masAcciones = itemsEdicion(contacto, puedeEditar, acciones);
  // Sin permiso para registrar, "Editar" pasa a ser la acción visible (y el `⋮` queda con el resto).
  const primaria =
    registrar ??
    (puedeEditar ? (
      <Button variant="primary" icon={Pencil} onClick={() => acciones.editar(contacto)}>
        Editar
      </Button>
    ) : null);
  const overflow = registrar ? masAcciones : masAcciones.slice(1);

  return (
    <div className={cn(UI_ROOT, "flex min-h-full flex-col bg-(--crm-canvas)")}>
      <DetailHeader
        title={nombre}
        meta={
          <>
            <EstadoCliente estado={contacto.estado} className="text-(--crm-text)" />
            {!contacto.empresa_id ? (
              <Tag>Cliente individual</Tag>
            ) : empresa ? (
              <Link href={`/empresas/${empresa.id}`} className={LINK}>
                {empresa.nombre}
              </Link>
            ) : (
              <span>Empresa de otra cartera</span>
            )}
            {contacto.cargo && <span>{contacto.cargo}</span>}
            <span className="inline-flex items-center gap-1.5">
              {responsable && <Avatar name={responsable} size="xs" />}
              <span>
                <span className="sr-only">Responsable: </span>
                {responsable ?? "Sin asignar"}
              </span>
            </span>
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
            id="ficha-contacto"
            label="Secciones de la ficha"
            items={items}
            value={tab}
            navigate={(href) => startTab(() => router.push(href, { scroll: false }))}
          />
        }
      />

      <TabPanel tabsId="ficha-contacto" value={tab} busy={cambiandoTab} className="flex flex-1 flex-col gap-4 px-4 py-4 xl:px-6">
        <AvisoEstadoCrm
          estado={contacto.estado}
          entidad="contacto"
          accion={
            contacto.estado === "inactivo" && puedeEditar ? (
              <Button size="sm" icon={Power} onClick={() => void acciones.reactivar(contacto)}>
                Reactivar
              </Button>
            ) : undefined
          }
        />

        {tab === "resumen" && (
          // Superficie de trabajo, no una card: columna principal (lo que se opera) + riel de propiedades (Datos).
          <div className="grid min-w-0 items-start gap-x-6 gap-y-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-5">
              <ResumenStats stats={stats} />
              {puedeVerOportunidades && <OportunidadesAbiertas oportunidades={oportunidades} etapas={etapas} verTodas={`${fichaHref}?tab=oportunidades`} />}
              {tabs.includes("actividad") && <ActividadReciente href={`${fichaHref}?tab=actividad`} fuentes={fuentes} />}
            </div>
            <RielDatos label="Datos del contacto" items={datosContacto(contacto, { empresa, responsable, origen })} notas={contacto.notas} />
          </div>
        )}

        {tab === "actividad" && (
          <HistoriaCuenta
            {...fuentes}
            truncado={truncado}
            ia={iaDisponible ? <ResumenIACrm tipo="contacto" id={contacto.id} /> : undefined}
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
          <OportunidadesTab label="Oportunidades del contacto" oportunidades={oportunidades} etapas={etapas} truncado={truncado.oportunidades} />
        )}

        {tab === "ventas" && <VentasTab label="Ventas del contacto" ventas={ventas} truncado={truncado.ventas} />}
      </TabPanel>

      {acciones.overlays}
      {puedeRegistrar && (
        <ActividadDrawer
          key={`a-${actividad.n}`}
          open={actividad.abierto}
          onClose={actividad.cerrar}
          contactoId={contacto.id}
          // Se cuelga también de la empresa para que aparezca en su línea de tiempo; si la RLS no deja ver la empresa, no.
          empresaId={empresa?.id ?? null}
          tipos={tipos}
          oportunidades={oportunidadesParaActividad(oportunidades, empresa)}
          avisoNoContactar={contacto.estado === "no_contactar" || empresa?.estado === "no_contactar"}
          description={nombre}
          onSaved={() => {
            actividad.cerrar();
            refrescar();
          }}
        />
      )}
    </div>
  );
}
