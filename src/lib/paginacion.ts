/**
 * Paginación, búsqueda y filtros que viajan en la URL (F3).
 *
 * La URL es el estado de cada lista: `?q=&page=&pageSize=&estado=...`. La página
 * servidor lee los `searchParams`, consulta con `.range()` y la pantalla solo
 * dibuja. Este módulo reúne lo puro: leer parámetros sin confiar en ellos, hacer
 * las cuentas del rango, escapar el texto que escribe la persona para los
 * filtros de PostgREST y armar las URLs.
 *
 * La seguridad NO está acá: sigue siendo la RLS. Esto solo evita pedirle a la
 * base algo mal formado (un uuid que no es uuid, un `%` suelto, una coma que
 * rompe el `.or()`).
 *
 * Sin imports: se prueba con `node --test` (paginacion.check.ts).
 */

export type ParamsUrl = Record<string, string | string[] | undefined>;

/** Tamaños de página que se ofrecen. El primero que no esté acá cae al de por defecto. */
export const TAMANIOS_PAGINA = [10, 20, 50] as const;
export const TAMANIO_POR_DEFECTO = 20;
/** Tope del texto de búsqueda: más largo no es una búsqueda, es un pegado por error. */
export const MAX_BUSQUEDA = 100;
/** Tope de páginas: evita un `range` con números que desbordan. */
const MAX_PAGINA = 100_000;

/** El primer valor de un parámetro (la URL puede traer `?q=a&q=b`). */
function primero(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

/** Texto libre de la URL: sin caracteres de control, espacios colapsados, con tope. Vacío si no hay nada. */
export function textoParam(valor: string | string[] | undefined, max = MAX_BUSQUEDA): string {
  const limpio = primero(valor).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return limpio.slice(0, max).trim();
}

/** Un valor de una lista cerrada (estado, tipo...). Lo que no esté en la lista vale "". */
export function opcionParam<T extends string>(valor: string | string[] | undefined, permitidas: readonly T[]): T | "" {
  const v = primero(valor);
  return (permitidas as readonly string[]).includes(v) ? (v as T) : "";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un uuid válido o "": un id inventado en la URL no llega a la base (daría un error de sintaxis de Postgres). */
export function uuidParam(valor: string | string[] | undefined): string {
  const v = primero(valor);
  return UUID_RE.test(v) ? v.toLowerCase() : "";
}

/** `aaaa-mm-dd` que existe en el calendario (año 1900 a 2100), o "". Un `0002-01-15` tipeado a medias no es una fecha. */
export function fechaParam(valor: string | string[] | undefined): string {
  const v = primero(valor);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return "";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2100) return "";
  const f = new Date(Date.UTC(y, mo - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === mo - 1 && f.getUTCDate() === d ? v : "";
}

export type Paginacion = {
  page: number;
  pageSize: number;
  /** Índices para `.range(desde, hasta)` (ambos inclusivos). */
  desde: number;
  hasta: number;
};

/** Rango de filas de una página (base 0, inclusivo). */
export function rango(page: number, pageSize: number): { desde: number; hasta: number } {
  const desde = (page - 1) * pageSize;
  return { desde, hasta: desde + pageSize - 1 };
}

/** `?page=` y `?pageSize=` sin confiar en ellos: entero >= 1, y un tamaño de la lista o el de por defecto. */
export function leerPaginacion(params: ParamsUrl): Paginacion {
  const crudaPagina = primero(params.page);
  const pagina = /^\d{1,6}$/.test(crudaPagina) ? Number(crudaPagina) : 1;
  const page = Math.min(Math.max(pagina, 1), MAX_PAGINA);
  const crudoTamanio = Number(primero(params.pageSize));
  const pageSize = (TAMANIOS_PAGINA as readonly number[]).includes(crudoTamanio) ? crudoTamanio : TAMANIO_POR_DEFECTO;
  return { page, pageSize, ...rango(page, pageSize) };
}

/** Cuántas páginas hay. Siempre al menos una: una lista vacía sigue siendo la página 1. */
export function totalPaginas(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** "Mostrando 21–40 de 134". Sin filas: "Sin resultados". */
export function textoRango(page: number, pageSize: number, total: number): string {
  if (total <= 0) return "Sin resultados";
  const primera = (page - 1) * pageSize + 1;
  const ultima = Math.min(page * pageSize, total);
  if (primera > total) return `Mostrando 0 de ${total}`;
  return `Mostrando ${primera}–${ultima} de ${total}`;
}

/**
 * Los números de página a mostrar: la primera, la última y las vecinas de la
 * actual, con "…" donde se salta. Si el salto es de una sola página se muestra
 * esa página (un "…" que esconde un solo número no ahorra nada).
 */
export function ventanaPaginas(actual: number, total: number, vecinas = 1): Array<number | "…"> {
  if (total <= 1) return [1];
  const quiero = new Set<number>([1, total]);
  for (let n = actual - vecinas; n <= actual + vecinas; n++) if (n >= 1 && n <= total) quiero.add(n);
  const orden = [...quiero].sort((a, b) => a - b);
  const salida: Array<number | "…"> = [];
  for (let i = 0; i < orden.length; i++) {
    const n = orden[i];
    const previo = orden[i - 1];
    if (previo !== undefined) {
      if (n - previo === 2) salida.push(previo + 1);
      else if (n - previo > 2) salida.push("…");
    }
    salida.push(n);
  }
  return salida;
}

/* ---------------------------------------------------------------------------
   URL
   ------------------------------------------------------------------------ */

/** URLSearchParams, el ReadonlyURLSearchParams de Next, o el objeto plano de `searchParams` de una página. */
type FuenteParams = { get(clave: string): string | null; toString(): string } | ParamsUrl;

function aURLSearchParams(fuente: FuenteParams): URLSearchParams {
  if (typeof (fuente as URLSearchParams).get === "function") return new URLSearchParams(String(fuente));
  const salida = new URLSearchParams();
  for (const [clave, valor] of Object.entries(fuente as ParamsUrl)) {
    if (Array.isArray(valor)) valor.forEach((v) => salida.append(clave, v));
    else if (valor !== undefined) salida.set(clave, valor);
  }
  return salida;
}

/**
 * `ruta?...` con los parámetros actuales y los cambios aplicados. Un cambio a
 * `null` o "" borra el parámetro; `page=1` y `pageSize` por defecto tampoco se
 * escriben (la URL limpia es la de la primera página).
 */
export function urlConParams(ruta: string, actuales: FuenteParams, cambios: Record<string, string | null | undefined> = {}): string {
  const params = aURLSearchParams(actuales);
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor === null || valor === undefined || valor === "") params.delete(clave);
    else params.set(clave, valor);
  }
  if (params.get("page") === "1") params.delete("page");
  if (params.get("pageSize") === String(TAMANIO_POR_DEFECTO)) params.delete("pageSize");
  const qs = params.toString();
  return qs ? `${ruta}?${qs}` : ruta;
}

/* ---------------------------------------------------------------------------
   Búsqueda de texto (ILIKE) para PostgREST
   ------------------------------------------------------------------------ */

/**
 * Texto literal -> cuerpo de un patrón ILIKE. `\`, `%` y `_` son especiales en
 * ILIKE: sin escaparlos, buscar "100%" o "a_b" matchearía de más. El `*` que
 * escribe la persona se vuelve un comodín de un carácter, porque en el filtro de
 * PostgREST el `*` sin más es el `%` y no tiene escape.
 */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, "\\$&").replace(/\*/g, "_");
}

/** Valor entre comillas dobles para un filtro `.or()`: así las comas y paréntesis del texto no lo rompen. */
function entreComillas(valor: string): string {
  return `"${valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Una condición `columna ILIKE %texto%` para cada columna, unidas por coma: el
 * argumento de `.or()` de supabase-js. `extras` son condiciones ya armadas
 * (p. ej. `id.in.(...)`) que se suman al OR.
 *
 *   query.or(filtroOr(["nombre", "email"], "O'Brien, Juan (hijo)"))
 */
export function filtroOr(columnas: readonly string[], texto: string, extras: readonly string[] = []): string {
  const patron = entreComillas(`*${escaparLike(texto)}*`);
  return [...columnas.map((c) => `${c}.ilike.${patron}`), ...extras].join(",");
}

/** `id.in.(a,b)` para sumar al OR (los ids son uuids ya validados, sin caracteres reservados). */
export function condicionIn(columna: string, ids: readonly string[]): string[] {
  const validos = ids.filter((id) => UUID_RE.test(id));
  return validos.length ? [`${columna}.in.(${validos.join(",")})`] : [];
}

/** Palabras de una búsqueda (para exigir que cada una aparezca en alguna columna), con tope. */
export function terminos(texto: string, max = 4): string[] {
  return texto.split(/\s+/).filter(Boolean).slice(0, max);
}

/* ---------------------------------------------------------------------------
   Lectura de una página
   ------------------------------------------------------------------------ */

type Respuesta<T> = {
  data: T[] | null;
  count: number | null;
  error: { code?: string; message: string } | null;
};

export type PaginaLeida<T> = {
  filas: T[];
  total: number;
  /** Si pidieron una página que ya no existe (p. ej. borraron filas): la última real, para redirigir. */
  ultimaPagina?: number;
};

/**
 * Pide una página y resuelve los casos de borde:
 * - un error de la base se propaga (una lista vacía "de mentira" sería peor);
 * - una página fuera de rango (PostgREST responde 416 / `PGRST103`, o vuelve
 *   vacía) se cuenta aparte y se devuelve `ultimaPagina` para redirigir.
 *
 * `consultar` arma una consulta nueva cada vez (con `{ count: "exact" }`).
 */
export async function leerPagina<T>(
  consultar: (desde: number, hasta: number) => PromiseLike<Respuesta<T>>,
  p: Pick<Paginacion, "page" | "pageSize" | "desde" | "hasta">,
): Promise<PaginaLeida<T>> {
  const r = await consultar(p.desde, p.hasta);
  if (r.error && r.error.code !== "PGRST103") throw new Error(`No se pudo leer la lista: ${r.error.message}`);
  const filas = r.data ?? [];
  if (!r.error && (filas.length > 0 || p.page === 1)) return { filas, total: r.count ?? filas.length };

  // Página fuera de rango: ¿no hay nada o hay menos páginas?
  const cuenta = await consultar(0, 0);
  if (cuenta.error) throw new Error(`No se pudo leer la lista: ${cuenta.error.message}`);
  const total = cuenta.count ?? 0;
  return { filas: [], total, ultimaPagina: total > 0 ? totalPaginas(total, p.pageSize) : undefined };
}
