import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import EmpresasList from "./EmpresasList";

export default async function EmpresasPage() {
  const sesion = await exigirPermiso("clientes.ver");
  const supabase = await createClient();
  const [{ data: empresas }, { data: contactos }, { data: bitacora }] = await Promise.all([
    supabase.from("empresas").select("*").order("nombre"),
    supabase.from("contactos").select("*").order("nombre"),
    supabase.from("bitacora_entradas").select("*").order("ocurrido_en", { ascending: false }),
  ]);

  // The page header and toolbar live inside EmpresasList: the kit puts the
  // title and the search box on the same row (DESIGN.md §4.4), and the search
  // needs client state.
  return (
    <EmpresasList
      empresas={empresas ?? []}
      contactos={contactos ?? []}
      bitacora={bitacora ?? []}
      puedeEditar={sesion.puede("clientes.editar")}
      puedeVerBitacora={sesion.puede("bitacora.ver")}
      puedeEscribirBitacora={sesion.puede("bitacora.escribir")}
    />
  );
}
