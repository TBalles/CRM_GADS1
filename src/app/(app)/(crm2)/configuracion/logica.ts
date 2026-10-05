/**
 * Lógica pura de Configuración (CRM 2.0, Lote F): las secciones por URL (`?s=`) y el renumerado de un catálogo al
 * subir/bajar una fila. Sin React ni alias "@/…": se prueba con `node --test` (logica.check.ts).
 */
import { tabValida } from "../../../../components/crm/seleccion.ts";

/** Las cinco secciones de siempre, en su orden. El slug es el id de la pestaña legacy (estable: deep links). */
export const SECCIONES = [
  { value: "empresa", label: "Datos de la empresa" },
  { value: "etapas", label: "Etapas" },
  { value: "tipos", label: "Tipos de actividad" },
  { value: "origenes", label: "Orígenes" },
  { value: "motivos", label: "Motivos de pérdida" },
] as const;
export type Seccion = (typeof SECCIONES)[number]["value"];
const VALORES = SECCIONES.map((s) => s.value);

/** La sección de `?s=`; ausente, repetida o desconocida = la primera ("Datos de la empresa"), como abría el legacy. */
export function seccionDe(param: string | string[] | null | undefined): Seccion {
  return tabValida(param ?? undefined, VALORES);
}

/** El link de una sección: la primera sin parámetro (`/configuracion`, la URL de siempre). */
export function hrefSeccion(s: Seccion): string {
  return s === VALORES[0] ? "/configuracion" : `/configuracion?s=${s}`;
}

/**
 * Subir (-1) o bajar (+1) la fila `id` de un catálogo ordenado: la lista nueva y solo las filas cuyo `orden` cambia al
 * renumerar 1..N (normalmente las dos que se cruzan). null si no se puede mover (no está, o ya está en el borde).
 * Es el mismo cálculo del legacy (CatalogoTab), sacado acá para probarlo.
 */
export function moverEnCatalogo<T extends { id: string; orden: number }>(
  lista: readonly T[],
  id: string,
  direccion: -1 | 1,
): { nueva: T[]; cambios: { item: T; orden: number }[] } | null {
  const desde = lista.findIndex((p) => p.id === id);
  const hasta = desde + direccion;
  if (desde < 0 || hasta < 0 || hasta >= lista.length) return null;
  const nueva = [...lista];
  [nueva[desde], nueva[hasta]] = [nueva[hasta], nueva[desde]];
  const cambios = nueva.map((item, i) => ({ item, orden: i + 1 })).filter(({ item, orden }) => item.orden !== orden);
  return { nueva, cambios };
}
