/**
 * Límite de llamadas por persona (F7): una ventana deslizante en memoria.
 *
 * ponytail: MEJOR ESFUERZO POR INSTANCIA. En Vercel cada instancia de la función tiene su propio Map y se
 * reinicia al reciclarse, así que el tope real puede ser mayor (instancias en paralelo) o resetearse. Alcanza
 * para frenar un clic repetido o un abuso casual y acotar el gasto de una cuenta; si hiciera falta un tope
 * duro, va una tabla en la base (o Redis) con el mismo contrato. El gasto real se corta además con el límite
 * mensual de la propia cuenta de la API.
 *
 * Sin imports: se prueba con `node --test` (limite.check.ts).
 */

export type ResultadoLimite = { ok: true } | { ok: false; reintentarEnSeg: number };

export function crearLimitador(max: number, ventanaMs: number, ahora: () => number = Date.now) {
  const llamadas = new Map<string, number[]>();
  /** Por encima de esto se barren las claves vencidas, para que el Map no crezca sin techo. */
  const BARRIDO_DESDE = 500;

  function vigentes(clave: string, t: number): number[] {
    const lista = (llamadas.get(clave) ?? []).filter((ts) => t - ts < ventanaMs);
    if (lista.length) llamadas.set(clave, lista);
    else llamadas.delete(clave);
    return lista;
  }

  return {
    /** Cuenta una llamada si hay cupo. Devuelve cuántos segundos esperar si no. */
    intentar(clave: string): ResultadoLimite {
      const t = ahora();
      if (llamadas.size > BARRIDO_DESDE) for (const k of [...llamadas.keys()]) vigentes(k, t);
      const lista = vigentes(clave, t);
      if (lista.length >= max) {
        return { ok: false, reintentarEnSeg: Math.max(1, Math.ceil((lista[0] + ventanaMs - t) / 1000)) };
      }
      lista.push(t);
      llamadas.set(clave, lista);
      return { ok: true };
    },
    /** Para las pruebas. */
    tamanio: () => llamadas.size,
  };
}

/** 10 borradores cada 10 minutos por persona. */
export const MAX_LLAMADAS = 10;
export const VENTANA_MS = 10 * 60 * 1000;
