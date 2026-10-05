/**
 * Lógica pura de la pantalla de Alertas (filtros, contadores y el texto del vencimiento), sin React:
 * la prueba `logica.check.ts` con `node --test`. Tipo ESTRUCTURAL (no `Tables<"alertas_vida_util">`): el tipo generado
 * traería el alias "@/…", que Node no resuelve.
 */

export type FilaFiltrable = {
  estado: string | null;
  ultimo_envio: string | null;
  empresa_nombre: string | null;
  producto_nombre: string | null;
  contacto_nombre: string | null;
};

export type FiltroAlertas = "todas" | "vencido" | "por_vencer" | "sin_avisar";

export const FILTROS_ALERTAS: { value: FiltroAlertas; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "vencido", label: "Vencidas" },
  { value: "por_vencer", label: "Por vencer" },
  { value: "sin_avisar", label: "Sin avisar" },
];

/** Cuántas hay en cada grupo (los contadores que mostraba el marcador; ahora van en los segmentos del filtro). */
export function contarAlertas(alertas: readonly FilaFiltrable[]): Record<FiltroAlertas, number> {
  return {
    todas: alertas.length,
    vencido: alertas.filter((a) => a.estado === "vencido").length,
    por_vencer: alertas.filter((a) => a.estado === "por_vencer").length,
    sin_avisar: alertas.filter((a) => !a.ultimo_envio).length,
  };
}

/** El filtro y la búsqueda de siempre (en el cliente: la vista ya trae todas). Busca en cliente, producto y contacto. */
export function filtrarAlertas<T extends FilaFiltrable>(alertas: readonly T[], filtro: FiltroAlertas, query: string): T[] {
  const q = query.trim().toLowerCase();
  return alertas.filter((a) => {
    if (filtro === "vencido" && a.estado !== "vencido") return false;
    if (filtro === "por_vencer" && a.estado !== "por_vencer") return false;
    if (filtro === "sin_avisar" && a.ultimo_envio) return false;
    if (!q) return true;
    return `${a.empresa_nombre ?? ""} ${a.producto_nombre ?? ""} ${a.contacto_nombre ?? ""}`.toLowerCase().includes(q);
  });
}

/** "Vence hoy" / "Vencido hace 72 d" / "Vence en 20 d": el mismo texto de la pastilla de antes. */
export function textoVencimiento(dias: number, vencida: boolean): string {
  return dias === 0 ? "Vence hoy" : vencida ? `Vencido hace ${Math.abs(dias)} d` : `Vence en ${dias} d`;
}
