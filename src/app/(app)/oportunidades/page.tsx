import { createClient } from "@/lib/supabase/server";
import { exigirPermiso } from "@/lib/sesion";
import OportunidadesView from "./OportunidadesView";
import { cargarOpciones } from "./datos";

export const metadata = { title: "Oportunidades" };

export default async function OportunidadesPage() {
  const sesion = await exigirPermiso("oportunidades.ver");
  const supabase = await createClient();

  const [opciones, { data: oportunidades }] = await Promise.all([
    cargarOpciones(supabase),
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
  ]);

  // The header and toolbar live inside the view: the title shares a row with
  // the search and the filters, which need client state (DESIGN.md §4.4).
  return (
    <OportunidadesView
      etapas={opciones.etapas}
      oportunidades={oportunidades ?? []}
      empresas={opciones.empresas}
      contactos={opciones.contactos}
      productos={opciones.productos}
      perfiles={opciones.perfiles}
      origenes={opciones.origenes}
      motivos={opciones.motivos}
      yoId={sesion.user.id}
      puedeEditar={sesion.puede("oportunidades.editar")}
      puedeAsignar={sesion.puede("oportunidades.asignar")}
      puedeReabrir={sesion.puede("oportunidades.reabrir")}
      puedeVerTodos={sesion.puede("clientes.ver_todos")}
    />
  );
}
