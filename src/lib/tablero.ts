/**
 * Tablero del responsable (F5): las cuentas que hacen las tres tarjetas de `/tablero-comercial`.
 *
 * La página servidor trae conjuntos acotados (oportunidades abiertas, cierres del mes,
 * actividades recientes) y agrega acá, en JS: funciones puras, sin red, con fechas en horario
 * argentino (`aaaa-mm-dd`, sin pasar por la zona del servidor).
 *
 * Imports relativos con extensión: este módulo se prueba con `node --test` (tablero.check.ts).
 */
import { diasEntre } from "./clientes.ts";
import { diaAR, etiquetaMes } from "./timeline360.ts";

/* ------------------------------------------------------------------------ */
/* Parámetros de la URL                                                      */
/* ------------------------------------------------------------------------ */

export const OPCIONES_DIAS = [7, 14, 30] as const;
export type DiasSinActividad = (typeof OPCIONES_DIAS)[number];
export const DIAS_POR_DEFECTO: DiasSinActividad = 14;

/** `?dias=` sin confiar en la URL: 7, 14 o 30; cualquier otra cosa vale 14. */
export function diasParam(valor: string | string[] | undefined): DiasSinActividad {
  const v = Number(Array.isArray(valor) ? valor[0] : valor);
  return (OPCIONES_DIAS as readonly number[]).includes(v) ? (v as DiasSinActividad) : DIAS_POR_DEFECTO;
}

/** Suma (o resta) días a una fecha `aaaa-mm-dd` sin pasar por la zona horaria. */
export function sumarDias(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** `?mes=aaaa-mm` sin confiar en la URL: un mes real entre 2000 y 2100, o el mes de `hoy`. */
export function mesParam(valor: string | string[] | undefined, hoy: string): string {
  const v = (Array.isArray(valor) ? valor[0] : valor) ?? "";
  const m = MES_RE.exec(v);
  if (m && Number(m[1]) >= 2000 && Number(m[1]) <= 2100) return v;
  return hoy.slice(0, 7);
}

/** Primer día del mes y primer día del mes siguiente (el límite superior es exclusivo). */
export function rangoMes(mes: string): { desde: string; hasta: string } {
  const [y, m] = mes.split("-").map(Number);
  const siguiente = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { desde: `${mes}-01`, hasta: `${siguiente}-01` };
}

export type OpcionMes = { value: string; label: string };

/** Los últimos `cantidad` meses hasta el de `hoy`, el más reciente primero; `elegido` entra siempre aunque sea más viejo. */
export function mesesDisponibles(hoy: string, elegido: string, cantidad = 12): OpcionMes[] {
  const [y, m] = hoy.split("-").map(Number);
  const meses: string[] = [];
  for (let i = 0; i < cantidad; i++) {
    const f = new Date(Date.UTC(y, m - 1 - i, 1));
    meses.push(`${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  if (!meses.includes(elegido)) meses.push(elegido);
  return meses.map((value) => ({ value, label: etiquetaMes(value) }));
}

/* ------------------------------------------------------------------------ */
/* Oportunidades abiertas sin actividad                                      */
/* ------------------------------------------------------------------------ */

/** Cuántos días hacia atrás se leen las actividades: más que el mayor `?dias=`, para poder decir hace cuánto. */
export const VENTANA_ACTIVIDADES_DIAS = 120;

/**
 * Desde qué fecha se conocen TODAS las actividades. Normalmente es el borde de la ventana; si la
 * lectura se cortó en el tope (`truncada`) solo se conoce desde la más vieja que llegó.
 */
export function coberturaActividades(hoy: string, truncada: boolean, masViejaLeida: string | null): string {
  const borde = sumarDias(hoy, -VENTANA_ACTIVIDADES_DIAS);
  return truncada && masViejaLeida && masViejaLeida > borde ? masViejaLeida : borde;
}

export type OportunidadAbierta = {
  id: string;
  titulo: string;
  monto: number | string | null;
  responsable_id: string | null;
  empresa_id: string | null;
  contacto_id: string | null;
  created_at: string;
};

export type ActividadReciente = {
  oportunidad_id: string | null;
  empresa_id: string | null;
  contacto_id: string | null;
  ocurrido_en: string;
};

/** De dónde sale la última actividad de la fila: de la oportunidad, de su cliente, o del alta (no hubo ninguna). */
export type BaseActividad = "oportunidad" | "cliente" | "alta";

export type OportunidadSinActividad = {
  id: string;
  titulo: string;
  responsableId: string | null;
  monto: number;
  /** Días enteros desde la última actividad (o desde el alta). */
  dias: number;
  /** Fecha de esa última actividad, `aaaa-mm-dd`. */
  ultima: string;
  base: BaseActividad;
  /** `true` si no hay actividad en lo que se leyó y la oportunidad es más vieja: `dias` es un piso ("más de N"). */
  masDe: boolean;
  /**
   * `true` si NO se puede afirmar que esté quieta: no hay actividad en lo leído, es anterior a lo leído, y lo leído
   * (cortado en el tope) no llega tan atrás como el umbral. Se lista aparte en vez de descartarla en silencio.
   */
  incierta: boolean;
};

/**
 * Oportunidades abiertas sin actividad hace `umbral` días o más (el día `umbral` ya cuenta).
 *
 * "Actividad" = una entrada de la bitácora de la propia oportunidad o de su empresa o contacto.
 * Los cambios de etapa NO cuentan. Si nunca hubo, se cuenta desde el alta. La más estancada primero;
 * a igual cantidad de días, la de más valor. Las que no se pueden afirmar (`incierta`) van al final.
 */
export function sinActividad(
  oportunidades: readonly OportunidadAbierta[],
  actividades: readonly ActividadReciente[],
  hoy: string,
  umbral: number,
  desdeCobertura: string,
): OportunidadSinActividad[] {
  const ultimaPor = { op: new Map<string, string>(), emp: new Map<string, string>(), con: new Map<string, string>() };
  const registrar = (mapa: Map<string, string>, clave: string | null, dia: string) => {
    if (clave && (mapa.get(clave) ?? "") < dia) mapa.set(clave, dia);
  };
  for (const a of actividades) {
    const dia = diaAR(a.ocurrido_en);
    registrar(ultimaPor.op, a.oportunidad_id, dia);
    registrar(ultimaPor.emp, a.empresa_id, dia);
    registrar(ultimaPor.con, a.contacto_id, dia);
  }

  const filas: OportunidadSinActividad[] = [];
  for (const o of oportunidades) {
    let mejor = { fecha: diaAR(o.created_at), base: "alta" as BaseActividad };
    const candidatas: [string | undefined, BaseActividad][] = [
      [ultimaPor.op.get(o.id), "oportunidad"],
      [o.empresa_id ? ultimaPor.emp.get(o.empresa_id) : undefined, "cliente"],
      [o.contacto_id ? ultimaPor.con.get(o.contacto_id) : undefined, "cliente"],
    ];
    for (const [fecha, base] of candidatas) {
      if (fecha && (fecha > mejor.fecha || (fecha === mejor.fecha && mejor.base === "alta"))) mejor = { fecha, base };
    }

    let masDe = false;
    if (mejor.base === "alta" && mejor.fecha < desdeCobertura) {
      mejor = { ...mejor, fecha: desdeCobertura };
      masDe = true;
    }
    const dias = Math.max(0, diasEntre(mejor.fecha, hoy));
    // Con "más de": si el piso ya llega al umbral está quieta; si no, no se sabe (la lectura se cortó antes).
    const incierta = masDe && dias < umbral;
    if (dias < umbral && !incierta) continue;
    filas.push({
      id: o.id,
      titulo: o.titulo,
      responsableId: o.responsable_id,
      monto: Number(o.monto) || 0,
      dias,
      ultima: mejor.fecha,
      base: mejor.base,
      masDe,
      incierta,
    });
  }
  return filas.sort((a, b) => Number(a.incierta) - Number(b.incierta) || b.dias - a.dias || b.monto - a.monto || a.titulo.localeCompare(b.titulo) || a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------------------ */
/* Pipeline por vendedor                                                     */
/* ------------------------------------------------------------------------ */

export type FilaResponsable = { key: string; label: string; cantidad: number; monto: number };

export const SIN_RESPONSABLE = "sin-responsable";

/** Abiertas agrupadas por responsable: más valor primero. Sin responsable (o uno que ya no se ve) queda aparte. */
export function pipelinePorResponsable(
  abiertas: readonly { responsable_id: string | null; monto: number | string | null }[],
  nombrePorId: ReadonlyMap<string, string>,
): FilaResponsable[] {
  const grupos = new Map<string, FilaResponsable>();
  for (const o of abiertas) {
    const nombre = o.responsable_id ? nombrePorId.get(o.responsable_id) : undefined;
    const key = nombre ? o.responsable_id! : SIN_RESPONSABLE;
    const g = grupos.get(key) ?? { key, label: nombre ?? "Sin responsable", cantidad: 0, monto: 0 };
    g.cantidad += 1;
    g.monto += Number(o.monto) || 0;
    grupos.set(key, g);
  }
  return [...grupos.values()].sort((a, b) => b.monto - a.monto || b.cantidad - a.cantidad || a.label.localeCompare(b.label));
}

/* ------------------------------------------------------------------------ */
/* Cierres del mes y motivos de pérdida                                      */
/* ------------------------------------------------------------------------ */

export type Cierres = {
  ganadas: { cantidad: number; monto: number };
  perdidas: { cantidad: number; monto: number };
};

export function resumenCierres(cerradas: readonly { estado: string; monto: number | string | null }[]): Cierres {
  const r: Cierres = { ganadas: { cantidad: 0, monto: 0 }, perdidas: { cantidad: 0, monto: 0 } };
  for (const o of cerradas) {
    const destino = o.estado === "ganada" ? r.ganadas : o.estado === "perdida" ? r.perdidas : null;
    if (!destino) continue;
    destino.cantidad += 1;
    destino.monto += Number(o.monto) || 0;
  }
  return r;
}

export type FilaMotivo = { key: string; label: string; cantidad: number; monto: number };

export const SIN_MOTIVO = "sin-motivo";

/** Por qué se perdió, de más a menos frecuente (a igual cantidad, el de más valor). */
export function rankingMotivos(
  perdidas: readonly { motivo_perdida_id: string | null; monto: number | string | null }[],
  nombrePorId: ReadonlyMap<string, string>,
): FilaMotivo[] {
  const grupos = new Map<string, FilaMotivo>();
  for (const o of perdidas) {
    const nombre = o.motivo_perdida_id ? nombrePorId.get(o.motivo_perdida_id) : undefined;
    const key = nombre ? o.motivo_perdida_id! : SIN_MOTIVO;
    const g = grupos.get(key) ?? { key, label: nombre ?? "Sin motivo cargado", cantidad: 0, monto: 0 };
    g.cantidad += 1;
    g.monto += Number(o.monto) || 0;
    grupos.set(key, g);
  }
  return [...grupos.values()].sort((a, b) => b.cantidad - a.cantidad || b.monto - a.monto || a.label.localeCompare(b.label));
}
