/**
 * Listas y fichas de CRM 2.0 (Empresas, Contactos, Productos): lo puro, sin React ni imports (se prueba con `node --test`,
 * seleccion.check.ts). Lo usan `Lista.tsx` (selección y foco de la grilla) y las páginas de ficha.
 *
 * La selección vive en la URL (`?sel=<id>`) y la tab de la ficha también (`?tab=`): esto solo decide a dónde se mueve
 * la selección con ↑/↓, qué tab vale y a qué fila va el foco cuando una acción saca la suya de la lista.
 */

/**
 * La fila a seleccionar con ↑ (`prev`) o ↓ (`next`), contada desde la fila CON FOCO (no desde el `sel` del servidor,
 * que puede venir atrasado mientras la navegación está en vuelo):
 * - si la fila con foco no es la seleccionada (`actual`, la selección que se VE, optimista), la flecha la elige a ella
 *   ("donde estoy");
 * - si ya lo es, pasa a la vecina; en el borde devuelve null (sin vuelta: la selección no cambia);
 * - sin foco en una fila, se cuenta desde `actual`, y si tampoco hay, la primera (↓) o la última (↑).
 * Lista vacía: null.
 */
export function vecinoSel(ids: readonly string[], actual: string | null, foco: string | null, paso: "next" | "prev"): string | null {
  if (ids.length === 0) return null;
  const desde = foco && ids.includes(foco) ? foco : actual && ids.includes(actual) ? actual : null;
  if (!desde) return paso === "next" ? ids[0] : ids[ids.length - 1];
  if (desde !== actual) return desde;
  const i = ids.indexOf(desde);
  const j = paso === "next" ? i + 1 : i - 1;
  return j >= 0 && j < ids.length ? ids[j] : null;
}

/** La tab pedida si existe para esta ficha (el rol puede no ver alguna); si no, la primera (Resumen). */
export function tabValida<T extends string>(pedida: string | string[] | undefined, disponibles: readonly T[]): T {
  const t = typeof pedida === "string" ? pedida : "";
  return (disponibles as readonly string[]).includes(t) ? (t as T) : disponibles[0];
}

/**
 * A qué fila llevar el foco cuando la lista vuelve del servidor después de una acción sobre `id` (dar de baja,
 * reactivar): `antes` y `despues` son los ids de la página antes y después. Si la fila sigue, ella misma; si salió (el
 * filtro de bajas, un estado elegido a mano), la siguiente de las de antes que siga en la lista, o si no hay, la anterior
 * más cercana; si no queda ninguna, null (el foco va al buscador). Se mira el resultado en vez de predecirlo: al
 * reactivar, la base decide si vuelve como Cliente o Potencial, y eso decide si sigue en un filtro por estado.
 */
export function filaTrasRefresco(antes: readonly string[], despues: readonly string[], id: string): string | null {
  if (despues.includes(id)) return id;
  const i = antes.indexOf(id);
  if (i < 0) return null;
  for (let j = i + 1; j < antes.length; j++) if (despues.includes(antes[j])) return antes[j];
  for (let j = i - 1; j >= 0; j--) if (despues.includes(antes[j])) return antes[j];
  return null;
}
