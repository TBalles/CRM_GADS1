import { createClient } from "@/lib/supabase/server";
import EmpresasList from "./EmpresasList";

export default async function EmpresasPage() {
  const supabase = await createClient();
  const [{ data: empresas }, { data: contactos }] = await Promise.all([
    supabase.from("empresas").select("*").order("nombre"),
    supabase.from("contactos").select("*").order("nombre"),
  ]);

  // The page header and toolbar live inside EmpresasList: the kit puts the
  // title and the search box on the same row (DESIGN.md §4.4), and the search
  // needs client state.
  return <EmpresasList empresas={empresas ?? []} contactos={contactos ?? []} />;
}
