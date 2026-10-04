import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { nombreCompleto, type OrigenOpcion, type PerfilOpcion } from "@/lib/clientes";
import type { OpcionContacto, OpcionEmpresa, OpcionProducto } from "@/lib/oportunidades";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Catalogos y opciones que comparten /oportunidades y /oportunidades/[id]: el
 * formulario, los filtros y los nombres de la ficha salen de aca. La RLS decide
 * que clientes ve cada rol (un Vendedor, solo su cartera).
 */
export async function cargarOpciones(supabase: Supabase) {
  const [
    { data: etapas },
    { data: empresas },
    { data: contactos },
    { data: productos },
    { data: perfiles },
    { data: origenes },
    { data: motivos },
  ] = await Promise.all([
    supabase.from("etapas").select("*").order("orden"),
    supabase.from("empresas").select("id, nombre, estado").order("nombre"),
    supabase.from("contactos").select("id, nombre, apellido, empresa_id, estado").order("nombre"),
    supabase.from("productos").select("id, nombre, activo").order("nombre"),
    supabase.from("perfiles").select("id, nombre, email, activo").eq("es_superadmin", false).order("nombre"),
    supabase.from("origenes").select("id, nombre, activo").order("orden").order("nombre"),
    supabase.from("motivos_perdida").select("id, nombre, activo, orden").order("orden").order("nombre"),
  ]);

  const empresaPorId = new Map((empresas ?? []).map((e) => [e.id, e.nombre]));

  return {
    etapas: etapas ?? [],
    empresas: (empresas ?? []).map((e): OpcionEmpresa => ({ id: e.id, label: e.nombre, estado: e.estado })),
    contactos: (contactos ?? []).map(
      (c): OpcionContacto => ({
        id: c.id,
        label: nombreCompleto(c),
        estado: c.estado,
        empresaId: c.empresa_id,
        empresa: c.empresa_id ? (empresaPorId.get(c.empresa_id) ?? null) : null,
      }),
    ),
    productos: (productos ?? []).map((p): OpcionProducto => ({ id: p.id, label: p.nombre, activo: p.activo })),
    perfiles: (perfiles ?? []).map((p): PerfilOpcion => ({ id: p.id, nombre: p.nombre ?? p.email ?? "Usuario", activo: p.activo })),
    origenes: (origenes ?? []) as OrigenOpcion[],
    motivos: motivos ?? [],
  };
}

export type Opciones = Awaited<ReturnType<typeof cargarOpciones>>;
