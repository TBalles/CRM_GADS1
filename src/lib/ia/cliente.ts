import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Cliente de la API de Claude (F7): se crea una vez por instancia y solo en el servidor.
 *
 * Sin argumentos de credencial a propósito: el SDK lee `ANTHROPIC_API_KEY` del entorno. La clave no se
 * guarda, no se pasa por parámetro y no se loguea. `timeout` de 30 s y un reintento: son borradores cortos,
 * y si la API no responde la persona sigue con la plantilla en vez de esperar minutos.
 */
let cliente: Anthropic | null = null;

export function getCliente(): Anthropic {
  cliente ??= new Anthropic({ timeout: 30_000, maxRetries: 1 });
  return cliente;
}
