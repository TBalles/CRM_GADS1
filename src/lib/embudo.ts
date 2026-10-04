/**
 * Conversión del embudo (F5): cuántas oportunidades entraron a cada etapa, cuántas siguieron
 * adelante, cuánto se quedan y cómo terminan. Todo sale de `oportunidad_etapas_historial`
 * (cada cambio de etapa, con su fecha) y del estado actual de cada oportunidad.
 *
 * Funciones puras y sin red; la página servidor trae las filas y acá se cuentan. Las reglas
 * están escritas en `docs/reglas-de-negocio.md` (sección 12) y se explican en pantalla en
 * «Cómo se calcula».
 *
 * Imports relativos con extensión: este módulo se prueba con `node --test` (embudo.check.ts).
 */
import { diasEntre } from "./clientes.ts";
import { diaAR } from "./timeline360.ts";

export type EtapaEmbudo = { id: string; nombre: string; tipo: string; orden: number };

export type OportunidadEmbudo = {
  id: string;
  estado: string;
  etapa_id: string;
  created_at: string;
  fecha_cierre: string | null;
  origen_id: string | null;
};

export type CambioEmbudo = {
  oportunidad_id: string;
  etapa_nueva_id: string;
  cambiado_en: string;
};

/** `?origen=` con este valor = las oportunidades sin origen cargado. */
export const ORIGEN_SIN = "sin";

/**
 * La cohorte: las oportunidades que se DIERON DE ALTA entre `desde` y `hasta` (ambas
 * inclusive, fechas argentinas `aaaa-mm-dd`, cualquiera puede faltar) y, si se pide, de ese origen.
 * Las mide a todas hasta hoy: así el embudo responde "de las que entraron en ese período, qué pasó".
 */
export function filtrarCohorte<T extends Pick<OportunidadEmbudo, "created_at" | "origen_id">>(
  oportunidades: readonly T[],
  filtro: { desde?: string; hasta?: string; origen?: string },
): T[] {
  return oportunidades.filter((o) => {
    const dia = diaAR(o.created_at);
    if (filtro.desde && dia < filtro.desde) return false;
    if (filtro.hasta && dia > filtro.hasta) return false;
    if (filtro.origen === ORIGEN_SIN) return o.origen_id === null;
    if (filtro.origen) return o.origen_id === filtro.origen;
    return true;
  });
}

const MS_DIA = 86_400_000;

function redondear(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Mediana; null si no hay datos. */
export function mediana(valores: readonly number[]): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(v.length / 2);
  return v.length % 2 ? v[medio] : (v[medio - 1] + v[medio]) / 2;
}

export type FilaEtapa = {
  etapa: EtapaEmbudo;
  /** Oportunidades que pasaron alguna vez por la etapa (cada una cuenta una vez, aunque vuelva). */
  entraron: number;
  /** De esas, las que DESPUÉS de entrar llegaron a una etapa más adelante o a una ganada. */
  avanzaron: number;
  /** `avanzaron / entraron`, de 0 a 1; null si nadie entró. */
  conversion: number | null;
  /** Oportunidades abiertas que están en la etapa ahora (su estadía todavía no terminó). */
  enEtapaAhora: number;
  /** Estadías ya terminadas (una oportunidad que vuelve a la etapa suma otra). */
  estadias: number;
  /** Mediana de días de las estadías terminadas; null si no hay ninguna. */
  medianaDias: number | null;
  /** Lo mismo sumando las que siguen ahí, contadas "hasta hoy" (un piso: todavía no terminaron). */
  medianaHastaHoyDias: number | null;
};

export type ResultadoEmbudo = {
  etapas: FilaEtapa[];
  total: number;
  abiertas: number;
  ganadas: number;
  perdidas: number;
  /** ganadas / (ganadas + perdidas), de 0 a 1; null si todavía no se cerró ninguna. */
  tasaExito: number | null;
  /** Promedio de días del alta al cierre, solo de las ganadas / solo de las perdidas. */
  cicloGanadasDias: number | null;
  cicloPerdidasDias: number | null;
  /** Oportunidades sin una sola fila de historial (se supuso que están en su etapa actual desde el alta). */
  sinHistorial: number;
};

type Visita = { etapaId: string; entra: number; sale: number | null };

/**
 * Reglas (ver «Cómo se calcula»):
 *  - Una *visita* es una fila del historial: la oportunidad entra a esa etapa en ese instante y la
 *    deja en el instante de la fila siguiente. La última visita de una oportunidad abierta sigue en curso.
 *  - *Entró* a una etapa abierta: tiene al menos una visita. Saltarse una etapa no la cuenta.
 *  - *Avanzó* desde esa etapa: después de la PRIMERA vez que entró, visitó una etapa abierta de orden
 *    mayor o una etapa ganada. Perder no es avanzar; volver atrás tampoco.
 *  - Cada estadía terminada suma su duración (reaperturas incluidas). Las que siguen en curso van aparte
 *    como "hasta hoy" y nunca se mezclan con las terminadas en la cifra principal.
 *  - Éxito = ganadas / (ganadas + perdidas) por el ESTADO ACTUAL de cada oportunidad de la cohorte.
 *  - Ciclo = días del alta (fecha argentina) a la fecha real de cierre vigente.
 */
export function calcularEmbudo(input: {
  etapas: readonly EtapaEmbudo[];
  oportunidades: readonly OportunidadEmbudo[];
  cambios: readonly CambioEmbudo[];
  /** Instante de la medición (ISO): hasta cuándo se cuentan las estadías en curso. */
  ahora: string;
}): ResultadoEmbudo {
  const etapaPorId = new Map(input.etapas.map((e) => [e.id, e]));
  const abiertasOrden = input.etapas
    .filter((e) => e.tipo === "abierta")
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
  const ahora = Date.parse(input.ahora);

  const cambiosPorOp = new Map<string, CambioEmbudo[]>();
  for (const c of input.cambios) {
    const lista = cambiosPorOp.get(c.oportunidad_id);
    if (lista) lista.push(c);
    else cambiosPorOp.set(c.oportunidad_id, [c]);
  }

  const acumulado = new Map(
    abiertasOrden.map((e) => [e.id, { entraron: 0, avanzaron: 0, enAhora: 0, terminadas: [] as number[], enCurso: [] as number[] }]),
  );

  let sinHistorial = 0;
  const ciclos = { ganada: [] as number[], perdida: [] as number[] };
  const cuenta = { abierta: 0, ganada: 0, perdida: 0 };

  for (const o of input.oportunidades) {
    if (o.estado === "abierta" || o.estado === "ganada" || o.estado === "perdida") cuenta[o.estado] += 1;
    if ((o.estado === "ganada" || o.estado === "perdida") && o.fecha_cierre) {
      ciclos[o.estado].push(Math.max(0, diasEntre(diaAR(o.created_at), o.fecha_cierre.slice(0, 10))));
    }

    // sort estable: filas con el mismo instante conservan el orden en que llegaron.
    let filas = [...(cambiosPorOp.get(o.id) ?? [])].sort((a, b) => Date.parse(a.cambiado_en) - Date.parse(b.cambiado_en));
    if (!filas.length) {
      sinHistorial += 1;
      filas = [{ oportunidad_id: o.id, etapa_nueva_id: o.etapa_id, cambiado_en: o.created_at }];
    }
    const visitas: Visita[] = filas.map((f, i) => ({
      etapaId: f.etapa_nueva_id,
      entra: Date.parse(f.cambiado_en),
      sale: i + 1 < filas.length ? Date.parse(filas[i + 1].cambiado_en) : null,
    }));

    const yaEntro = new Set<string>();
    visitas.forEach((v, i) => {
      const acc = acumulado.get(v.etapaId);
      if (!acc) return; // etapa de cierre o desconocida
      const etapa = etapaPorId.get(v.etapaId)!;
      if (!yaEntro.has(v.etapaId)) {
        yaEntro.add(v.etapaId);
        acc.entraron += 1;
        const avanzo = visitas.slice(i + 1).some((siguiente) => {
          const destino = etapaPorId.get(siguiente.etapaId);
          return destino !== undefined && (destino.tipo === "ganada" || (destino.tipo === "abierta" && destino.orden > etapa.orden));
        });
        if (avanzo) acc.avanzaron += 1;
      }
      if (v.sale !== null) acc.terminadas.push((v.sale - v.entra) / MS_DIA);
      else if (o.estado === "abierta") {
        acc.enAhora += 1;
        acc.enCurso.push(Math.max(0, (ahora - v.entra) / MS_DIA));
      }
    });
  }

  const promedio = (v: number[]) => (v.length ? redondear(v.reduce((a, b) => a + b, 0) / v.length) : null);
  const cerradas = cuenta.ganada + cuenta.perdida;

  return {
    etapas: abiertasOrden.map((etapa) => {
      const a = acumulado.get(etapa.id)!;
      const completa = mediana(a.terminadas);
      const conAbiertas = mediana([...a.terminadas, ...a.enCurso]);
      return {
        etapa,
        entraron: a.entraron,
        avanzaron: a.avanzaron,
        conversion: a.entraron ? a.avanzaron / a.entraron : null,
        enEtapaAhora: a.enAhora,
        estadias: a.terminadas.length,
        medianaDias: completa === null ? null : redondear(completa),
        medianaHastaHoyDias: conAbiertas === null ? null : redondear(conAbiertas),
      };
    }),
    total: input.oportunidades.length,
    abiertas: cuenta.abierta,
    ganadas: cuenta.ganada,
    perdidas: cuenta.perdida,
    tasaExito: cerradas ? cuenta.ganada / cerradas : null,
    cicloGanadasDias: promedio(ciclos.ganada),
    cicloPerdidasDias: promedio(ciclos.perdida),
    sinHistorial,
  };
}

/** "1,5 días", "menos de 1 día", "—". */
export function formatDias(dias: number | null): string {
  if (dias === null) return "—";
  if (dias < 1) return "menos de 1 día";
  const n = redondear(dias);
  return `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })} ${n === 1 ? "día" : "días"}`;
}

/** 0,6667 -> "66,7%"; null -> "—". */
export function formatPorcentaje(razon: number | null): string {
  if (razon === null) return "—";
  return `${(Math.round(razon * 1000) / 10).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}
