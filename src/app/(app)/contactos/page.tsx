import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import ContactosList from "./ContactosList";

export const metadata = { title: "Contactos" };

export default async function ContactosPage() {
  // Los contactos cuelgan del mismo permiso que las empresas (`clientes.ver`).
  const sesion = await exigirPermiso("clientes.ver");
  const supabase = await createClient();
  // La RLS ya limita la cartera: un vendedor ve sus contactos y los de sus
  // empresas; con clientes.ver_todos, todos.
  // ponytail: sin paginar. PostgREST corta en silencio en `max_rows` (1000 por defecto en Supabase), así que
  // una cartera más grande se vería recortada sin aviso; la paginación en el servidor llega en F3.
  const [{ data: contactos }, { data: empresas }, { data: perfiles }, { data: origenes }] = await Promise.all([
    supabase.from("contactos").select("*").order("nombre"),
    supabase.from("empresas").select("id, nombre, estado").order("nombre"),
    supabase.from("perfiles").select("id, nombre, email, activo").eq("es_superadmin", false).order("nombre"),
    supabase.from("origenes").select("id, nombre, activo").order("orden").order("nombre"),
  ]);

  return (
    <ContactosList
      contactos={contactos ?? []}
      empresas={empresas ?? []}
      perfiles={(perfiles ?? []).map((p) => ({ id: p.id, nombre: p.nombre ?? p.email ?? "Usuario", activo: p.activo }))}
      origenes={origenes ?? []}
      puedeEditar={sesion.puede("clientes.editar")}
      puedeAsignar={sesion.puede("clientes.asignar")}
      puedeVerTodos={sesion.puede("clientes.ver_todos")}
      yoId={sesion.user.id}
    />
  );
}
