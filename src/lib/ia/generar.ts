import "server-only";
import { getCliente } from "./cliente";
import { admiteEffort, admiteFallback, iaDisponible, modeloIA } from "./config";
import { interpretarRespuesta, mensajeDeError, resumenParaLog, type ResultadoIA } from "./errores";

/**
 * La llamada a Claude (F7). Una sola, sin herramientas, sin streaming, sin historial: sistema + datos -> texto.
 *
 * Decisiones de la API (Claude Opus 5.5):
 *  - El pensamiento está siempre encendido y no se puede apagar: no se manda `thinking`. El costo se controla
 *    con `output_config.effort: "low"` (el predeterminado es medio). Sin temperature/top_p/top_k ni prefill.
 *  - `effort` solo se manda con los modelos que lo aceptan (`admiteEffort`); con otros se omite.
 *  - `max_tokens` cuenta también el pensamiento: 4000 deja holgura para un borrador de ~150 palabras.
 *  - Sin streaming: la respuesta es corta y queda muy por debajo del umbral en el que el SDK lo exige.
 *  - `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`): si los clasificadores de seguridad
 *    rechazan el pedido, la API lo reintenta sola con otro modelo en la misma llamada.
 *
 * Devuelve siempre `{ ok, texto } | { ok: false, motivo }`: nunca tira y nunca deja pasar el mensaje del proveedor.
 */
export async function generarBorrador(args: { sistema: string; usuario: string }): Promise<ResultadoIA> {
  if (!iaDisponible()) return { ok: false, motivo: "La IA no está activada en este servidor." };
  const modelo = modeloIA();
  try {
    const respuesta = await getCliente().beta.messages.create({
      model: modelo,
      max_tokens: 4000,
      ...(admiteEffort(modelo) ? { output_config: { effort: "low" as const } } : {}),
      system: args.sistema,
      messages: [{ role: "user", content: args.usuario }],
      ...(admiteFallback(modelo) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    return interpretarRespuesta(respuesta);
  } catch (e) {
    // Solo la clase y el status: ni el mensaje del proveedor, ni el cuerpo, ni los datos enviados.
    console.error(`[ia] la llamada falló: ${resumenParaLog(e)}`);
    return { ok: false, motivo: mensajeDeError(e) };
  }
}
