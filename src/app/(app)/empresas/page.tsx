import { createClient } from "@/lib/supabase/server";
import EmpresasList from "./EmpresasList";

export default async function EmpresasPage() {
  const supabase = await createClient();
  const [{ data: empresas }, { data: contactos }] = await Promise.all([
    supabase.from("empresas").select("*").order("nombre"),
    supabase.from("contactos").select("*").order("nombre"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Empresas</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Clubes, canchas, complejos y escuelas de fútbol. Desplegá una empresa para ver sus contactos.
      </p>

      <EmpresasList empresas={empresas ?? []} contactos={contactos ?? []} />
    </div>
  );
}
