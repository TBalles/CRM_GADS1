/**
 * Las pantallas del CRM y qué permisos pide cada una: la única lista que usan el rail del shell
 * (`components/crm/shell`) y las acciones rápidas de la búsqueda global (`paleta.ts`).
 *
 * Es solo comodidad: la autorización real la hacen la base (RLS) y cada página con
 * `exigirPermiso`. Que una ruta aparezca acá no abre nada.
 *
 * Imports relativos con extensión: se prueba con `node --test` (paleta.check.ts, shell/logica.check.ts).
 */
import type { Permiso } from "./permisos.ts";

/** Las secciones del rail, en su orden. */
export const SECCIONES = ["Comercial", "Operación", "Análisis", "Administración"] as const;
export type Seccion = (typeof SECCIONES)[number];

export type Ruta = {
  href: string;
  label: string;
  /** Hacen falta TODOS. */
  permisos: readonly Permiso[];
  /** Bajo qué rótulo va en el rail. */
  seccion: Seccion;
  /** Una línea para la búsqueda global. */
  pista: string;
};

/** En el orden del rail. */
export const RUTAS: readonly Ruta[] = [
  { href: "/dashboard", label: "Inicio", permisos: ["tablero.ver"], seccion: "Comercial", pista: "Resumen comercial y valor en juego" },
  { href: "/oportunidades", label: "Oportunidades", permisos: ["oportunidades.ver"], seccion: "Comercial", pista: "El embudo comercial" },
  { href: "/empresas", label: "Empresas", permisos: ["clientes.ver"], seccion: "Comercial", pista: "Clubes, complejos y escuelas" },
  { href: "/contactos", label: "Contactos", permisos: ["clientes.ver"], seccion: "Comercial", pista: "Personas de cada cliente" },
  { href: "/productos", label: "Productos", permisos: ["productos.ver"], seccion: "Operación", pista: "Catálogo con vida útil" },
  { href: "/ventas", label: "Ventas", permisos: ["ventas.ver"], seccion: "Operación", pista: "Historial de entregas" },
  { href: "/alertas", label: "Alertas", permisos: ["alertas.ver"], seccion: "Operación", pista: "Recambios vencidos o por vencer" },
  {
    href: "/tablero-comercial",
    label: "Tablero comercial",
    permisos: ["clientes.ver_todos", "oportunidades.ver"],
    seccion: "Análisis",
    pista: "Pipeline por responsable y oportunidades quietas",
  },
  {
    href: "/embudo",
    label: "Conversión del embudo",
    permisos: ["oportunidades.ver", "clientes.ver_todos"],
    seccion: "Análisis",
    pista: "Cuántas pasan de etapa y cuánto tardan",
  },
  { href: "/usuarios", label: "Usuarios", permisos: ["usuarios.gestionar"], seccion: "Administración", pista: "Invitaciones y roles" },
  {
    href: "/configuracion",
    label: "Configuración",
    permisos: ["configuracion.gestionar"],
    seccion: "Administración",
    pista: "Etapas, catálogos y datos de la empresa",
  },
];

export function tieneTodos(permisos: readonly string[], requeridos: readonly string[]): boolean {
  return requeridos.every((p) => permisos.includes(p));
}

/** Las rutas que el rol puede abrir, en el orden del rail. */
export function rutasVisibles(permisos: readonly string[]): Ruta[] {
  return RUTAS.filter((r) => tieneTodos(permisos, r.permisos));
}

/** El rail del rol: las secciones en su orden, cada una con sus rutas visibles; una sección sin rutas no aparece. */
export function seccionesVisibles(permisos: readonly string[]): { titulo: Seccion; rutas: Ruta[] }[] {
  const visibles = rutasVisibles(permisos);
  return SECCIONES.map((titulo) => ({ titulo, rutas: visibles.filter((r) => r.seccion === titulo) })).filter(
    (s) => s.rutas.length > 0,
  );
}

/**
 * El rail del panel de plataforma (`/admin`, superadmin): una sola sección con una sola pantalla. Ninguna ruta del CRM
 * de un cliente (no tiene datos comerciales). El acceso lo decide `admin/layout.tsx` (`esSuperadmin`), no esta lista.
 */
export const SECCIONES_PLATAFORMA: { titulo: string; rutas: Pick<Ruta, "href" | "label">[] }[] = [
  { titulo: "Plataforma", rutas: [{ href: "/admin", label: "Clientes" }] },
];

/** La ruta del rail a la que pertenece un pathname (`/empresas/123` → Empresas), o undefined. */
export function rutaActual(pathname: string): Ruta | undefined {
  return RUTAS.find((r) => pathname === r.href || pathname.startsWith(`${r.href}/`));
}
