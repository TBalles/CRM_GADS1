/**
 * De lo que devuelve (o tira) el SDK a un mensaje en palabras para la persona (F7).
 *
 * Dos reglas:
 *  - Nunca sale hacia el navegador el mensaje del proveedor, la clave, un request id ni un stack: solo
 *    las frases de este archivo. El detalle técnico va al log del servidor (clase y status, nada más).
 *  - Cualquier falla termina igual para la pantalla: un aviso corto y la plantilla de siempre como camino.
 *
 * Importa el SDK solo por las clases de error (`instanceof`), así que se prueba con `node --test` usando
 * errores reales del SDK (errores.check.ts). Lo importa únicamente `generar.ts` (`server-only`): nada que llegue al navegador
 * puede importar este archivo (las frases que sí usa la pantalla están en `config.ts`, sin SDK).
 */
import Anthropic from "@anthropic-ai/sdk";
import { MAX_MENSAJE_BORRADOR, MENSAJES_IA } from "./config.ts";

export type ResultadoIA = { ok: true; texto: string } | { ok: false; motivo: string };

/** Un error del SDK (o cualquier otra cosa que se haya tirado) a la frase que se muestra. De lo más específico a lo más general. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof Anthropic.RateLimitError) return MENSAJES_IA.limite;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return MENSAJES_IA.configuracion;
  if (e instanceof Anthropic.APIConnectionTimeoutError) return MENSAJES_IA.demora;
  if (e instanceof Anthropic.APIConnectionError) return MENSAJES_IA.conexion;
  // 5xx, incluido el 529 "overloaded".
  if (e instanceof Anthropic.InternalServerError) return MENSAJES_IA.saturado;
  if (e instanceof Anthropic.APIError) return e.status === 529 ? MENSAJES_IA.saturado : MENSAJES_IA.generico;
  return MENSAJES_IA.generico;
}

/** Lo único que se registra en el log del servidor de una falla: la clase y el status. Nunca el mensaje ni el cuerpo. */
export function resumenParaLog(e: unknown): string {
  if (e instanceof Anthropic.APIError) return `${e.constructor.name} status=${e.status ?? "-"}`;
  return e instanceof Error ? e.constructor.name : typeof e;
}

/**
 * La respuesta de la API ya recibida (HTTP 200) a texto o a motivo. Hay que mirar `stop_reason` antes de
 * leer `content`: un `refusal` o un `max_tokens` no son un borrador utilizable. Tipo estructural (no
 * `Message`) para poder probarlo con objetos simples.
 */
export function interpretarRespuesta(r: {
  stop_reason: string | null;
  content: readonly { type: string; text?: string }[];
}): ResultadoIA {
  if (r.stop_reason === "refusal") return { ok: false, motivo: MENSAJES_IA.rechazo };
  if (r.stop_reason === "max_tokens") return { ok: false, motivo: MENSAJES_IA.cortado };
  if (r.stop_reason !== "end_turn" && r.stop_reason !== "stop_sequence") return { ok: false, motivo: MENSAJES_IA.generico };

  const texto = r.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n")
    .trim();
  if (!texto) return { ok: false, motivo: MENSAJES_IA.vacio };
  return { ok: true, texto: texto.slice(0, MAX_MENSAJE_BORRADOR) };
}
