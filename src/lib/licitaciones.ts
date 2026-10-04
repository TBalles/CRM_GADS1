/**
 * Reglas puras de las licitaciones municipales (F4): el tipo de la oportunidad,
 * la validacion del formulario y la regla "no se gana antes de la apertura".
 *
 * La regla de verdad vive en la base (trigger `oportunidades_licitacion_regla`,
 * migracion 0011, con la fecha de Argentina); esto la pone en palabras y evita
 * pedirle a la base algo que sabemos que va a rechazar (la pantalla bloquea
 * "Marcar ganada" con el mismo mensaje).
 *
 * Imports relativos con extension: este modulo se prueba con `node --test`
 * (licitaciones.check.ts).
 */
import { diasEntre, formatFecha } from "./clientes.ts";
import { esFechaValida } from "./oportunidades.ts";

/** Los dos valores del CHECK `oportunidades_tipo_check` (0007). */
export const TIPOS_OPORTUNIDAD = [
  { value: "directa", label: "Directa" },
  { value: "licitacion", label: "Licitación municipal" },
] as const;

export type TipoOportunidad = (typeof TIPOS_OPORTUNIDAD)[number]["value"];

/** Lo que la pantalla sabe de la licitacion de una oportunidad para decidir si se puede ganar. */
export type DatosApertura = { fechaApertura: string | null };

/** Misma redaccion que el mensaje del trigger de la base, sin la fecha. */
export const MENSAJE_ANTES_DE_APERTURA = "No se puede marcar ganada antes de la apertura";

/**
 * Por que una licitacion NO se puede marcar ganada todavia, o `null` si se puede.
 *  - `undefined`: no es una licitacion (o las tablas del rubro no estan): no hay nada que bloquear;
 *  - `fechaApertura` nula: es una licitacion sin sus datos cargados (la base tambien la rechaza);
 *  - apertura posterior a hoy: todavia no abrio. El mismo dia de la apertura ya se puede.
 */
export function bloqueoGanada(licitacion: DatosApertura | null | undefined, hoy: string): string | null {
  if (!licitacion) return null;
  if (!licitacion.fechaApertura) {
    return "Cargá los datos de la licitación (al menos la fecha de apertura) antes de marcarla ganada.";
  }
  if (licitacion.fechaApertura > hoy) {
    return `${MENSAJE_ANTES_DE_APERTURA} (${formatFecha(licitacion.fechaApertura)}).`;
  }
  return null;
}

/** "Abre hoy", "Abre en 5 días", "Abrió hace 3 días" (para el detalle de la oportunidad). */
export function textoApertura(fechaApertura: string, hoy: string): string {
  const dias = diasEntre(hoy, fechaApertura);
  if (dias === 0) return "Abre hoy";
  if (dias === 1) return "Abre mañana";
  if (dias > 1) return `Abre en ${dias} días`;
  return dias === -1 ? "Abrió ayer" : `Abrió hace ${Math.abs(dias)} días`;
}

export type CamposLicitacion = {
  expediente: string;
  organismo: string;
  fechaApertura: string;
  /** Monto ya parseado (la pantalla usa `parseMoney`). */
  montoOficial: number | null;
  garantia: string;
};

export type ErroresLicitacion = Partial<Record<"organismo" | "fechaApertura" | "expediente" | "garantia" | "montoOficial", string>>;

const MAX_TEXTO = 200;
/** Tope de `monto_oficial numeric(14,2)`: 10^12. */
const MAX_MONTO = 1e12;

/** Validacion del bloque de licitacion del formulario de oportunidad. Organismo y apertura son obligatorios. */
export function validarLicitacion(c: CamposLicitacion): ErroresLicitacion {
  const e: ErroresLicitacion = {};
  if (!c.organismo.trim()) e.organismo = "Indicá el organismo que convoca.";
  else if (c.organismo.trim().length > MAX_TEXTO) e.organismo = `Máximo ${MAX_TEXTO} caracteres.`;
  if (c.expediente.trim().length > MAX_TEXTO) e.expediente = `Máximo ${MAX_TEXTO} caracteres.`;
  if (c.garantia.trim().length > MAX_TEXTO) e.garantia = `Máximo ${MAX_TEXTO} caracteres.`;
  if (!c.fechaApertura) e.fechaApertura = "La fecha de apertura es obligatoria: sin ella no se puede controlar cuándo se puede ganar.";
  else if (!esFechaValida(c.fechaApertura)) e.fechaApertura = "Indicá una fecha válida.";
  if (c.montoOficial != null) {
    // numeric(14,2) en la base: hasta 999.999.999.999,99.
    if (Number.isNaN(c.montoOficial)) e.montoOficial = "Ingresá un monto válido.";
    else if (c.montoOficial < 0) e.montoOficial = "El monto oficial no puede ser negativo.";
    else if (!(c.montoOficial < MAX_MONTO)) e.montoOficial = "El monto oficial es demasiado grande: revisá los ceros.";
  }
  return e;
}

/** Lo que se guarda en `licitaciones`, con los textos vacios como null. */
export function filaLicitacion(c: CamposLicitacion) {
  return {
    expediente: c.expediente.trim() || null,
    organismo: c.organismo.trim() || null,
    fecha_apertura: c.fechaApertura,
    monto_oficial: c.montoOficial,
    garantia: c.garantia.trim() || null,
  };
}

/**
 * Lo que `bloqueoGanada` necesita de una oportunidad: `undefined` si no es una licitación o las tablas del
 * rubro no están en la base; si lo es, la fecha de apertura (null = todavía sin datos cargados).
 */
export function datosApertura(
  tipo: string,
  tablasActivas: boolean,
  licitacion: { fecha_apertura: string } | null | undefined,
): DatosApertura | undefined {
  if (!tablasActivas || tipo !== "licitacion") return undefined;
  return { fechaApertura: licitacion?.fecha_apertura ?? null };
}
