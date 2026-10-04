import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

/**
 * Unico camino para cambiar la etapa de una oportunidad desde el navegador:
 * mover, cerrar (ganada o perdida) y reabrir. Llama a la RPC `cambiar_etapa`
 * (0007), que corre con la RLS de quien llama y deja la observacion en el
 * historial. El estado, la fecha de cierre y el motivo los resuelve el trigger
 * `oportunidades_reglas`; un `update({ etapa_id })` directo se saltearia la
 * observacion.
 */
export async function cambiarEtapa(args: {
  oportunidadId: string;
  etapaId: string;
  observacion?: string | null;
  motivoId?: string | null;
  /** `aaaa-mm-dd`; solo al cerrar. Sin fecha, la base usa hoy. */
  fechaCierre?: string | null;
}) {
  const { data, error } = await createClient().rpc("cambiar_etapa", {
    p_oportunidad: args.oportunidadId,
    p_etapa: args.etapaId,
    p_observacion: args.observacion?.trim() || undefined,
    p_motivo_perdida: args.motivoId || undefined,
    p_fecha_cierre: args.fechaCierre || undefined,
  });
  return { row: (data as Tables<"oportunidades"> | null) ?? null, error };
}
