/**
 * Búsqueda global (Ctrl/Cmd+K): la lógica pura. Qué se puede buscar según el rol, cómo se
 * limpia lo que escribe la persona, cómo se ordenan y numeran los resultados para el teclado
 * y qué acciones rápidas se ofrecen.
 *
 * Los datos los trae UNA Server Action (`src/app/(app)/buscar/actions.ts`) con la sesión de la
 * persona: la RLS es lo que limita. Nada de esto autoriza nada, solo evita pedir lo que el rol
 * no puede ver.
 *
 * Imports relativos con extensión: se prueba con `node --test` (paleta.check.ts).
 */
import { rutasVisibles, type Ruta } from "./navegacion.ts";
import { textoParam } from "./paginacion.ts";
import type { Permiso } from "./permisos.ts";

export const MIN_CARACTERES = 2;
export const MAX_POR_GRUPO = 5;
/** Espera tras la última tecla antes de consultar. */
export const DEBOUNCE_MS = 200;

export type GrupoClave = "empresas" | "contactos" | "oportunidades" | "productos";

/** En el orden en que se muestran. */
export const GRUPOS: readonly { clave: GrupoClave; titulo: string; permiso: Permiso }[] = [
  { clave: "empresas", titulo: "Empresas", permiso: "clientes.ver" },
  { clave: "contactos", titulo: "Contactos", permiso: "clientes.ver" },
  { clave: "oportunidades", titulo: "Oportunidades", permiso: "oportunidades.ver" },
  { clave: "productos", titulo: "Productos", permiso: "productos.ver" },
];

/** Solo se busca en las tablas que el rol puede ver. */
export function gruposPermitidos(permisos: readonly string[]): GrupoClave[] {
  return GRUPOS.filter((g) => permisos.includes(g.permiso)).map((g) => g.clave);
}

/** El texto a buscar: sin caracteres de control, espacios colapsados y con tope. null si es muy corto. */
export function consultaBuscable(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const limpio = textoParam(texto);
  return limpio.length >= MIN_CARACTERES ? limpio : null;
}

export type Resultado = {
  id: string;
  titulo: string;
  detalle: string;
  href: string;
};

export type GrupoResultados = { clave: GrupoClave; titulo: string; resultados: Resultado[] };

export type RespuestaBusqueda = { ok: true; consulta: string; grupos: GrupoResultados[] } | { ok: false; error: string };

/**
 * Los grupos en su orden fijo, sin los vacíos y con tope por grupo. Lo que no se pidió (rol sin
 * permiso) simplemente no está.
 */
export function ordenarGrupos(crudos: Partial<Record<GrupoClave, readonly Resultado[]>>): GrupoResultados[] {
  return GRUPOS.flatMap((g) => {
    const resultados = (crudos[g.clave] ?? []).slice(0, MAX_POR_GRUPO);
    return resultados.length ? [{ clave: g.clave, titulo: g.titulo, resultados: [...resultados] }] : [];
  });
}

export type Accion = { id: string; titulo: string; detalle: string; href: string };

/** Qué acciones se ofrecen primero cuando la caja está vacía (el resto sigue en el orden del menú). */
const PRIORIDAD_ACCIONES = [
  "/oportunidades",
  "/empresas",
  "/alertas",
  "/contactos",
  "/ventas",
  "/productos",
  "/dashboard",
  "/tablero-comercial",
  "/embudo",
  "/usuarios",
  "/configuracion",
];

function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function aAccion(r: Ruta): Accion {
  return { id: `ir:${r.href}`, titulo: `Ir a ${r.label}`, detalle: r.pista, href: r.href };
}

/**
 * "Ir a …" para las pantallas que el rol puede abrir. Con la caja vacía salen todas, en orden de
 * uso; con texto, solo las que coinciden con el nombre de la pantalla (sin importar tildes ni
 * mayúsculas): primero las que empiezan con lo escrito, después las que lo contienen.
 */
export function accionesRapidas(permisos: readonly string[], texto = "", max = 8): Accion[] {
  const buscado = sinTildes(texto.trim());
  const rango = (r: Ruta) => {
    const i = PRIORIDAD_ACCIONES.indexOf(r.href);
    return i === -1 ? PRIORIDAD_ACCIONES.length : i;
  };
  return rutasVisibles(permisos)
    .map((r) => {
      const nombre = sinTildes(r.label);
      const coincide =
        buscado === "" || nombre.startsWith(buscado)
          ? 0
          : nombre.split(/\s+/).some((p) => p.startsWith(buscado))
            ? 1
            : nombre.includes(buscado)
              ? 2
              : -1;
      return { r, coincide };
    })
    .filter((x) => x.coincide !== -1)
    .sort((a, b) => a.coincide - b.coincide || rango(a.r) - rango(b.r))
    .slice(0, max)
    .map((x) => aAccion(x.r));
}

/** Una fila navegable del listbox: puede ser un resultado o una acción. */
export type Opcion = { id: string; titulo: string; detalle: string; href: string; grupo: string };

/**
 * Todo lo navegable con flechas, en el orden en que se ve: los grupos de resultados y después las
 * acciones. El índice de esta lista es el que lleva `aria-activedescendant`.
 */
export function aplanar(grupos: readonly GrupoResultados[], acciones: readonly Accion[]): Opcion[] {
  return [
    ...grupos.flatMap((g) => g.resultados.map((r) => ({ ...r, id: `${g.clave}:${r.id}`, grupo: g.titulo }))),
    ...acciones.map((a) => ({ ...a, grupo: "Ir a" })),
  ];
}

/** Siguiente índice con las flechas, dando la vuelta. Sin opciones, -1. */
export function moverIndice(actual: number, delta: 1 | -1, total: number): number {
  if (total <= 0) return -1;
  if (actual < 0 || actual >= total) return delta === 1 ? 0 : total - 1;
  return (actual + delta + total) % total;
}

/** Lo que dice la región viva: se anuncia, no se ve. */
export function anuncio(estado: "inactivo" | "cargando" | "error" | "listo", resultados: number): string {
  if (estado === "cargando") return "Buscando…";
  if (estado === "error") return "No se pudo buscar.";
  if (estado === "inactivo") return "";
  return resultados === 0 ? "Sin resultados" : resultados === 1 ? "1 resultado" : `${resultados} resultados`;
}
