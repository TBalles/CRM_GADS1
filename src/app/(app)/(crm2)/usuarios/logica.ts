// Import relativo y con extensión: este módulo se prueba con `node --test` (logica.check.ts) y Node no lee los alias
// "@/…" del tsconfig.
import { PERMISOS, conDependencias, type DefPermiso, type Permiso } from "../../../../lib/permisos.ts";

/** Lógica pura de Usuarios y roles (sin React): el estado de un usuario, los grupos de permisos y el tildado del rol. */

export type EstadoUsuario = "activo" | "pendiente" | "baja";

/** De baja (sin acceso) / invitación pendiente (todavía no eligió su contraseña) / activo. Mismo orden de siempre. */
export function estadoUsuario(u: { activo: boolean; activado_at: string | null }): EstadoUsuario {
  if (!u.activo) return "baja";
  if (!u.activado_at) return "pendiente";
  return "activo";
}

export const TEXTO_ESTADO: Record<EstadoUsuario, string> = {
  activo: "Activo",
  pendiente: "Invitación pendiente",
  baja: "De baja",
};

/** Los permisos del catálogo agrupados (Inicio, Clientes, …), en el orden del catálogo. */
export function gruposDePermisos(): [string, DefPermiso[]][] {
  const m = new Map<string, DefPermiso[]>();
  for (const p of PERMISOS) m.set(p.grupo, [...(m.get(p.grupo) ?? []), p]);
  return [...m.entries()];
}

/** Permisos que dependen (directa o indirectamente) de `p`. */
function dependientesDe(p: Permiso): Permiso[] {
  return PERMISOS.filter((x) => x.clave !== p && conDependencias([x.clave]).includes(p)).map((x) => x.clave);
}

/**
 * Tildar un permiso tilda lo que necesita; destildarlo destilda lo que depende de él. Así no se puede armar un rol que
 * no funcione (p. ej. "Registrar ventas" sin poder ver los clientes). El servidor aplica la misma regla al guardar.
 */
export function alternarPermiso(elegidos: ReadonlySet<Permiso>, p: Permiso): Set<Permiso> {
  if (elegidos.has(p)) {
    const next = new Set(elegidos);
    next.delete(p);
    for (const d of dependientesDe(p)) next.delete(d);
    return next;
  }
  return new Set(conDependencias([...elegidos, p]));
}

/**
 * Validación del formulario de rol, con los mensajes de siempre y en el mismo orden. `null` = está bien.
 * `esMiRol`: es el rol de quien edita, que no puede quitarse la gestión de usuarios.
 */
export function errorDeRol(nombre: string, elegidos: ReadonlySet<Permiso>, esMiRol: boolean): string | null {
  if (!nombre.trim()) return "Ponele un nombre al rol.";
  if (!elegidos.size) return "Elegí al menos un permiso.";
  if (esMiRol && !elegidos.has("usuarios.gestionar")) return "No podés quitarle a tu propio rol la gestión de usuarios.";
  return null;
}
