/**
 * Lógica pura de Ventas (lista y formulario), sin React ni red: la prueba `logica.check.ts` con `node --test`.
 * Tipos ESTRUCTURALES (no `Tables<…>`): importar el tipo generado traería el alias "@/…" y Node no lo resuelve.
 */

type ItemVenta = { venta_id: string; cantidad: number; precio_unitario: number | null };

/** Los ítems de la página agrupados por venta, en el orden en que llegaron. */
export function agruparItems<T extends { venta_id: string }>(items: readonly T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const it of items) {
    const lista = mapa.get(it.venta_id);
    if (lista) lista.push(it);
    else mapa.set(it.venta_id, [it]);
  }
  return mapa;
}

/** Total de una venta: precio × cantidad de cada ítem (sin precio cuenta 0, como siempre). */
export function totalItems(items: readonly Pick<ItemVenta, "cantidad" | "precio_unitario">[]): number {
  return items.reduce((acc, it) => acc + (it.precio_unitario ?? 0) * it.cantidad, 0);
}

/** "1 ítem" / "3 ítems". */
export function textoItems(n: number): string {
  return `${n} ${n === 1 ? "ítem" : "ítems"}`;
}

/** Una línea del detalle mientras se edita en el formulario. */
export type LineaBorrador = { key: string; productoId: string; cantidad: string; precio: string; fechaEntrega: string };

/**
 * Al cambiar la fecha de la venta, las entregas que todavía la espejan la siguen (la entrega arranca en la fecha de la
 * venta; si no acompañara, una venta cargada con fecha pasada o futura dejaría entregas con la fecha de hoy y la alerta
 * de recambio caería cuando no corresponde). Las que se pusieron a mano no se tocan.
 */
export function espejarEntregas<T extends Pick<LineaBorrador, "fechaEntrega">>(lineas: readonly T[], vieja: string, nueva: string): T[] {
  return lineas.map((l) => (l.fechaEntrega === vieja ? { ...l, fechaEntrega: nueva } : l));
}

/**
 * Validación del detalle, con los mensajes de siempre: al menos un producto elegido y cantidades enteras > 0 (solo de
 * las líneas con producto: una línea vacía se ignora al guardar). `null` = está bien.
 */
export function errorDeLineas(lineas: readonly Pick<LineaBorrador, "productoId" | "cantidad">[]): string | null {
  const cargadas = lineas.filter((l) => l.productoId);
  if (!cargadas.length) return "Agregá al menos un producto.";
  if (cargadas.some((l) => !Number.isInteger(Number(l.cantidad)) || Number(l.cantidad) <= 0)) {
    return "Las cantidades tienen que ser números enteros mayores a 0.";
  }
  return null;
}

/**
 * aaaa-mm-dd de HOY en hora LOCAL. `toISOString()` da la fecha en UTC: en Argentina (UTC-3), desde las 21 ya es
 * "mañana" en UTC y una venta cargada a la noche quedaría con la fecha del día siguiente (la que arranca el reloj de la
 * vida útil). Se corre el instante por el offset local antes de recortarlo.
 */
export function hoyLocal(d = new Date()): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
