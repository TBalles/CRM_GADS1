/**
 * Parque instalado: el equipamiento que una empresa nos compro, con la vida util
 * que le queda a cada ítem. Es la misma cuenta que hace la vista SQL
 * `alertas_vida_util` (0003), hecha en JS para TODOS los ítems y no solo los que
 * entran en la ventana de 60 días:
 *
 *   vence_el = fecha_entrega + vida_util_meses   (suma de meses como Postgres)
 *   dias     = vence_el - hoy
 *   vencido  si dias <= 0;  por_vencer si dias <= 60;  vigente si no.
 *
 * DIFERENCIA CONOCIDA con la vista: "hoy" es la fecha de Argentina (`hoyAR`), mientras que la vista usa
 * `current_date` del servidor de la base (UTC en Supabase). Entre las 21:00 y las 24:00 de Buenos Aires un equipo que
 * vence ese día puede figurar un día antes en /alertas que acá.
 *
 * Sin vida útil (o sin fecha de entrega) no hay seguimiento: el ítem cuenta como
 * equipo instalado pero no tiene reloj.
 *
 * La ventana de 60 días está repetida en la vista SQL, en `RelojRecambio` y acá
 * (ver docs/reglas-de-negocio.md, nota de la sección 1).
 *
 * Imports relativos con extensión: se prueba con `node --test` (parque.check.ts).
 */
import { diasEntre } from "./clientes.ts";

export const VENTANA_AVISO_DIAS = 60;

export type EstadoParque = "vencido" | "por_vencer" | "vigente" | "sin_seguimiento";

/** Un ítem de venta entregado a la empresa, con el nombre de su producto. */
export type ItemParque = {
  id: string;
  producto: string;
  categoria: string | null;
  cantidad: number;
  /** `aaaa-mm-dd` o null. */
  fechaEntrega: string | null;
  /** Snapshot copiado del catálogo al vender (0003). */
  vidaUtilMeses: number | null;
};

export type FilaParque = ItemParque & {
  venceEl: string | null;
  diasRestantes: number | null;
  estado: EstadoParque;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `fecha + N meses` como `date + make_interval(months => N)` de Postgres: si el día no existe
 * en el mes de llegada queda en el último (31/01 + 1 mes = 28/02, o 29/02 en bisiesto).
 */
export function sumarMeses(ymd: string, meses: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const total = m - 1 + meses;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, ultimo))}`;
}

export function filaParque(item: ItemParque, hoy: string): FilaParque {
  if (!item.fechaEntrega || !item.vidaUtilMeses) {
    return { ...item, venceEl: null, diasRestantes: null, estado: "sin_seguimiento" };
  }
  const venceEl = sumarMeses(item.fechaEntrega, item.vidaUtilMeses);
  const diasRestantes = diasEntre(hoy, venceEl);
  const estado: EstadoParque =
    diasRestantes <= 0 ? "vencido" : diasRestantes <= VENTANA_AVISO_DIAS ? "por_vencer" : "vigente";
  return { ...item, venceEl, diasRestantes, estado };
}

/** El orden en que se muestran los grupos: lo urgente primero. */
export const ORDEN_PARQUE: { estado: EstadoParque; titulo: string }[] = [
  // Con la misma regla que la vista (`vence_el <= hoy`), lo que vence hoy ya cuenta como vencido: el grupo lo dice.
  { estado: "vencido", titulo: "Vencidos o que vencen hoy" },
  { estado: "por_vencer", titulo: "Por vencer (60 días)" },
  { estado: "vigente", titulo: "Vigentes" },
  { estado: "sin_seguimiento", titulo: "Sin seguimiento de recambio" },
];

export type GrupoParque = { estado: EstadoParque; titulo: string; filas: FilaParque[]; unidades: number };

export function totalUnidades(filas: readonly { cantidad: number }[]): number {
  return filas.reduce((acc, f) => acc + f.cantidad, 0);
}

/** Agrupa por estado (solo los que tienen filas); dentro de cada grupo, lo que antes vence primero. */
export function agruparParque(items: readonly ItemParque[], hoy: string): GrupoParque[] {
  const filas = items.map((i) => filaParque(i, hoy));
  return ORDEN_PARQUE.flatMap(({ estado, titulo }) => {
    const delGrupo = filas
      .filter((f) => f.estado === estado)
      .sort((a, b) => (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0) || a.producto.localeCompare(b.producto));
    return delGrupo.length ? [{ estado, titulo, filas: delGrupo, unidades: totalUnidades(delGrupo) }] : [];
  });
}

/** "12 d", "5 meses": cuánto falta o cuánto pasó, en una unidad que se lee de un vistazo. */
function duracionCorta(dias: number): string {
  return dias <= VENTANA_AVISO_DIAS ? `${dias} d` : `${Math.round(dias / 30.4375)} meses`;
}

/** Lo que se dice de la vida útil de un ítem: "Venció hace 12 d", "Vence hoy", "Vence en 5 meses", "Sin seguimiento". */
export function textoVidaUtil(f: Pick<FilaParque, "estado" | "diasRestantes">): string {
  if (f.diasRestantes == null) return "Sin seguimiento de recambio";
  if (f.diasRestantes === 0) return "Vence hoy";
  return f.diasRestantes < 0 ? `Venció hace ${duracionCorta(-f.diasRestantes)}` : `Vence en ${duracionCorta(f.diasRestantes)}`;
}
