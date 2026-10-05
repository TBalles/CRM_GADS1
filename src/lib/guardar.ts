/**
 * Guardar sin que un formulario quede trabado (drawers y diálogos de CRM 2.0 con `busy`).
 *
 * Los guardados manejan sus errores esperados (Supabase devuelve `{ error }`, las Server Actions `{ ok: false }`). Lo que
 * no manejan es que la llamada TIRE: red caída, Server Action abortada, un despliegue en curso. Si eso pasa entre
 * `setSaving(true)` y `setSaving(false)`, el drawer queda en "Guardando…" con Cancelar, Escape y la X deshabilitados para
 * siempre. `sinTrabarse` corre el guardado y, si tira, llama a `liberar` con un mensaje para mostrar (quien llama apaga
 * su `saving` y pone el mensaje en el banner del formulario). Devuelve si el guardado terminó sin tirar.
 *
 * Sin alias "@/…": se prueba con `node --test` (guardar.check.ts).
 */
export const ERROR_INESPERADO = "No se pudo completar la acción. Intentá de nuevo.";

export async function sinTrabarse(guardar: () => Promise<unknown>, liberar: (mensaje: string) => void): Promise<boolean> {
  try {
    await guardar();
    return true;
  } catch (e) {
    console.error("[guardar] el guardado tiró:", e);
    liberar(ERROR_INESPERADO);
    return false;
  }
}
