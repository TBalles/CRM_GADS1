import { createClient } from "@/lib/supabase/server";
import EmbudoBoard from "./EmbudoBoard";

export default async function EmbudoPage() {
  const supabase = await createClient();

  const [{ data: etapas }, { data: oportunidades }] = await Promise.all([
    supabase.from("etapas").select("id, nombre, orden, color").order("orden"),
    supabase
      .from("oportunidades")
      .select(
        `id, titulo, monto, etapa_id,
         empresa:empresas(nombre),
         contacto:contactos(nombre, apellido)`,
      )
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Embudo comercial</h1>
      <p className="mt-1 text-sm text-slate-500">
        Oportunidades agrupadas por etapa. Usá el selector de cada tarjeta para cambiarla de
        etapa.
      </p>

      <EmbudoBoard etapas={etapas ?? []} oportunidades={oportunidades ?? []} />
    </div>
  );
}
