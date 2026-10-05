import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { esUuid } from "@/lib/clientes";
import { leerCuenta360 } from "@/lib/cuenta360";
import { hoyAR } from "@/lib/oportunidades";
import { iaDisponible } from "@/lib/ia/config";
import { CrumbLabel } from "@/components/crm/shell/Crumbs";
import { tabValida } from "@/components/crm/seleccion";
import ContactoDetalle, { type TabFicha } from "./ContactoDetalle";

export const metadata = { title: "Contacto" };

export default async function ContactoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { id } = await params;
  const { tab: tabPedida } = await searchParams;
  const sesion = await exigirPermiso("clientes.ver");
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  // Un id que no existe y uno que la RLS esconde son lo mismo para esta pantalla: no hay ficha.
  const { data: contacto } = await supabase.from("contactos").select("*").eq("id", id).maybeSingle();
  if (!contacto) notFound();

  const puedeVerOportunidades = sesion.puede("oportunidades.ver");
  const puedeVerVentas = sesion.puede("ventas.ver");
  const puedeVerActividades = sesion.puede("bitacora.ver");
  const puedeVerAvisos = sesion.puede("alertas.ver");

  const [{ data: empresas }, cuenta, { data: tipos }, { data: perfiles }, { data: origenes }] = await Promise.all([
    supabase.from("empresas").select("id, nombre, estado").order("nombre"),
    // F5: oportunidades (con su historial), ventas (con ítems y avisos) y actividades de este contacto, acotadas.
    leerCuenta360(supabase, "contacto_id", id, {
      oportunidades: puedeVerOportunidades,
      ventas: puedeVerVentas,
      actividades: puedeVerActividades,
      avisos: puedeVerAvisos,
    }),
    supabase.from("tipos_actividad").select("id, nombre, codigo, activo, orden").order("orden").order("nombre"),
    supabase.from("perfiles").select("id, nombre, email, activo").eq("es_superadmin", false).order("nombre"),
    supabase.from("origenes").select("id, nombre, activo").order("orden").order("nombre"),
  ]);

  // Tabs que existen para este rol (las mismas condiciones con que la ficha legacy mostraba cada sección): la historia
  // con cualquiera de sus cuatro permisos, oportunidades y ventas con el suyo. Una tab pedida que no existe cae en Resumen.
  const tabs: TabFicha[] = [
    "resumen",
    ...(puedeVerActividades || puedeVerOportunidades || puedeVerVentas || puedeVerAvisos ? (["actividad"] as const) : []),
    ...(puedeVerOportunidades ? (["oportunidades"] as const) : []),
    ...(puedeVerVentas ? (["ventas"] as const) : []),
  ];

  return (
    <>
      <CrumbLabel>{[contacto.nombre, contacto.apellido].filter(Boolean).join(" ")}</CrumbLabel>
      <ContactoDetalle
        contacto={contacto}
        empresas={empresas ?? []}
        oportunidades={cuenta.oportunidades}
        etapas={cuenta.etapas}
        ventas={cuenta.ventas}
        actividades={cuenta.actividades}
        cambios={cuenta.cambios}
        avisos={cuenta.avisos}
        truncado={cuenta.truncado}
        primeraCompra={cuenta.primeraCompra}
        hoy={hoyAR()}
        tipos={tipos ?? []}
        perfiles={(perfiles ?? []).map((p) => ({ id: p.id, nombre: p.nombre ?? p.email ?? "Usuario", activo: p.activo }))}
        origenes={origenes ?? []}
        tabs={tabs}
        tab={tabValida(tabPedida, tabs)}
        yoId={sesion.user.id}
        puedeEditar={sesion.puede("clientes.editar")}
        puedeAsignar={sesion.puede("clientes.asignar")}
        puedeVerOportunidades={puedeVerOportunidades}
        puedeVerVentas={puedeVerVentas}
        puedeVerActividades={puedeVerActividades}
        puedeVerAvisos={puedeVerAvisos}
        puedeEscribirActividad={sesion.puede("bitacora.escribir")}
        iaDisponible={iaDisponible()}
      />
    </>
  );
}
