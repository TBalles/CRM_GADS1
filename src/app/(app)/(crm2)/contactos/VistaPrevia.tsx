import { createClient } from "@/lib/supabase/server";
import { leerCuenta360, type PermisosCuenta360 } from "@/lib/cuenta360";
import { resumenCuenta } from "@/lib/timeline360";
import { hoyAR } from "@/lib/oportunidades";
import { nombreCompleto, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import type { EmpresaOpcion } from "@/lib/formularios/contacto";
import { urlConParams, type ParamsUrl } from "@/lib/paginacion";
import { DefinitionList } from "@/components/crm/Panel";
import { PreviewPanel } from "@/components/crm/PreviewPanel";
import { Avatar } from "@/components/crm/Status";
import { AvisoEstadoCrm, EstadoCliente, UltimoContacto } from "@/components/crm/cuenta/estados";
import { MovimientosPrevia, OportunidadesPrevia } from "@/components/crm/cuenta/SeccionesCuenta";
import AccionesVistaPrevia from "./AccionesVistaPrevia";
import { empresaDelContacto, mailDe } from "./datos";

/**
 * Vista previa de un contacto (master-detail, MASTER.md §10.14): server component con el cliente de la sesión (RLS) y la
 * misma capa de datos que la ficha (`leerCuenta360` por `contacto_id`). Si el contacto no existe o la RLS lo esconde, no
 * dibuja nada. Para operar sin abrir la ficha: identidad, UNA acción + `⋮`, su empresa y cómo contactarlo, el último
 * contacto, lo abierto y lo último que pasó. Origen, alta y observaciones quedan en la ficha.
 */
export default async function VistaPrevia({
  id,
  params,
  enLista,
  empresas,
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
  /** El contacto está en la página que se ve (si no, el panel lo dice: puede venir de un link o de otro filtro). */
  enLista: boolean;
  /** Las empresas que la persona ve (las del formulario): de acá sale la del contacto. */
  empresas: EmpresaOpcion[];
  perfiles: PerfilOpcion[];
  origenes: OrigenOpcion[];
  yoId: string;
  puedeEditar: boolean;
  puedeAsignar: boolean;
  permisos: PermisosCuenta360;
  puedeEscribirActividad: boolean;
}) {
  const supabase = await createClient();
  const [{ data: contacto }, cuenta, { data: tipos }] = await Promise.all([
    supabase.from("contactos").select("*").eq("id", id).maybeSingle(),
    leerCuenta360(supabase, "contacto_id", id, permisos),
    supabase.from("tipos_actividad").select("id, nombre, codigo, activo, orden").order("orden").order("nombre"),
  ]);
  if (!contacto) return null;

  const nombre = nombreCompleto(contacto);
  // La empresa del contacto puede ser de otra cartera: si la RLS no la muestra, no está en `empresas`.
  const empresa = empresas.find((e) => e.id === contacto.empresa_id) ?? null;
  const responsable = contacto.responsable_id ? (perfiles.find((p) => p.id === contacto.responsable_id)?.nombre ?? null) : null;
  const abiertas = cuenta.oportunidades.filter((o) => o.estado === "abierta");
  const resumen = permisos.actividades
    ? resumenCuenta({ ventas: cuenta.ventas, oportunidades: cuenta.oportunidades, actividades: cuenta.actividades, hoy: hoyAR(), primeraCompra: cuenta.primeraCompra })
    : null;
  const verHistoria = permisos.actividades || permisos.oportunidades || permisos.ventas || permisos.avisos;
  const ficha = `/contactos/${contacto.id}`;

  return (
    <PreviewPanel
      title={nombre}
      outOfList={!enLista}
      closeHref={urlConParams("/contactos", params, { sel: null })}
      detailHref={ficha}
      meta={
        <>
          <EstadoCliente estado={contacto.estado} className="text-(--crm-text)" />
          {contacto.cargo && <span>{contacto.cargo}</span>}
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {responsable && <Avatar name={responsable} size="xs" />}
            <span className="truncate">{responsable ?? "Sin asignar"}</span>
          </span>
        </>
      }
      actions={
        <AccionesVistaPrevia
          contacto={contacto}
          empresa={empresa}
          empresas={empresas}
          perfiles={perfiles}
          origenes={origenes}
          yoId={yoId}
          puedeAsignar={puedeAsignar}
          puedeEditar={puedeEditar}
          puedeRegistrar={puedeEscribirActividad && permisos.actividades}
          tipos={tipos ?? []}
          oportunidades={cuenta.oportunidades}
        />
      }
    >
      <AvisoEstadoCrm estado={contacto.estado} entidad="contacto" />

      <DefinitionList
        inline
        columns={1}
        items={[
          { term: "Empresa", value: empresaDelContacto(contacto, empresa) },
          { term: "Teléfono", value: contacto.telefono, mono: true },
          { term: "Email", value: mailDe(contacto.email) },
          { term: "Documento", value: contacto.documento, mono: true },
          ...(resumen ? [{ term: "Último contacto", value: <UltimoContacto resumen={resumen} /> }] : []),
        ]}
      />

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
            ver: { actividades: permisos.actividades, etapas: permisos.oportunidades, ventas: permisos.ventas, avisos: permisos.avisos && permisos.ventas },
          }}
        />
      )}
    </PreviewPanel>
  );
}
