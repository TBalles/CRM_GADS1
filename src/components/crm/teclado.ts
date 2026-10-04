/**
 * Navegación por teclado de listas (menú, listbox, tabs, control segmentado): lo puro, sin React.
 * Sin imports: se prueba con `node --test` (teclado.check.ts).
 */

export type Paso = "next" | "prev" | "first" | "last";

/** La tecla de una lista vertical u horizontal -> el paso, o null si no es de navegación. */
export function pasoDeTecla(tecla: string, orientacion: "vertical" | "horizontal"): Paso | null {
  if (tecla === "Home") return "first";
  if (tecla === "End") return "last";
  if (orientacion === "vertical") return tecla === "ArrowDown" ? "next" : tecla === "ArrowUp" ? "prev" : null;
  return tecla === "ArrowRight" ? "next" : tecla === "ArrowLeft" ? "prev" : null;
}

/** Siguiente índice habilitado (con vuelta). -1 si no hay ninguno habilitado. */
export function moverIndice(
  actual: number,
  total: number,
  paso: Paso,
  deshabilitado: (i: number) => boolean = () => false,
): number {
  if (total === 0) return -1;
  const inicio = paso === "first" ? -1 : paso === "last" ? total : actual;
  const dir = paso === "next" || paso === "first" ? 1 : -1;
  for (let n = 1; n <= total; n++) {
    const i = (((inicio + dir * n) % total) + total) % total;
    if (!deshabilitado(i)) return i;
  }
  return -1;
}

/**
 * Búsqueda por tipeo (typeahead): el item cuya etiqueta empieza con `texto` (sin mayúsculas ni tildes), -1 si ninguno.
 * Con una letra busca desde el SIGUIENTE a `actual` (repetir la letra recorre los que empiezan igual); con varias
 * letras (el buffer de `acumularTipeo`) incluye el actual, así "c" → Córdoba y "co" se queda en Córdoba.
 */
export function buscarPorTexto(
  etiquetas: readonly string[],
  actual: number,
  texto: string,
  deshabilitado: (i: number) => boolean = () => false,
): number {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const buscado = norm(texto);
  if (!buscado) return -1;
  const desde = buscado.length > 1 ? 0 : 1;
  const base = desde === 0 ? Math.max(actual, 0) : actual;
  for (let n = desde; n < etiquetas.length + desde; n++) {
    const i = (((base + n) % etiquetas.length) + etiquetas.length) % etiquetas.length;
    if (!deshabilitado(i) && norm(etiquetas[i]).startsWith(buscado)) return i;
  }
  return -1;
}

/** Ventana del buffer de tipeo: letras con menos de esto entre sí forman una sola búsqueda ("cor"). */
export const TIPEO_MS = 500;

/** Suma una tecla al buffer de tipeo. Si pasó más de `TIPEO_MS` desde la anterior, empieza de nuevo. */
export function acumularTipeo(buffer: { texto: string; t: number }, tecla: string, ahora: number): { texto: string; t: number } {
  return { texto: ahora - buffer.t > TIPEO_MS ? tecla : buffer.texto + tecla, t: ahora };
}

/** Lo que `paradasDeTab` necesita saber de un enfocable: si es un radio, su `name` y si está marcado. */
export type InfoRadio = { name: string; checked: boolean } | null;

/**
 * Las paradas reales de Tab de una lista de enfocables: un grupo de radios (mismo `name`) es UNA parada, como en el
 * navegador: el marcado, o el primero si ninguno lo está. Sin esto, la trampa de foco de un drawer o popover
 * creía que el último enfocable era un radio al que Tab nunca llega.
 */
export function paradasDeTab<T>(items: readonly T[], radio: (item: T) => InfoRadio): T[] {
  const marcados = new Set<string>();
  for (const it of items) {
    const r = radio(it);
    if (r?.name && r.checked) marcados.add(r.name);
  }
  const vistos = new Set<string>();
  return items.filter((it) => {
    const r = radio(it);
    if (!r || !r.name) return true;
    if (marcados.has(r.name)) return r.checked;
    if (vistos.has(r.name)) return false;
    vistos.add(r.name);
    return true;
  });
}
