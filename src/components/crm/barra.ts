/**
 * Barras de dato de las tablas de los tableros (MASTER.md §10.21): la barra repite un número que YA está escrito en su
 * fila; nunca es la única forma de leerlo. Lógica pura (se prueba en `barra.check.ts`).
 */

/**
 * Ancho de la barra, en % del ancho de su columna: proporcional al mayor de la tabla (`max`). Un valor positivo nunca
 * queda invisible (piso de 2 %); cero, negativo o sin máximo: sin barra (antes el 0 dibujaba una raya de 2 %).
 */
export function anchoBarra(valor: number, max: number): number {
  if (!(valor > 0) || !(max > 0)) return 0;
  return Math.min(100, Math.max(2, (valor / max) * 100));
}

/** Parte sobre el total en % entero, como la leyenda de "Distribución del embudo" (2 de 15 → 13). Total 0 → 0. */
export function porcentajeDe(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}
