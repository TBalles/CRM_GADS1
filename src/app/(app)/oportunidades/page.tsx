import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import OportunidadesView from "./OportunidadesView";

export default async function OportunidadesPage() {
  const sesion = await exigirPermiso("oportunidades.ver");
  const supabase = await createClient();

  const [
    { data: etapas },
    { data: oportunidades },
    { data: empresas },
    { data: contactos },
    { data: productos },
    { data: perfiles },
  ] = await Promise.all([
    supabase.from("etapas").select("*").order("orden"),
    supabase
      .from("oportunidades")
      .select(
        `*,
         empresa:empresas(id, nombre),
         contacto:contactos(id, nombre, apellido),
         producto:productos(id, nombre),
         responsable:perfiles(id, nombre)`,
      )
      .order("created_at", { ascending: false }),
    supabase.from("empresas").select("id, nombre").order("nombre"),
    supabase.from("contactos").select("id, nombre, apellido, empresa_id").order("nombre"),
    supabase.from("productos").select("id, nombre").eq("activo", true).order("nombre"),
    // Only people who can actually take the deal: active, and never the
    // platform superadmin (RLS already hides it once it has no organization).
    supabase.from("perfiles").select("id, nombre, email").eq("activo", true).eq("es_superadmin", false).order("nombre"),
  ]);

  // The header and toolbar live inside the view: the title shares a row with
  // the search and stage filter, which need client state (DESIGN.md §4.4).
  return (
    <OportunidadesView
      puedeEditar={sesion.puede("oportunidades.editar")}
      etapas={etapas ?? []}
      oportunidades={oportunidades ?? []}
      empresas={(empresas ?? []).map((e) => ({ id: e.id, label: e.nombre }))}
      contactos={(contactos ?? []).map((c) => ({
        id: c.id,
        label: `${c.nombre} ${c.apellido ?? ""}`.trim(),
        empresaId: c.empresa_id,
        empresa: empresas?.find((e) => e.id === c.empresa_id)?.nombre ?? null,
      }))}
      productos={(productos ?? []).map((p) => ({ id: p.id, label: p.nombre }))}
      perfiles={(perfiles ?? []).map((p) => ({ id: p.id, label: p.nombre ?? p.email ?? p.id }))}
    />
  );
}
