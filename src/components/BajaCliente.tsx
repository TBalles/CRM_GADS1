"use client";

import { createClient } from "@/lib/supabase/client";
import { mensajeErrorGuardado, type EstadoCliente } from "@/lib/clientes";
import type { Tables } from "@/lib/supabase/types";

export type TipoCliente = "empresa" | "contacto";
export type Fila<T extends TipoCliente> = T extends "empresa" ? Tables<"empresas"> : Tables<"contactos">;

/**
 * Cambia el estado de una empresa o un contacto. La baja logica es
 * `estado = 'inactivo'`: desde la 0008 la base no deja borrar a ningun usuario,
 * asi que no hay camino de borrado en la interfaz.
 */
export async function cambiarEstado<T extends TipoCliente>(tipo: T, id: string, estado: EstadoCliente) {
  const supabase = createClient();
  const res =
    tipo === "empresa"
      ? await supabase.from("empresas").update({ estado }).eq("id", id).select().single()
      : await supabase.from("contactos").update({ estado }).eq("id", id).select().single();
  return { row: (res.data as Fila<T> | null) ?? null, error: res.error };
}

type Aviso = { mensaje: string; tipo: "success" | "error" };

/**
 * Reactivar una empresa o contacto dado de baja (`inactivo`). Vuelve a `cliente`
 * si ya compró (tiene ventas; el contacto, también si su empresa ya es cliente)
 * y a `potencial` si no. Un `no_contactar` no se reactiva: es un pedido del
 * cliente y se cambia a propósito desde "Editar".
 *
 * Sin UI: devuelve la fila y el aviso; quien llama lo muestra con su toast.
 * `empresaId` solo importa para un contacto.
 */
export async function reactivarCliente<T extends TipoCliente>(
  tipo: T,
  id: string,
  nombre: string,
  empresaId?: string | null,
): Promise<{ row: Fila<T> | null; aviso: Aviso }> {
  const supabase = createClient();
  const { count } = await supabase
    .from("ventas")
    .select("id", { count: "exact", head: true })
    .eq(tipo === "empresa" ? "empresa_id" : "contacto_id", id);
  let compro = (count ?? 0) > 0;
  let motivo = "ya compró";
  if (!compro && tipo === "contacto" && empresaId) {
    const { data } = await supabase.from("empresas").select("estado").eq("id", empresaId).maybeSingle();
    compro = data?.estado === "cliente";
    motivo = "su empresa ya es cliente";
  }

  const { row, error } = await cambiarEstado(tipo, id, compro ? "cliente" : "potencial");
  if (error || !row) {
    return { row: null, aviso: { mensaje: mensajeErrorGuardado(error, `No se pudo reactivar «${nombre}». Intentá de nuevo.`), tipo: "error" } };
  }
  return { row, aviso: { mensaje: `«${nombre}» se reactivó como ${compro ? `Cliente (${motivo})` : "Potencial"}.`, tipo: "success" } };
}

/** La baja lógica (`inactivo`) con su aviso, sin UI: la usa el diálogo de CRM 2.0 (`BajaDialog`). */
export async function darDeBajaCliente<T extends TipoCliente>(
  tipo: T,
  objetivo: { id: string; nombre: string },
): Promise<{ row: Fila<T> | null; aviso: Aviso }> {
  const { row, error } = await cambiarEstado(tipo, objetivo.id, "inactivo");
  if (error || !row) {
    return {
      row: null,
      aviso: { mensaje: mensajeErrorGuardado(error, `No se pudo dar de baja a «${objetivo.nombre}». Intentá de nuevo.`), tipo: "error" },
    };
  }
  const la = tipo === "empresa";
  return {
    row,
    aviso: {
      mensaje: `«${objetivo.nombre}» pasó a Inactivo. ${la ? "La" : "Lo"} ves con «${la ? "Ver dadas de baja" : "Ver bajas"}».`,
      tipo: "success",
    },
  };
}

/** Texto de la confirmación de baja. */
export function textoBaja(tipo: TipoCliente, nombre: string) {
  return {
    titulo: tipo === "empresa" ? "Dar de baja la empresa" : "Dar de baja el contacto",
    descripcion: `«${nombre}» pasa a Inactivo. No se borra: conserva su historial y ${tipo === "empresa" ? "la" : "lo"} podés reactivar cuando quieras.`,
  };
}
