/**
 * Lógica pura del shell de CRM 2.0: la preferencia del rail (cookie) y las migas de pan (ruta → migas).
 * Sin React ni Next: se prueba con `node --test` (logica.check.ts). Imports relativos con extensión por eso mismo.
 */
import { rutaActual } from "../../../lib/navegacion.ts";

// ── Rail ────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * La preferencia de colapso del rail vive en una cookie (no en localStorage) para que el layout del servidor la lea
 * y el primer pintado ya salga bien: sin parpadeo y sin diferencia de hidratación. Es una preferencia de interfaz, no
 * un dato: no viaja a la base. Solo se aplica desde 1280 px (debajo el rail está siempre colapsado o es un cajón).
 */
export const RAIL_COOKIE = "crm-rail";
const UN_ANIO = 60 * 60 * 24 * 365;

/** Cualquier valor que no sea exactamente "collapsed" (ausente, manipulado) es "expandido": el default seguro. */
export function railColapsado(valor: string | undefined | null): boolean {
  return valor === "collapsed";
}

/** El `document.cookie` que guarda la preferencia (un año, todo el sitio, sin `Secure` para que ande en localhost). */
export function cookieRail(colapsado: boolean): string {
  return `${RAIL_COOKIE}=${colapsado ? "collapsed" : "expanded"}; Path=/; Max-Age=${UN_ANIO}; SameSite=Lax`;
}

// ── Migas de pan ────────────────────────────────────────────────────────────────────────────────────────────────
export type Miga = { label: string; href: string };

/** Pantallas que no están en el rail pero tienen nombre propio. */
const OTRAS: Record<string, string> = { "/sin-permisos": "Sin permisos", "/crm-lab": "Laboratorio" };
/** Secciones con ficha por id (`/empresas/[id]`). */
const CON_FICHA = new Set(["/empresas", "/contactos", "/oportunidades"]);
/** Subpáginas de una ficha (`/oportunidades/[id]/presupuesto`). */
const SUBPAGINAS: Record<string, string> = { presupuesto: "Presupuesto" };
/** El nombre de la ficha mientras la página no aporte el suyo (`<CrumbLabel>`), o si nunca lo aporta. */
export const FICHA = "Ficha";

const partes = (pathname: string) => pathname.split(/[?#]/)[0].split("/").filter(Boolean);

/** El href de la miga dinámica de una ruta (`/oportunidades/abc/presupuesto` → `/oportunidades/abc`), o null. */
export function fichaDe(pathname: string): string | null {
  const [base, id] = partes(pathname);
  return base && id && CON_FICHA.has(`/${base}`) ? `/${base}/${id}` : null;
}

/**
 * Las migas de una ruta. `etiquetas` trae los nombres que aportaron las páginas (href de la ficha → nombre); sin uno,
 * la ficha se llama "Ficha". Una ruta desconocida no tiene migas (el shell no inventa nombres).
 */
export function migas(pathname: string, etiquetas: Readonly<Record<string, string>> = {}): Miga[] {
  const [primera, id, sub] = partes(pathname);
  if (!primera) return [];
  const base = `/${primera}`;
  const label = rutaActual(base)?.label ?? OTRAS[base];
  if (!label) return [];
  const out: Miga[] = [{ label, href: base }];
  const ficha = fichaDe(pathname);
  if (ficha && id) {
    out.push({ label: etiquetas[ficha]?.trim() || FICHA, href: ficha });
    if (sub && SUBPAGINAS[sub]) out.push({ label: SUBPAGINAS[sub], href: `${ficha}/${sub}` });
  }
  return out;
}
