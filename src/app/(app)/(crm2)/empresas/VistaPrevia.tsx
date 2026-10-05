import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { leerCuenta360, type PermisosCuenta360 } from "@/lib/cuenta360";
import { resumenCuenta } from "@/lib/timeline360";
import { hoyAR } from "@/lib/oportunidades";
import { etiquetaTipoCliente, estaDeBaja, nombreCompleto, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import { urlConParams, type ParamsUrl } from "@/lib/paginacion";
import { DefinitionList } from "@/components/crm/Panel";
import { PreviewPanel } from "@/components/crm/PreviewPanel";
import { Avatar } from "@/components/crm/Status";
import { SectionBar } from "@/components/crm/PageBar";
import { AvisoEstadoCrm, EstadoCliente, UltimoContacto } from "@/components/crm/cuenta/estados";
import { MovimientosPrevia, OportunidadesPrevia, TOPE_PREVIA } from "@/components/crm/cuenta/SeccionesCuenta";
import { FOCUS, TYPE, cn } from "@/components/crm/cx";
import AccionesVistaPrevia from "./AccionesVistaPrevia";

export { PreviewPanelSkeleton as VistaPreviaCargando } from "@/components/crm/PreviewPanel";

const LINK = cn("rounded-[2px] underline-offset-2 hover:underline", FOCUS);

/**
 * Vista previa de una empresa (master-detail, MASTER.md §10.13): server component con el cliente de la sesión (RLS) y la
 * misma capa de datos que la ficha (`leerCuenta360`). Si la empresa no existe o la RLS la esconde, no dibuja nada.
 * Es para operar sin abrir la ficha: identidad, UNA acción + `⋮`, cómo contactarla, sus contactos clave, lo abierto,
 * el último contacto y lo último que pasó. Alta, origen, sitio web y el resto quedan en la ficha (y en la fila).
 */
export default async function VistaPrevia({
  id,
  params,
  enLista,
  perfiles,
  origenes,
  yoId,
  puedeEditar,
  puedeAsignar,
  permisos,
  puedeEscribirActividad,
}: {
  id: string;
  /** Los parámetros de la lista (para cerrar sin perder búsqueda, filtros ni página). */
  params: ParamsUrl;
  /** La empresa está en la página que se ve (si no, el panel lo dice: puede venir de un link o de otro filtro). */
  enLista: boolean;
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  yoId: string;
  puedeEditar: boolean;
  puedeAsignar: boolean;
  permisos: PermisosCuenta360;
  puedeEscribirActividad: boolean;
}) {
  const supabase = await createClient();
  const [{ data: empresa }, { data: contactos }, cuenta, { data: tipos }] = await Promise.all([
    supabase.from("empresas").select("*").eq("id", id).maybeSingle(),
    supabase.from("contactos").select("id, nombre, apellido, estado, cargo, telefono, email").eq("empresa_id", id).order("nombre"),
    leerCuenta360(supabase, "empresa_id", id, permisos),
    supabase.from("tipos_actividad").select("id, nombre, codigo, activo, orden").order("orden").order("nombre"),
  ]);
  if (!empresa) return null;

  const responsable = empresa.responsable_id ? (perfiles.find((p) => p.id === empresa.responsable_id)?.nombre ?? null) : null;
  const tipo = etiquetaTipoCliente(empresa.tipo_cliente);
  const activos = (contactos ?? []).filter((c) => !estaDeBaja(c.estado));
  const abiertas = cuenta.oportunidades.filter((o) => o.estado === "abierta");
  const resumen = permisos.actividades
    ? resumenCuenta({ ventas: cuenta.ventas, oportunidades: cuenta.oportunidades, actividades: cuenta.actividades, hoy: hoyAR(), primeraCompra: cuenta.primeraCompra })
    : null;
  const verHistoria = permisos.actividades || permisos.oportunidades || permisos.ventas || permisos.avisos;
  const cerrar = urlConParams("/empresas", params, { sel: null });
  const ficha = `/empresas/${empresa.id}`;

  return (
    <PreviewPanel
      title={empresa.nombre}
      outOfList={!enLista}
      closeHref={cerrar}
      detailHref={ficha}
      meta={
        <>
          <EstadoCliente estado={empresa.estado} className="text-(--crm-text)" />
          {tipo && <span>{tipo}</span>}
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {responsable && <Avatar name={responsable} size="xs" />}
            <span className="truncate">{responsable ?? "Sin asignar"}</span>
          </span>
        </>
      }
      actions={
        <AccionesVistaPrevia
          empresa={empresa}
          perfiles={perfiles}
          origenes={origenes}
          yoId={yoId}
          puedeAsignar={puedeAsignar}
          puedeEditar={puedeEditar}
          puedeRegistrar={puedeEscribirActividad && permisos.actividades}
          tipos={tipos ?? []}
          contactos={activos.map((c) => ({ id: c.id, label: nombreCompleto(c) }))}
          oportunidades={abiertas.map((o) => ({ id: o.id, label: o.titulo }))}
        />
      }
    >
      <AvisoEstadoCrm estado={empresa.estado} entidad="empresa" />

      <DefinitionList
        inline
        columns={1}
        items={[
          { term: "Teléfono", value: empresa.telefono, mono: true },
          {
            term: "Email",
            value: empresa.email && (
              <a href={`mailto:${empresa.email}`} className={cn(LINK, "break-all text-(--crm-accent-text)")}>
                {empresa.email}
              </a>
            ),
          },
          { term: "CUIT", value: empresa.cuit, mono: true },
          ...(resumen ? [{ term: "Último contacto", value: <UltimoContacto resumen={resumen} /> }] : []),
        ]}
      />

      <section>
        <SectionBar as="h3" title="Contactos" count={activos.length} className="h-8" />
        {activos.length ? (
          <ul className="border-t border-(--crm-border)">
            {activos.slice(0, TOPE_PREVIA).map((c) => (
              <li key={c.id} className="flex flex-col border-b border-(--crm-border) py-1.5">
                <span className={cn(TYPE.table, "flex min-w-0 items-baseline gap-2")}>
                  <Link href={`/contactos/${c.id}`} className={cn(LINK, "truncate font-medium")}>
                    {nombreCompleto(c)}
                  </Link>
                  {c.cargo && <span className="truncate text-(--crm-text-2)">{c.cargo}</span>}
                </span>
                {(c.telefono || c.email) && (
                  <span className={cn(TYPE.meta, "flex min-w-0 gap-3 text-(--crm-text-2)")}>
                    {c.telefono && <span className={cn(TYPE.mono, "shrink-0")}>{c.telefono}</span>}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className={cn(LINK, "truncate")}>
                        {c.email}
                      </a>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn(TYPE.table, "text-(--crm-text-2)")}>Sin contactos cargados.</p>
        )}
      </section>

      {permisos.oportunidades && <OportunidadesPrevia abiertas={abiertas} etapas={cuenta.etapas} />}

      {verHistoria && (
        <MovimientosPrevia
          href={`${ficha}?tab=actividad`}
          fuentes={{
            actividades: cuenta.actividades,
            cambios: cuenta.cambios,
            oportunidades: cuenta.oportunidades,
            ventas: cuenta.ventas,
            avisos: cuenta.avisos,
            etapas: cuenta.etapas,
            tipos: tipos ?? [],
            perfiles,
            contactos: (contactos ?? []).map((c) => ({ id: c.id, label: nombreCompleto(c) })),
            ver: { actividades: permisos.actividades, etapas: permisos.oportunidades, ventas: permisos.ventas, avisos: permisos.avisos && permisos.ventas },
          }}
        />
      )}
    </PreviewPanel>
  );
}
