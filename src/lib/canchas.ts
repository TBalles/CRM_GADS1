/**
 * Ficha de canchas y equipamiento sugerido (F4).
 *
 * LA REGLA ES UNA SUGERENCIA, NO UN DIAGNÓSTICO. Sale de medidas estándar por
 * formato (dos arcos por cancha, una red por arco, un par de pelotas de reserva)
 * y de lo que ESTE proveedor le vendió al cliente: no sabe qué compró el club en
 * otro lado ni el estado real de la cancha. La pantalla lo dice con esas palabras.
 *
 * Las medidas son estáticas a propósito (ver docs/decisiones/0012-reglas-del-rubro.md):
 * son las del reglamento de cada formato, no un dato que cada cliente configure.
 *
 * Imports relativos con extensión: se prueba con `node --test` (canchas.check.ts).
 */
import { tipoEquipo, type Equipo } from "./equipo.ts";
import type { FilaParque } from "./parque.ts";

export type Formato = "F5" | "F7" | "F9" | "F11" | "futsal";
export type Medida = "3x2" | "6x2,10" | "7,32x2,44";

/** Medida del arco de cada formato (reglamentaria o la usual en el fútbol de rubro). */
export const FORMATOS: { value: Formato; label: string; corto: string; medida: Medida }[] = [
  { value: "F5", label: "Fútbol 5", corto: "F5", medida: "3x2" },
  { value: "F7", label: "Fútbol 7", corto: "F7", medida: "6x2,10" },
  { value: "F9", label: "Fútbol 9", corto: "F9", medida: "7,32x2,44" },
  { value: "F11", label: "Fútbol 11", corto: "F11", medida: "7,32x2,44" },
  { value: "futsal", label: "Futsal", corto: "futsal", medida: "3x2" },
];

export const MEDIDAS: { value: Medida; label: string }[] = [
  { value: "3x2", label: "3 × 2 m" },
  { value: "6x2,10", label: "6 × 2,10 m" },
  { value: "7,32x2,44", label: "7,32 × 2,44 m" },
];

/** El CHECK `canchas_superficie_check` (0011). */
export const SUPERFICIES = [
  { value: "sintetico", label: "Césped sintético" },
  { value: "natural", label: "Césped natural" },
  { value: "cemento", label: "Cemento" },
  { value: "parquet", label: "Parquet" },
] as const;

export const ARCOS_POR_CANCHA = 2;
/** Supone UNA red por arco. Si el catálogo vende juegos de 2, la cuenta queda del lado de pedir de más. */
export const REDES_POR_ARCO = 1;
export const PELOTAS_POR_CANCHA = 2;

export function etiquetaFormato(valor: string): string {
  return FORMATOS.find((f) => f.value === valor)?.label ?? valor;
}

export function etiquetaSuperficie(valor: string | null): string | null {
  if (!valor) return null;
  return SUPERFICIES.find((s) => s.value === valor)?.label ?? valor;
}

export function etiquetaMedida(valor: Medida): string {
  return MEDIDAS.find((m) => m.value === valor)?.label ?? valor;
}

const quitarTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const MEDIDA_POR_NUMERO: Record<number, Medida> = { 5: "3x2", 7: "6x2,10", 9: "7,32x2,44", 11: "7,32x2,44" };

/**
 * Para qué medidas de arco puede servir un producto, mirando su NOMBRE ("Arco de fútbol 5/7" sirve
 * para 3 × 2 y para 6 × 2,10). Lista vacía = el nombre no dice nada: se lo trata como comodín.
 */
export function medidasDeProducto(nombre: string): Medida[] {
  const n = quitarTildes(nombre);
  const medidas = new Set<Medida>();
  for (const m of n.matchAll(/\b(?:futbol|f)\s*(\d{1,2})(?:\s*\/\s*(\d{1,2}))?\b/g)) {
    for (const g of [m[1], m[2]]) {
      const medida = g ? MEDIDA_POR_NUMERO[Number(g)] : undefined;
      if (medida) medidas.add(medida);
    }
  }
  if (/\bfutsal\b|\bfutbol de salon\b/.test(n)) medidas.add("3x2");
  if (/\b7[.,]32\b/.test(n)) medidas.add("7,32x2,44");
  if (/\b6\s*x\s*2[.,]1\d?\b/.test(n)) medidas.add("6x2,10");
  if (/\b3\s*x\s*2\b/.test(n)) medidas.add("3x2");
  return MEDIDAS.map((m) => m.value).filter((v) => medidas.has(v));
}

/** Lo que se cuenta del parque: unidades de un tipo de equipo, con el nombre del producto para ubicar la medida. */
export type UnidadParque = { tipo: Equipo; nombre: string; unidades: number };

/** Los vencidos no cuentan como cubiertos: ya están en recambio (la sección de parque los muestra aparte). */
export function unidadesDelParque(filas: readonly FilaParque[]): UnidadParque[] {
  return filas
    .filter((f) => f.estado !== "vencido")
    .map((f) => ({ tipo: tipoEquipo(f.producto, f.categoria), nombre: f.producto, unidades: f.cantidad }));
}

export type CanchaBasica = { nombre: string; formato: Formato | string; cantidad: number; activa: boolean };

export type LineaSugerida = {
  tipo: "arco" | "red" | "pelota";
  /** Solo arcos y redes. */
  medida?: Medida;
  formatos: Formato[];
  necesarias: number;
  cubiertas: number;
  faltan: number;
  /** Las pelotas son una reserva: no cuentan para decir que el equipamiento está completo. */
  opcional: boolean;
};

export type Sugerencia = {
  lineas: LineaSugerida[];
  hayCanchas: boolean;
  /** Hay canchas y nada obligatorio (arcos y redes) le falta. */
  completo: boolean;
};

/**
 * Qué equipamiento necesitan las canchas activas y cuánto de eso ya está en el parque.
 *
 * Las unidades del parque se reparten entre las medidas que el nombre del producto admite
 * (lo más específico primero; un nombre que no dice la medida sirve para cualquiera). Es un reparto
 * voraz: con productos "5/7" y canchas de F5 y de F7 a la vez, las unidades van primero a F5.
 * ponytail: alcanza para un catálogo chico; un matching exacto pediría la medida como dato del producto.
 */
export function equipamientoSugerido(canchas: readonly CanchaBasica[], parque: readonly UnidadParque[]): Sugerencia {
  const activas = canchas.filter((c) => c.activa);
  const necesidades = new Map<Medida, { formatos: Set<Formato>; canchas: number }>();
  let totalCanchas = 0;
  for (const c of activas) {
    const formato = FORMATOS.find((f) => f.value === c.formato);
    if (!formato) continue;
    totalCanchas += c.cantidad;
    const previa = necesidades.get(formato.medida) ?? { formatos: new Set<Formato>(), canchas: 0 };
    previa.formatos.add(formato.value);
    previa.canchas += c.cantidad;
    necesidades.set(formato.medida, previa);
  }

  const lineas: LineaSugerida[] = [];
  const medidasConNecesidad = MEDIDAS.map((m) => m.value).filter((m) => necesidades.has(m));

  for (const tipo of ["arco", "red"] as const) {
    const necesarias = (m: Medida) =>
      (necesidades.get(m)?.canchas ?? 0) * ARCOS_POR_CANCHA * (tipo === "red" ? REDES_POR_ARCO : 1);
    const cubiertas = new Map<Medida, number>(medidasConNecesidad.map((m) => [m, 0]));
    const propias = parque
      .filter((u) => u.tipo === tipo)
      .map((u) => ({ ...u, opciones: medidasDeProducto(u.nombre) }))
      // Lo que admite menos medidas se asigna antes; lo que no dice nada, al final.
      .sort((a, b) => (a.opciones.length || 99) - (b.opciones.length || 99));
    for (const p of propias) {
      let restantes = p.unidades;
      const candidatas = p.opciones.length ? medidasConNecesidad.filter((m) => p.opciones.includes(m)) : medidasConNecesidad;
      for (const m of candidatas) {
        const toma = Math.min(restantes, necesarias(m) - (cubiertas.get(m) ?? 0));
        if (toma > 0) {
          cubiertas.set(m, (cubiertas.get(m) ?? 0) + toma);
          restantes -= toma;
        }
      }
    }
    for (const m of medidasConNecesidad) {
      const n = necesarias(m);
      const c = cubiertas.get(m) ?? 0;
      lineas.push({
        tipo,
        medida: m,
        formatos: FORMATOS.filter((f) => necesidades.get(m)?.formatos.has(f.value)).map((f) => f.value),
        necesarias: n,
        cubiertas: c,
        faltan: Math.max(0, n - c),
        opcional: false,
      });
    }
  }

  if (totalCanchas > 0) {
    const necesarias = totalCanchas * PELOTAS_POR_CANCHA;
    const cubiertas = parque.filter((u) => u.tipo === "pelota").reduce((acc, u) => acc + u.unidades, 0);
    lineas.push({
      tipo: "pelota",
      formatos: [],
      necesarias,
      cubiertas: Math.min(cubiertas, necesarias),
      faltan: Math.max(0, necesarias - cubiertas),
      opcional: true,
    });
  }

  return {
    lineas,
    hayCanchas: totalCanchas > 0,
    completo: totalCanchas > 0 && lineas.filter((l) => !l.opcional).every((l) => l.faltan === 0),
  };
}

const NOMBRE: Record<LineaSugerida["tipo"], [string, string]> = {
  arco: ["arco", "arcos"],
  red: ["red", "redes"],
  pelota: ["pelota", "pelotas"],
};

/** "4 arcos de 3 × 2 m (F5)", "2 redes de 7,32 × 2,44 m (F9 y F11)", "4 pelotas". */
export function textoLinea(l: Pick<LineaSugerida, "tipo" | "medida" | "formatos">, cantidad: number): string {
  const [uno, varios] = NOMBRE[l.tipo];
  const base = `${cantidad} ${cantidad === 1 ? uno : varios}`;
  if (!l.medida) return base;
  const formatos = l.formatos.map((f) => FORMATOS.find((x) => x.value === f)?.corto ?? f).join(" y ");
  return `${base} de ${etiquetaMedida(l.medida)}${formatos ? ` (${formatos})` : ""}`;
}

/** "a", "a y b", "a, b y c". */
export function unirLista(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** Lo que falta de lo obligatorio, ya en palabras ("4 arcos de 3 × 2 m (F5)"). */
export function faltantesTexto(s: Sugerencia): string[] {
  return s.lineas.filter((l) => !l.opcional && l.faltan > 0).map((l) => textoLinea(l, l.faltan));
}

/** Título de la oportunidad: "Equipamiento para <cancha>", o para la empresa si tiene varias fichas. */
export function tituloEquipamiento(empresa: string, canchas: readonly CanchaBasica[]): string {
  const activas = canchas.filter((c) => c.activa);
  return activas.length === 1 ? `Equipamiento para ${activas[0].nombre}` : `Equipamiento para ${empresa}`;
}

/** Observaciones de la oportunidad creada desde la sugerencia: qué falta y de dónde salió la cuenta. */
export function notasEquipamiento(s: Sugerencia): string {
  const falta = faltantesTexto(s);
  return [
    "Sugerencia a partir de medidas estándar por formato y de lo que ya nos compró; no es un relevamiento de la cancha.",
    falta.length ? `Faltarían: ${falta.join("; ")}.` : "El equipamiento obligatorio figura completo; se creó para renovar o ampliar.",
  ].join("\n");
}
