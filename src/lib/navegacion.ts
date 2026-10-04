/**
 * Las pantallas del CRM y qué permisos pide cada una: la única lista que usan el menú lateral
 * (`AppShell`) y las acciones rápidas de la búsqueda global (`paleta.ts`).
 *
 * Es solo comodidad: la autorización real la hacen la base (RLS) y cada página con
 * `exigirPermiso`. Que una ruta aparezca acá no abre nada.
 *
 * Imports relativos con extensión: se prueba con `node --test` (paleta.check.ts).
 */
import type { Permiso } from "./permisos.ts";

export type Ruta = {
  href: string;
  label: string;
  /** Hacen falta TODOS. */
  permisos: readonly Permiso[];
  /** Las rutas con grupo se agrupan bajo ese rótulo en el menú. */
  grupo?: "Equipo";
  /** Una línea para la búsqueda global. */
  pista: string;
};

/** En el orden del menú lateral. */
export const RUTAS: readonly Ruta[] = [
  { href: "/dashboard", label: "Inicio", permisos: ["tablero.ver"], pista: "Resumen comercial y valor en juego" },
  { href: "/empresas", label: "Empresas", permisos: ["clientes.ver"], pista: "Clubes, complejos y escuelas" },
  { href: "/contactos", label: "Contactos", permisos: ["clientes.ver"], pista: "Personas de cada cliente" },
  { href: "/oportunidades", label: "Oportunidades", permisos: ["oportunidades.ver"], pista: "El embudo comercial" },
  { href: "/productos", label: "Productos", permisos: ["productos.ver"], pista: "Catálogo con vida útil" },
  { href: "/ventas", label: "Ventas", permisos: ["ventas.ver"], pista: "Historial de entregas" },
  { href: "/alertas", label: "Alertas", permisos: ["alertas.ver"], pista: "Recambios vencidos o por vencer" },
  {
    href: "/tablero-comercial",
    label: "Tablero comercial",
    permisos: ["clientes.ver_todos", "oportunidades.ver"],
    grupo: "Equipo",
    pista: "Pipeline por responsable y oportunidades quietas",
  },
  {
    href: "/embudo",
    label: "Conversión del embudo",
    permisos: ["oportunidades.ver", "clientes.ver_todos"],
    grupo: "Equipo",
    pista: "Cuántas pasan de etapa y cuánto tardan",
  },
  { href: "/usuarios", label: "Usuarios", permisos: ["usuarios.gestionar"], pista: "Invitaciones y roles" },
  { href: "/configuracion", label: "Configuración", permisos: ["configuracion.gestionar"], pista: "Etapas, catálogos y datos de la empresa" },
];

export function tieneTodos(permisos: readonly string[], requeridos: readonly string[]): boolean {
  return requeridos.every((p) => permisos.includes(p));
}

/** Las rutas que el rol puede abrir, en el orden del menú. */
export function rutasVisibles(permisos: readonly string[]): Ruta[] {
  return RUTAS.filter((r) => tieneTodos(permisos, r.permisos));
}
