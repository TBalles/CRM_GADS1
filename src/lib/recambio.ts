/**
 * Recambio en 1 clic (F4): de una alerta de vida útil a una oportunidad abierta,
 * sin pasar por el formulario. Esto es la parte pura: el título, el valor, el
 * origen del catálogo y la detección de duplicados. El insert lo hace
 * `AlertasView` con el cliente de Supabase del navegador.
 *
 * Imports relativos con extensión: se prueba con `node --test` (recambio.check.ts).
 */
import { formatFecha, origenPorNombre } from "./clientes.ts";

/** Nombre del origen sembrado por organización (`crear_catalogos_iniciales`, 0007). */
export const ORIGEN_RECAMBIO = "Recambio por vida útil";

const MAX_TITULO = 200;

/** Lo que la vista `alertas_vida_util` sabe de un equipo por reponer. */
export type AlertaRecambio = {
  venta_item_id: string | null;
  producto_id: string | null;
  producto_nombre: string | null;
  cantidad: number | null;
  empresa_id: string | null;
  empresa_nombre: string | null;
  contacto_id: string | null;
  fecha_entrega: string | null;
  vida_util_meses: number | null;
  vence_el: string | null;
};

/** "Recambio: Arco de fútbol 11 — Club Atlético Norte". */
export function tituloRecambio(producto: string | null, empresa: string | null): string {
  const partes = `Recambio: ${producto?.trim() || "equipo"}${empresa?.trim() ? ` — ${empresa.trim()}` : ""}`;
  return partes.slice(0, MAX_TITULO);
}

/** Valor estimado = precio de lo que se vendió × cantidad. Sin precio cargado no se inventa uno: null. */
export function valorRecambio(precioUnitario: number | string | null | undefined, cantidad: number | null | undefined): number | null {
  if (precioUnitario == null || precioUnitario === "") return null;
  const precio = Number(precioUnitario);
  if (!Number.isFinite(precio) || precio < 0) return null;
  const unidades = cantidad != null && cantidad > 0 ? cantidad : 1;
  return Math.round(precio * unidades * 100) / 100;
}

/** Id del origen "Recambio por vida útil" entre los activos; null si la organización lo renombró o lo dio de baja. */
export function origenRecambioId(origenes: readonly { id: string; nombre: string; activo: boolean }[]): string | null {
  return origenPorNombre(origenes, ORIGEN_RECAMBIO);
}

/** Primera etapa abierta del embudo (la de menor `orden`): donde nace la oportunidad de recambio. */
export function etapaInicialId(etapas: readonly { id: string; tipo: string; orden: number }[]): string | null {
  return [...etapas].filter((e) => e.tipo === "abierta").sort((a, b) => a.orden - b.orden)[0]?.id ?? null;
}

/**
 * Por cada equipo, la oportunidad ABIERTA que ya sale de él (id de la oportunidad). Una ganada o perdida
 * no cuenta: el equipo puede volver a necesitar recambio.
 */
export function abiertasPorItem(
  filas: readonly { id: string; venta_item_id: string | null; estado: string }[],
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const f of filas) {
    if (f.venta_item_id && f.estado === "abierta" && !mapa.has(f.venta_item_id)) mapa.set(f.venta_item_id, f.id);
  }
  return mapa;
}

/** La fila a insertar en `oportunidades`. Devuelve null si falta lo indispensable (equipo, empresa o etapa). */
export function oportunidadDeRecambio(args: {
  alerta: AlertaRecambio;
  precioUnitario: number | string | null | undefined;
  etapaId: string | null;
  origenId: string | null;
  responsableId: string;
}) {
  const { alerta, precioUnitario, etapaId, origenId, responsableId } = args;
  if (!alerta.venta_item_id || !alerta.empresa_id || !etapaId) return null;
  const notas = [
    alerta.fecha_entrega ? `Entregado el ${formatFecha(alerta.fecha_entrega)}` : null,
    alerta.vida_util_meses ? `vida útil de ${alerta.vida_util_meses} meses` : null,
    alerta.vence_el ? `vence el ${formatFecha(alerta.vence_el)}` : null,
  ].filter(Boolean);
  return {
    titulo: tituloRecambio(alerta.producto_nombre, alerta.empresa_nombre),
    empresa_id: alerta.empresa_id,
    contacto_id: alerta.contacto_id,
    producto_id: alerta.producto_id,
    monto: valorRecambio(precioUnitario, alerta.cantidad),
    origen_id: origenId,
    etapa_id: etapaId,
    responsable_id: responsableId,
    venta_item_id: alerta.venta_item_id,
    tipo: "directa" as const,
    notas: notas.length ? `Recambio por vida útil. ${notas.join(", ")}.` : "Recambio por vida útil.",
  };
}
