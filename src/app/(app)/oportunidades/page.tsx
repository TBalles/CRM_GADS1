import { createClient } from "@/lib/supabase/server";
import OportunidadesView from "./OportunidadesView";

export default async function OportunidadesPage() {
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
    supabase.from("contactos").select("id, nombre, apellido").order("nombre"),
    supabase.from("productos").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("perfiles").select("id, nombre, email").order("nombre"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Oportunidades</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Embudo comercial y listado. Cambiá de etapa desde la tarjeta o editá cualquier fila con los tres puntos.
      </p>

      <OportunidadesView
        etapas={etapas ?? []}
        oportunidades={oportunidades ?? []}
        empresas={(empresas ?? []).map((e) => ({ id: e.id, label: e.nombre }))}
        contactos={(contactos ?? []).map((c) => ({
          id: c.id,
          label: `${c.nombre} ${c.apellido ?? ""}`.trim(),
        }))}
        productos={(productos ?? []).map((p) => ({ id: p.id, label: p.nombre }))}
        perfiles={(perfiles ?? []).map((p) => ({ id: p.id, label: p.nombre ?? p.email ?? p.id }))}
      />
    </div>
  );
}
