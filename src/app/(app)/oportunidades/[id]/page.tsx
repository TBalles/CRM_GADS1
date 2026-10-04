import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import { esUuid } from "@/lib/clientes";
import { cargarOpciones } from "../datos";
import OportunidadDetalle from "./OportunidadDetalle";

export const metadata = { title: "Oportunidad" };

export default async function OportunidadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await exigirPermiso("oportunidades.ver");
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  // Un id que no existe y uno que la RLS esconde (la cartera de otro vendedor)
  // son lo mismo para esta pantalla: no hay detalle.
  const { data: oportunidad } = await supabase.from("oportunidades").select("*").eq("id", id).maybeSingle();
  if (!oportunidad) notFound();

  const puedeVerActividades = sesion.puede("bitacora.ver");
  const nada = Promise.resolve({ data: null });

  const [opciones, { data: historial }, { data: auditoria }, { data: actividades }, { data: tipos }] = await Promise.all([
    cargarOpciones(supabase),
    supabase.from("oportunidad_etapas_historial").select("*").eq("oportunidad_id", id).order("cambiado_en", { ascending: false }),
    supabase.from("oportunidad_auditoria").select("*").eq("oportunidad_id", id).order("cambiado_en", { ascending: false }),
    puedeVerActividades
      ? supabase.from("bitacora_entradas").select("*").eq("oportunidad_id", id).order("ocurrido_en", { ascending: false })
      : nada,
    supabase.from("tipos_actividad").select("id, nombre, codigo, activo, orden").order("orden").order("nombre"),
  ]);

  return (
    <OportunidadDetalle
      oportunidad={oportunidad}
      historial={historial ?? []}
      auditoria={auditoria ?? []}
      actividades={actividades ?? []}
      tipos={tipos ?? []}
      opciones={opciones}
      yoId={sesion.user.id}
      puedeEditar={sesion.puede("oportunidades.editar")}
      puedeAsignar={sesion.puede("oportunidades.asignar")}
      puedeReabrir={sesion.puede("oportunidades.reabrir")}
      puedeVerActividades={puedeVerActividades}
      puedeEscribirActividad={sesion.puede("bitacora.escribir")}
      puedeVerClientes={sesion.puede("clientes.ver")}
    />
  );
}
