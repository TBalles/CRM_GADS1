/**
 * Ficha 360 (F5): "Historia de la cuenta" y "Resumen de la cuenta".
 *
 * Junta en una sola línea de tiempo lo que hoy vive en seis tablas: actividades,
 * cambios de etapa, altas de oportunidades, ventas (entregas) y avisos de recambio
 * enviados. Todo es puro y sin red: la página servidor trae las filas (acotadas) y
 * acá se ordenan, se filtran y se agrupan por mes en horario argentino.
 *
 * Las filas llegan con la forma de la base (`ocurrido_en`, `cambiado_en`, `fecha`...);
 * la salida solo lleva lo necesario para ordenar y dibujar: un `refId` que apunta a
 * la fila original, que la pantalla busca en su propio mapa.
 *
 * Imports relativos con extensión: este módulo se prueba con `node --test`
 * (timeline360.check.ts).
 */
import { diasEntre } from "./clientes.ts";
import { tituloCambioEtapa } from "./oportunidades.ts";

export const TIPOS_360 = ["actividad", "etapa", "oportunidad", "venta", "aviso"] as const;
export type Tipo360 = (typeof TIPOS_360)[number];

/** Los chips de la pantalla. "Etapas" incluye las altas de oportunidades: es todo lo del embudo. */
export const FILTROS_360 = ["todo", "actividades", "etapas", "ventas", "avisos"] as const;
export type Filtro360 = (typeof FILTROS_360)[number];

const FILTRO_DE_TIPO: Record<Tipo360, Exclude<Filtro360, "todo">> = {
  actividad: "actividades",
  etapa: "etapas",
  oportunidad: "etapas",
  venta: "ventas",
  aviso: "avisos",
};

/** Qué pasó primero cuando dos hechos caen en el mismo instante (menor número = va más arriba). */
const RANGO_TIPO: Record<Tipo360, number> = { aviso: 0, venta: 1, etapa: 2, oportunidad: 3, actividad: 4 };

export type Evento360 = {
  /** Único en la lista: `tipo:refId[:sub]`. */
  id: string;
  tipo: Tipo360;
  /** Instante ISO (UTC) del hecho. */
  cuando: string;
  /** Id de la fila original (actividad, cambio de etapa, oportunidad, venta o aviso). */
  refId: string;
  /** Solo `etapa`: cómo se llama el cambio ("Cierre", "Reapertura"...) y a qué resultado llegó. */
  titulo?: string;
  resultado?: "abierta" | "ganada" | "perdida";
  oportunidadId?: string;
};

export type ActividadEntrada = { id: string; ocurrido_en: string };
export type CambioEtapaEntrada = {
  id: string;
  oportunidad_id: string;
  etapa_anterior_id: string | null;
  etapa_nueva_id: string;
  cambiado_en: string;
  observacion: string | null;
};
export type OportunidadEntrada = { id: string; created_at: string; fecha_cierre: string | null };
export type VentaEntrada = { id: string; fecha: string };
export type AvisoEntrada = { id: string; enviado_at: string };

const ZONA = "America/Argentina/Buenos_Aires";

/** `aaaa-mm-dd` de un instante, en horario argentino (no el del servidor ni el del navegador). */
export function diaAR(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date(iso));
}

/** `aaaa-mm` de un instante, en horario argentino. */
export function mesAR(iso: string): string {
  return diaAR(iso).slice(0, 7);
}

/**
 * Una fecha sin hora (`ventas.fecha`, `fecha_cierre`) como instante: mediodía argentino.
 * Argentina no tiene horario de verano, así que el desfase es siempre -03:00; al mediodía
 * la fecha no se corre de día en ninguna zona razonable.
 */
export function instanteDeFecha(ymd: string): string {
  return new Date(`${ymd.slice(0, 10)}T12:00:00-03:00`).toISOString();
}

/** "septiembre de 2026" para `2026-09`. */
export function etiquetaMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, 15));
  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", month: "long", year: "numeric" }).format(f);
}

type TipoEtapa = "abierta" | "ganada" | "perdida";

function resultadoDe(tipo: string | undefined): TipoEtapa | undefined {
  return tipo === "abierta" || tipo === "ganada" || tipo === "perdida" ? tipo : undefined;
}

export type Fuentes360 = {
  actividades?: readonly ActividadEntrada[];
  cambios?: readonly CambioEtapaEntrada[];
  oportunidades?: readonly OportunidadEntrada[];
  ventas?: readonly VentaEntrada[];
  avisos?: readonly AvisoEntrada[];
  /** `id de etapa -> tipo` (abierta, ganada, perdida), para titular los cambios. */
  tipoDeEtapa?: ReadonlyMap<string, string>;
};

/**
 * Normaliza y ordena todo: lo más reciente arriba. A igual instante manda el rango del
 * tipo (un aviso o una entrega antes que la actividad) y, entre iguales, el orden de entrada
 * (el sort de JS es estable): el resultado no depende de en qué orden llegaron las fuentes.
 *
 * Cambios de etapa:
 *  - la fila inicial (sin etapa anterior) no es un cambio: el alta ya figura como
 *    "oportunidad" con su `created_at` real. Excepción: si esa fila inicial ya cae en una
 *    etapa de cierre (oportunidad creada o migrada cerrada) se muestra el cierre, con la
 *    fecha de cierre de la oportunidad si la hay;
 *  - el resto se titula con `tituloCambioEtapa` (Cambio de etapa, Cierre, Reapertura...).
 */
export function armarEventos360(f: Fuentes360): Evento360[] {
  const tipos = f.tipoDeEtapa ?? new Map<string, string>();
  const opPorId = new Map((f.oportunidades ?? []).map((o) => [o.id, o]));
  const eventos: Evento360[] = [];

  for (const a of f.actividades ?? []) {
    eventos.push({ id: `actividad:${a.id}`, tipo: "actividad", cuando: new Date(a.ocurrido_en).toISOString(), refId: a.id });
  }

  for (const o of f.oportunidades ?? []) {
    eventos.push({
      id: `oportunidad:${o.id}`,
      tipo: "oportunidad",
      cuando: new Date(o.created_at).toISOString(),
      refId: o.id,
      oportunidadId: o.id,
      titulo: "Oportunidad abierta",
    });
  }

  for (const c of f.cambios ?? []) {
    const nuevaTipo = tipos.get(c.etapa_nueva_id);
    if (!c.etapa_anterior_id) {
      if (nuevaTipo !== "ganada" && nuevaTipo !== "perdida") continue;
      const cierre = opPorId.get(c.oportunidad_id)?.fecha_cierre;
      eventos.push({
        id: `etapa:${c.id}`,
        tipo: "etapa",
        cuando: cierre ? instanteDeFecha(cierre) : new Date(c.cambiado_en).toISOString(),
        refId: c.id,
        oportunidadId: c.oportunidad_id,
        titulo: "Cierre",
        resultado: nuevaTipo,
      });
      continue;
    }
    eventos.push({
      id: `etapa:${c.id}`,
      tipo: "etapa",
      cuando: new Date(c.cambiado_en).toISOString(),
      refId: c.id,
      oportunidadId: c.oportunidad_id,
      titulo: tituloCambioEtapa({
        hayAnterior: true,
        anteriorTipo: tipos.get(c.etapa_anterior_id),
        nuevaTipo,
        observacion: c.observacion,
      }),
      resultado: resultadoDe(nuevaTipo),
    });
  }

  for (const v of f.ventas ?? []) {
    eventos.push({ id: `venta:${v.id}`, tipo: "venta", cuando: instanteDeFecha(v.fecha), refId: v.id });
  }

  for (const av of f.avisos ?? []) {
    eventos.push({ id: `aviso:${av.id}`, tipo: "aviso", cuando: new Date(av.enviado_at).toISOString(), refId: av.id });
  }

  return eventos.sort((a, b) => {
    const dif = Date.parse(b.cuando) - Date.parse(a.cuando);
    if (dif !== 0) return dif;
    return RANGO_TIPO[a.tipo] - RANGO_TIPO[b.tipo];
  });
}

/** Deja solo los eventos del chip elegido. "todo" los devuelve a todos. */
export function filtrarEventos<T extends { tipo: Tipo360 }>(eventos: readonly T[], filtro: Filtro360): T[] {
  if (filtro === "todo") return [...eventos];
  return eventos.filter((e) => FILTRO_DE_TIPO[e.tipo] === filtro);
}

/** Cuántos eventos hay por chip (el "todo" incluido), para mostrarlo junto al nombre. */
export function contarPorFiltro(eventos: readonly { tipo: Tipo360 }[]): Record<Filtro360, number> {
  const cuenta: Record<Filtro360, number> = { todo: eventos.length, actividades: 0, etapas: 0, ventas: 0, avisos: 0 };
  for (const e of eventos) cuenta[FILTRO_DE_TIPO[e.tipo]]++;
  return cuenta;
}

export type GrupoMes<T> = { mes: string; etiqueta: string; eventos: T[] };

/** Agrupa por mes calendario argentino, conservando el orden (el más reciente primero). */
export function agruparPorMes<T extends { cuando: string }>(eventos: readonly T[]): GrupoMes<T>[] {
  const grupos: GrupoMes<T>[] = [];
  for (const e of eventos) {
    const mes = mesAR(e.cuando);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.mes === mes) ultimo.eventos.push(e);
    else grupos.push({ mes, etiqueta: etiquetaMes(mes), eventos: [e] });
  }
  return grupos;
}

/** Cuántos eventos se muestran de entrada y cuántos más por cada "Ver más". */
export const TAMANIO_TRAMO_360 = 30;

/** Los primeros `visibles` eventos y si quedan más. */
export function tramo<T>(eventos: readonly T[], visibles: number): { items: T[]; quedan: number } {
  const n = Math.max(0, Math.floor(visibles));
  return { items: eventos.slice(0, n), quedan: Math.max(0, eventos.length - n) };
}

/* ------------------------------------------------------------------------ */
/* Resumen de la cuenta                                                      */
/* ------------------------------------------------------------------------ */

export type TonoContacto = "sin-datos" | "reciente" | "atencion" | "frio";

export type ResumenCuenta = {
  /** Fecha de la primera compra; null si todavía no compró. */
  primeraCompra: string | null;
  totalComprado: number;
  cantidadCompras: number;
  ultimaCompra: string | null;
  abiertas: { cantidad: number; valor: number };
  ultimoContacto: string | null;
  diasDesdeContacto: number | null;
  tonoContacto: TonoContacto;
};

/** Hasta cuántos días sin hablar se considera "reciente", y desde cuántos "frío". */
export const DIAS_CONTACTO_RECIENTE = 30;
export const DIAS_CONTACTO_FRIO = 90;

/**
 * Las cifras de arriba de la ficha, todas sacadas de las filas que ya se trajeron
 * (sin IA, sin estimaciones). `actividades` en `null` = el rol no puede ver la bitácora:
 * no se afirma nada sobre el contacto.
 */
export function resumenCuenta(input: {
  ventas: readonly { fecha: string; total: number }[];
  oportunidades: readonly { estado: string; monto: number | string | null }[];
  actividades: readonly { ocurrido_en: string }[] | null;
  hoy: string;
  /**
   * La primera compra de TODA la cuenta, si se la consultó aparte. Las ventas que llegan pueden ser solo
   * las más recientes (tope), y entonces la más vieja de ellas no es la primera.
   */
  primeraCompra?: string | null;
}): ResumenCuenta {
  const fechas = input.ventas.map((v) => v.fecha.slice(0, 10)).sort();
  const abiertas = input.oportunidades.filter((o) => o.estado === "abierta");

  let ultimoContacto: string | null = null;
  let diasDesdeContacto: number | null = null;
  let tonoContacto: TonoContacto = "sin-datos";
  if (input.actividades && input.actividades.length) {
    ultimoContacto = input.actividades.map((a) => diaAR(a.ocurrido_en)).sort().at(-1) ?? null;
    if (ultimoContacto) {
      diasDesdeContacto = Math.max(0, diasEntre(ultimoContacto, input.hoy));
      tonoContacto =
        diasDesdeContacto <= DIAS_CONTACTO_RECIENTE ? "reciente" : diasDesdeContacto <= DIAS_CONTACTO_FRIO ? "atencion" : "frio";
    }
  }

  return {
    primeraCompra: input.primeraCompra === undefined ? (fechas[0] ?? null) : input.primeraCompra,
    totalComprado: input.ventas.reduce((acc, v) => acc + (Number(v.total) || 0), 0),
    cantidadCompras: input.ventas.length,
    ultimaCompra: fechas.at(-1) ?? null,
    abiertas: { cantidad: abiertas.length, valor: abiertas.reduce((acc, o) => acc + (Number(o.monto) || 0), 0) },
    ultimoContacto,
    diasDesdeContacto,
    tonoContacto,
  };
}

/** La frase que acompaña los días sin contacto. Honesta: dice lo que se sabe, sin dramatizar. */
export function textoContacto(dias: number | null, tono: TonoContacto): string {
  if (dias === null) return tono === "sin-datos" ? "Sin contactos registrados" : "";
  if (dias === 0) return "Hoy";
  const hace = `Hace ${dias} ${dias === 1 ? "día" : "días"}`;
  if (tono === "reciente") return hace;
  if (tono === "atencion") return `${hace}: conviene retomar`;
  return `${hace}: la cuenta se enfrió`;
}
