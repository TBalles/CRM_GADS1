/**
 * Vocabulario compartido de empresas y contactos: estados, tipos de cliente,
 * nombres y la traduccion de errores de la base a mensajes que una persona
 * entiende. Las reglas en si viven en la base (CHECK, triggers, RLS); esto solo
 * las pone en palabras.
 *
 * Sin imports: este modulo se prueba con `node --test` (clientes.check.ts).
 */

/** Los cuatro estados del CHECK de empresas y contactos (0007). */
export const ESTADOS = [
  { value: "potencial", label: "Potencial", tono: "azul" },
  { value: "cliente", label: "Cliente", tono: "verde" },
  { value: "inactivo", label: "Inactivo", tono: "gris" },
  { value: "no_contactar", label: "No contactar", tono: "rojo" },
] as const;

export type EstadoCliente = (typeof ESTADOS)[number]["value"];

export function estadoInfo(valor: string) {
  return ESTADOS.find((e) => e.value === valor) ?? { value: valor, label: valor, tono: "gris" as const };
}

/** Dada de baja: inactivo (baja logica) o no_contactar. Se esconde de las listas salvo que se pida verla. */
export function estaDeBaja(estado: string): boolean {
  return estado === "inactivo" || estado === "no_contactar";
}

/** El CHECK `empresas_tipo_cliente_check` de la 0007. */
export const TIPOS_CLIENTE = [
  { value: "club", label: "Club" },
  { value: "complejo_f5", label: "Complejo de fútbol 5" },
  { value: "escuela_futbol", label: "Escuela de fútbol" },
  { value: "predio_municipal", label: "Predio municipal" },
  { value: "colegio", label: "Colegio" },
  { value: "otro", label: "Otro" },
] as const;

export function etiquetaTipoCliente(valor: string | null): string | null {
  if (!valor) return null;
  return TIPOS_CLIENTE.find((t) => t.value === valor)?.label ?? valor;
}

export function nombreCompleto(c: { nombre: string; apellido: string | null }): string {
  return `${c.nombre} ${c.apellido ?? ""}`.trim();
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Opciones de los selects de responsable y origen (las arma la pagina servidor). */
export type PerfilOpcion = { id: string; nombre: string; activo: boolean };
export type OrigenOpcion = { id: string; nombre: string; activo: boolean };

/**
 * Fecha y hora fijas en horario argentino: la pantalla se renderiza en el
 * servidor (UTC) y se hidrata en el navegador; con la zona del equipo los dos
 * mostrarian horas distintas.
 */
export function formatMomento(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Fecha (sin hora) de un timestamptz, en horario argentino: el "Alta" de las fichas. */
export function formatFechaAlta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** `2026-10-04` (columna date) -> `04/10/2026`, sin pasar por Date (evita el corrimiento de zona). */
export function formatFecha(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : ymd;
}

/** Link seguro para un sitio web ya validado: dominio pelado -> https://dominio. Otro esquema -> null. */
export function hrefSitioWeb(valor: string): string | null {
  const v = valor.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return /^[a-z][a-z0-9+.-]*:/i.test(v) ? null : `https://${v}`;
}

/**
 * Error de PostgREST/Postgres -> mensaje para la persona. Los que importan son
 * los que dispara una regla de la base (42501 permiso, 23514 CHECK o trigger,
 * 23503 FK); el resto cae en el mensaje generico de cada formulario.
 */
export function mensajeErrorGuardado(
  error: { code?: string; message?: string } | null | undefined,
  generico: string,
): string {
  if (!error) return generico;
  const msg = error.message ?? "";
  if (error.code === "42501") {
    if (/asignar|responsable/i.test(msg)) {
      return "No tenés permiso para asignar o reasignar el responsable. Dejá el que estaba y probá de nuevo.";
    }
    return "Tu rol no puede hacer este cambio. Pedile acceso a quien administra el CRM.";
  }
  if (error.code === "23514" && /responsable/i.test(msg)) {
    return "El responsable tiene que ser un usuario de tu organización.";
  }
  if (error.code === "23514" && /tipo_cliente/i.test(msg)) {
    return "Elegí uno de los tipos de cliente de la lista.";
  }
  if (error.code === "23503") {
    return "Algo de lo que elegiste (origen, responsable o empresa) ya no existe. Recargá la página y probá de nuevo.";
  }
  return generico;
}

/** Un id de la URL que no es un uuid ni llega a la base (evita un error de sintaxis de Postgres). */
export function esUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}
