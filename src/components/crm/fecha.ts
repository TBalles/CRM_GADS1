/**
 * Lógica pura del DatePicker de CRM 2.0 (MASTER.md §10.15). Sin React ni DOM: la prueba `fecha.check.ts`.
 *
 * Contrato de valores (el mismo de los inputs nativos, así validadores y payloads no cambian):
 * - fecha: "YYYY-MM-DD" (como `type="date"`); vacío = "".
 * - fecha y hora: "YYYY-MM-DDTHH:mm" en hora LOCAL (como `type="datetime-local"`); vacío = "".
 *
 * Sin trampas de UTC: nunca `new Date("YYYY-MM-DD")` (se lee como UTC y en Argentina da el día anterior). La aritmética
 * de días usa `Date.UTC` + `getUTC*` de punta a punta (sin horario de verano en el medio); "hoy" sale de la hora local.
 * Nombres de meses y días escritos a mano: no dependen del ICU de Node ni del navegador.
 */

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;
export const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"] as const;
/** La semana arranca el lunes (es-AR). */
export const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;
export const DIAS_CORTOS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"] as const;

type Ymd = { y: number; m: number; d: number };

const p2 = (n: number) => String(n).padStart(2, "0");

export const esBisiesto = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Días del mes `m` (1–12). */
export function diasDelMes(y: number, m: number): number {
  return [31, esBisiesto(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0;
}

/** Años de 4 cifras (como pide la máscara dd/mm/aaaa). */
const anioValido = (y: number) => Number.isInteger(y) && y >= 1000 && y <= 9999;

export function aIso({ y, m, d }: Ymd): string {
  return `${y}-${p2(m)}-${p2(d)}`;
}

/** "YYYY-MM-DD" (o el principio de "YYYY-MM-DDTHH:mm") → partes, o null si no es una fecha que existe. */
export function deIso(iso: string | undefined | null): Ymd | null {
  const r = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!r) return null;
  const y = Number(r[1]);
  const m = Number(r[2]);
  const d = Number(r[3]);
  if (!anioValido(y) || m < 1 || m > 12 || d < 1 || d > diasDelMes(y, m)) return null;
  return { y, m, d };
}

/** La parte de fecha ("YYYY-MM-DD") de un valor de fecha o de fecha y hora, o "" si no es válida. */
export const soloFecha = (v: string | undefined | null) => (deIso(v) ? (v as string).slice(0, 10) : "");

/** La hora "HH:mm" de un valor "YYYY-MM-DDTHH:mm", o null. */
export function horaDe(v: string | undefined | null): { h: number; min: number } | null {
  const r = /T(\d{2}):(\d{2})$/.exec(v ?? "");
  if (!r) return null;
  const h = Number(r[1]);
  const min = Number(r[2]);
  return h <= 23 && min <= 59 ? { h, min } : null;
}

export const unirFechaHora = (fecha: string, h: number, min: number) => `${fecha}T${p2(h)}:${p2(min)}`;

/** Hoy en hora LOCAL (no `toISOString`, que es UTC: a las 22 h de Buenos Aires ya sería mañana). */
export function hoyIso(ahora = new Date()): string {
  return aIso({ y: ahora.getFullYear(), m: ahora.getMonth() + 1, d: ahora.getDate() });
}

const utc = ({ y, m, d }: Ymd) => {
  const t = new Date(Date.UTC(2000, m - 1, d));
  t.setUTCFullYear(y); // Date.UTC trata 0–99 como 1900–1999: el año se fija aparte.
  return t;
};
const deUtc = (t: Date): Ymd => ({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });

export function sumarDias(iso: string, n: number): string {
  const f = deIso(iso);
  if (!f) return iso;
  const t = utc(f);
  t.setUTCDate(t.getUTCDate() + n);
  return aIso(deUtc(t));
}

/** Suma meses conservando el día si existe; si no, el último del mes (31/01 + 1 mes = 28 o 29/02). */
export function sumarMeses(iso: string, n: number): string {
  const f = deIso(iso);
  if (!f) return iso;
  const total = f.y * 12 + (f.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return aIso({ y, m, d: Math.min(f.d, diasDelMes(y, m)) });
}

/** 0 = lunes … 6 = domingo. */
export function diaSemana(iso: string): number {
  const f = deIso(iso);
  return f ? (utc(f).getUTCDay() + 6) % 7 : 0;
}

export const inicioSemana = (iso: string) => sumarDias(iso, -diaSemana(iso));
export const finSemana = (iso: string) => sumarDias(iso, 6 - diaSemana(iso));

/** Las 6 semanas (6 × 7) que muestran el mes de `iso`, desde el lunes de la semana del día 1. */
export function grillaMes(iso: string): string[][] {
  const f = deIso(iso);
  if (!f) return [];
  let dia = inicioSemana(aIso({ ...f, d: 1 }));
  return Array.from({ length: 6 }, () =>
    Array.from({ length: 7 }, () => {
      const actual = dia;
      dia = sumarDias(dia, 1);
      return actual;
    }),
  );
}

/** ¿El día está dentro de [min, max]? Compara por día (min/max pueden traer hora: se ignora). Strings ISO: el orden
 *  alfabético es el cronológico. */
export function enRango(iso: string, min?: string, max?: string): boolean {
  const lo = soloFecha(min);
  const hi = soloFecha(max);
  return (!lo || iso >= lo) && (!hi || iso <= hi);
}

/** El día más cercano dentro de [min, max]. Con min > max no hay ninguno válido: devuelve min (y `enRango` da false). */
export function acotar(iso: string, min?: string, max?: string): string {
  const lo = soloFecha(min);
  const hi = soloFecha(max);
  if (lo && iso < lo) return lo;
  if (hi && iso > hi) return hi;
  return iso;
}

/** ¿Algún día del mes de `iso` entra en el rango? (para la vista de meses) */
export function mesEnRango(y: number, m: number, min?: string, max?: string): boolean {
  const desde = aIso({ y, m, d: 1 });
  const hasta = aIso({ y, m, d: diasDelMes(y, m) });
  const lo = soloFecha(min);
  const hi = soloFecha(max);
  return (!lo || hasta >= lo) && (!hi || desde <= hi) && (!lo || !hi || lo <= hi);
}

/** Valor → texto del campo: "06/10/2026" o "06/10/2026 14:30"; "" si está vacío o no es válido. */
export function formatear(valor: string, conHora: boolean): string {
  const f = deIso(valor);
  if (!f) return "";
  const fecha = `${p2(f.d)}/${p2(f.m)}/${f.y}`;
  if (!conHora) return fecha;
  const h = horaDe(valor);
  return h ? `${fecha} ${p2(h.h)}:${p2(h.min)}` : fecha;
}

/** "martes 6 de octubre de 2026": nombre de cada día de la grilla para el lector de pantalla. */
export function textoLargo(iso: string): string {
  const f = deIso(iso);
  return f ? `${DIAS[diaSemana(iso)]} ${f.d} de ${MESES[f.m - 1]} de ${f.y}` : "";
}

/** "Octubre 2026" (cabecera del calendario). */
export function tituloMes(iso: string): string {
  const f = deIso(iso);
  if (!f) return "";
  const mes = MESES[f.m - 1];
  return `${mes[0].toUpperCase()}${mes.slice(1)} ${f.y}`;
}

const SEGMENTOS: readonly number[] = [2, 2, 4, 2, 2];
const SEPARADORES = ["/", "/", " ", ":"] as const;

/**
 * Máscara mientras se tipea: solo cifras, con "/" (y " " y ":" si hay hora) puestas solas. Un separador tipeado justo
 * después de una sola cifra completa con cero ("6/" → "06/"); pegado en el medio ("6/10/2026") se respeta.
 * `agregando`: el texto creció (se tipeó o pegó). Al borrar no se reacomoda nada (solo se filtran caracteres), así
 * Backspace puede borrar un separador y el cursor no salta.
 */
export function enmascarar(crudo: string, conHora: boolean, agregando: boolean): string {
  const largos = conHora ? SEGMENTOS : SEGMENTOS.slice(0, 3);
  const tope = largos.reduce((a, b) => a + b, 0) + largos.length - 1;
  if (!agregando) return crudo.replace(/[^\d/ :]/g, "").slice(0, tope);
  const segs = [""];
  Array.from(crudo).forEach((ch, idx) => {
    const i = segs.length - 1;
    if (ch >= "0" && ch <= "9") {
      if (segs[i].length < largos[i]) segs[i] += ch;
      else if (i + 1 < largos.length) segs.push(ch);
    } else if ("/-. :".includes(ch) && segs[i].length > 0 && i + 1 < largos.length) {
      const lleno = segs[i].length === largos[i];
      if (!lleno && largos[i] !== 2) return; // un año a medias no se corta
      if (!lleno && idx === crudo.length - 1) segs[i] = `0${segs[i]}`;
      segs.push("");
    }
  });
  let texto = segs[0];
  for (let i = 1; i < segs.length; i++) texto += SEPARADORES[i - 1] + segs[i];
  const ultimo = segs.length - 1;
  if (agregando && segs[ultimo].length === largos[ultimo] && ultimo + 1 < largos.length) texto += SEPARADORES[ultimo];
  return texto;
}

export type Interpretado = { valor: string } | { error: string };

/**
 * Texto del campo → valor. Vacío = "". Un texto que no es una fecha (o fecha y hora) existente, o que cae fuera de
 * [min, max] (por día), da un error para mostrar: el valor de un DatePicker es siempre válido o "".
 */
export function interpretar(texto: string, conHora: boolean, min?: string, max?: string): Interpretado {
  const t = texto.trim();
  if (!t) return { valor: "" };
  const formato = conHora ? "dd/mm/aaaa hh:mm" : "dd/mm/aaaa";
  const r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(t);
  if (!r || (conHora && r[4] === undefined) || (!conHora && r[4] !== undefined)) {
    return { error: `Escribí la fecha como ${formato}.` };
  }
  const f = { d: Number(r[1]), m: Number(r[2]), y: Number(r[3]) };
  if (!anioValido(f.y) || f.m < 1 || f.m > 12 || f.d < 1 || f.d > diasDelMes(f.y, f.m)) {
    return { error: `El ${p2(f.d)}/${p2(f.m)}/${r[3]} no existe.` };
  }
  const iso = aIso(f);
  if (!enRango(iso, min, max)) {
    const lo = formatear(soloFecha(min), false);
    const hi = formatear(soloFecha(max), false);
    if (lo && hi && soloFecha(min) > soloFecha(max)) return { error: "No hay fechas disponibles." };
    return { error: lo && hi ? `Elegí una fecha entre el ${lo} y el ${hi}.` : lo ? `Elegí una fecha desde el ${lo}.` : `Elegí una fecha hasta el ${hi}.` };
  }
  if (!conHora) return { valor: iso };
  const h = Number(r[4]);
  const min_ = Number(r[5]);
  if (h > 23 || min_ > 59) return { error: "La hora va de 00:00 a 23:59." };
  return { valor: unirFechaHora(iso, h, min_) };
}

/**
 * Qué deja confirmar un texto (salir del campo o Enter). Distingue BORRADO de INVÁLIDO:
 * - vacío → valor "" (se borró a propósito): se emite;
 * - válido → ese valor: se emite;
 * - inválido (no existe, mal escrito, fuera de rango) → el mensaje, y el valor depende de `conservar`: por defecto "" (un
 *   formulario lo valida como faltante: nunca se guarda una fecha que la persona no ve); con `conservar` (los filtros de
 *   una lista), queda `actual`, el último válido, y NO se emite nada: un texto mal tipeado no borra un filtro aplicado.
 */
export function confirmarTexto(
  texto: string,
  conHora: boolean,
  actual: string,
  { min, max, conservar = false }: { min?: string; max?: string; conservar?: boolean } = {},
): { valor: string; error: string | null; emitir: boolean } {
  const r = interpretar(texto, conHora, min, max);
  if ("valor" in r) return { valor: r.valor, error: null, emitir: r.valor !== actual };
  return conservar ? { valor: actual, error: r.error, emitir: false } : { valor: "", error: r.error, emitir: actual !== "" };
}

/**
 * Hora o minutos de los campos del calendario: el texto tipeado → número dentro de [0, max] (tope, no vuelta).
 * Sin cifras, `previo`.
 */
export function acotarNumero(texto: string, max: number, previo: number): number {
  const n = Number.parseInt(texto.replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? previo : Math.min(max, Math.max(0, n));
}

/** ↑/↓ en hora o minutos: da la vuelta (23 → 0, 0 → 59), como un reloj. */
export const pasoCircular = (n: number, delta: number, max: number) => (((n + delta) % (max + 1)) + max + 1) % (max + 1);

export const dosCifras = p2;
