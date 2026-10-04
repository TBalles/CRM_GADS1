"use server";

import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/sesion";
import { formatMoney } from "@/lib/money";
import { filtroOr, terminos } from "@/lib/paginacion";
import {
  MAX_POR_GRUPO,
  consultaBuscable,
  gruposPermitidos,
  ordenarGrupos,
  type GrupoClave,
  type RespuestaBusqueda,
  type Resultado,
} from "@/lib/paleta";

/**
 * Búsqueda global (Ctrl/Cmd+K): empresas, contactos, oportunidades y productos.
 *
 * Una Server Action es un endpoint HTTP público, así que lo que llega (`texto`) puede ser cualquier
 * cosa: se valida el tipo y se limpia. NO usa la clave de servicio: consulta con la sesión de la
 * persona, de modo que la RLS decide qué ve (un Vendedor recibe solo su cartera) y, además, solo se
 * consultan las tablas que su rol puede ver.
 *
 * El texto nunca se arma a mano dentro de un filtro: `filtroOr` lo escapa (`%`, `_`, `\`, comillas
 * y comas). Cada palabra escrita tiene que aparecer en alguna de las columnas ("Juan Pérez" encuentra
 * nombre "Juan" y apellido "Pérez"), con tope de 4 palabras.
 */

const COLUMNAS = {
  empresas: ["nombre", "cuit", "email", "telefono"],
  contactos: ["nombre", "apellido", "email", "telefono", "documento"],
  oportunidades: ["titulo"],
  productos: ["nombre", "marca", "categoria"],
} as const satisfies Record<GrupoClave, readonly string[]>;

function unir(...partes: (string | null | undefined | false)[]): string {
  return partes.filter(Boolean).join(" · ");
}

export async function buscarGlobal(texto: unknown): Promise<RespuestaBusqueda> {
  const sesion = await getSesion();
  if (!sesion || !sesion.puedeOperar) return { ok: false, error: "Tu sesión venció. Volvé a ingresar." };

  const consulta = consultaBuscable(texto);
  if (!consulta) return { ok: true, consulta: "", grupos: [] };

  const permitidos = new Set(gruposPermitidos(sesion.permisos));
  const palabras = terminos(consulta);
  const supabase = await createClient();

  // Cada palabra suma un `.or()`: se encadenan con AND.
  const filtrar = <Q extends { or(filtro: string): Q }>(q: Q, columnas: readonly string[]): Q =>
    palabras.reduce((acc, palabra) => acc.or(filtroOr(columnas, palabra)), q);

  const vacio = Promise.resolve({ data: null, error: null });
  const [empresas, contactos, oportunidades, productos] = await Promise.all([
    permitidos.has("empresas")
      ? filtrar(supabase.from("empresas").select("id, nombre, cuit, email, estado"), COLUMNAS.empresas)
          .order("nombre")
          .order("id")
          .limit(MAX_POR_GRUPO)
      : vacio,
    permitidos.has("contactos")
      ? filtrar(
          supabase.from("contactos").select("id, nombre, apellido, cargo, email, estado, empresa_id, empresa:empresas(nombre)"),
          COLUMNAS.contactos,
        )
          .order("nombre")
          .order("id")
          .limit(MAX_POR_GRUPO)
      : vacio,
    permitidos.has("oportunidades")
      ? filtrar(supabase.from("oportunidades").select("id, titulo, estado, monto, empresa:empresas(nombre)"), COLUMNAS.oportunidades)
          .order("created_at", { ascending: false })
          .order("id")
          .limit(MAX_POR_GRUPO)
      : vacio,
    permitidos.has("productos")
      ? filtrar(supabase.from("productos").select("id, nombre, categoria, marca, activo"), COLUMNAS.productos)
          .order("nombre")
          .order("id")
          .limit(MAX_POR_GRUPO)
      : vacio,
  ]);

  // Un error se dice: "Nada con «X»" sobre una consulta que falló sería afirmar algo que no sabemos.
  const falla = [empresas, contactos, oportunidades, productos].find((r) => r.error);
  if (falla?.error) {
    console.error("buscarGlobal:", falla.error.message);
    return { ok: false, error: "No se pudo buscar. Probá de nuevo en un momento." };
  }

  const cruda: Partial<Record<GrupoClave, Resultado[]>> = {
    empresas: (empresas.data ?? []).map((e) => ({
      id: e.id,
      titulo: e.nombre,
      detalle: unir(e.estado === "inactivo" && "Dada de baja", e.cuit, e.email),
      href: `/empresas/${e.id}`,
    })),
    contactos: (contactos.data ?? []).map((c) => ({
      id: c.id,
      titulo: [c.nombre, c.apellido].filter(Boolean).join(" "),
      detalle: unir(c.estado === "inactivo" && "Dado de baja", c.empresa?.nombre ?? (c.empresa_id ? "Empresa de otra cartera" : "Cliente individual"), c.cargo),
      href: `/contactos/${c.id}`,
    })),
    oportunidades: (oportunidades.data ?? []).map((o) => ({
      id: o.id,
      titulo: o.titulo,
      detalle: unir(
        o.estado === "ganada" ? "Ganada" : o.estado === "perdida" ? "Perdida" : "Abierta",
        o.empresa?.nombre,
        o.monto ? formatMoney(Number(o.monto)) : null,
      ),
      href: `/oportunidades/${o.id}`,
    })),
    productos: (productos.data ?? []).map((p) => ({
      id: p.id,
      titulo: p.nombre,
      detalle: unir(!p.activo && "De baja", p.categoria, p.marca),
      // No hay ficha de producto: la lista ya filtra por `?q=`.
      href: `/productos?q=${encodeURIComponent(p.nombre)}`,
    })),
  };

  return { ok: true, consulta, grupos: ordenarGrupos(cruda) };
}
