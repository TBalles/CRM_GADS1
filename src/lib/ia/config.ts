/**
 * Configuración de la IA asistida (F7). Sin imports y sin el SDK: lo pueden leer las páginas servidor
 * (para decidir si se muestran los botones) y los self-checks.
 *
 * La función es OPCIONAL y se apaga sola: sin `ANTHROPIC_API_KEY` en el servidor no hay botones, no hay
 * llamadas y el CRM anda igual que antes. La clave nunca viaja al navegador: a las pantallas cliente solo
 * llega el booleano que devuelve `iaDisponible()`.
 */

/** Modelo por defecto (id exacto, sin sufijo de fecha). Se cambia con `ANTHROPIC_MODEL`. */
export const MODELO_POR_DEFECTO = "claude-opus-5-5";

type Env = Record<string, string | undefined>;

export function iaDisponible(env: Env = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim());
}

export function modeloIA(env: Env = process.env): string {
  return env.ANTHROPIC_MODEL?.trim() || MODELO_POR_DEFECTO;
}

/**
 * Modelos con los que se pide el reintento del lado del servidor ante un rechazo de los clasificadores de
 * seguridad (`fallbacks: "default"`). Con otro modelo (por ejemplo uno más chico que puso quien despliega)
 * el parámetro no aplica y se omite, en vez de arriesgar un 400.
 */
const MODELOS_CON_FALLBACK = ["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"];

export function admiteFallback(modelo: string): boolean {
  return MODELOS_CON_FALLBACK.includes(modelo);
}

/**
 * UNA sola constante de largo para todo el circuito: lo máximo que se acepta de la IA, lo que cabe en el cuadro de texto
 * y lo máximo que el servidor registra como enviado. Así nunca se abre WhatsApp o el correo con un texto que después
 * el servidor se niegue a registrar.
 */
export const MAX_MENSAJE_BORRADOR = 2000;

/**
 * Frases que ve la persona cuando la IA no responde. Viven acá (sin SDK) y no en `errores.ts` para que las pantallas cliente
 * puedan usarlas sin arrastrar el SDK de Anthropic al navegador.
 */
export const MENSAJES_IA = {
  limite: "La IA está recibiendo muchas consultas ahora. Probá de nuevo en un minuto.",
  configuracion: "La IA no está disponible por un problema de configuración del servidor. Avisale a quien administra la plataforma.",
  conexion: "No pudimos conectar con la IA. Revisá tu conexión o probá de nuevo en un rato.",
  demora: "La IA tardó demasiado en responder. Probá de nuevo.",
  saturado: "El servicio de IA está saturado o con problemas. Probá de nuevo en unos minutos.",
  rechazo: "La IA no pudo redactar este texto. Escribilo a mano o usá la plantilla.",
  cortado: "El borrador salió cortado. Probá de nuevo.",
  vacio: "La IA no devolvió ningún texto. Probá de nuevo.",
  generico: "No pudimos generar el borrador con IA. Probá de nuevo en un rato.",
} as const;

/**
 * Modelos que aceptan `output_config.effort`. Con otro (Haiku 4.5, Sonnet 4.5, un id desconocido) la API respondería 400, así
 * que el parámetro se omite. En esos modelos no hay control de esfuerzo: el costo por llamada puede ser distinto del estimado.
 */
const MODELOS_CON_EFFORT = /^claude-(opus-(4-5|4-6|4-7|4-8|5|5-5)|sonnet-(4-6|5|5-5)|fable-5(-1)?|mythos-5(-1)?)$/;

export function admiteEffort(modelo: string): boolean {
  return MODELOS_CON_EFFORT.test(modelo);
}
