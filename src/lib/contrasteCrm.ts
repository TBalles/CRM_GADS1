/**
 * Contraste WCAG de los tokens de CRM 2.0 (`src/app/(app)/crm.css`), calculado, no estimado.
 *
 * Lee los bloques `[data-crm] { … }` (claro) y `.dark [data-crm] { … }` (oscuro, que pisa al claro), resuelve
 * `var()`, `hsl()`, `#hex` y `color-mix(in srgb, …)` (con transparencia), compone las capas semitransparentes
 * sobre su fondo y mide cada par documentado en MASTER.md.
 *
 * Sin imports: se prueba con `node --test` (contrasteCrm.check.ts). La tabla de MASTER.md sale de `tablaMarkdown`:
 *   node -e "import('./src/lib/contrasteCrm.ts').then(async m => console.log(m.tablaMarkdown(
 *     (await import('node:fs')).readFileSync('src/app/(app)/crm.css', 'utf8'))))"
 */

export type Tema = "claro" | "oscuro";
type Rgba = { r: number; g: number; b: number; a: number };

/** Un par a medir. `fondo` son capas de arriba hacia abajo: la última tiene que ser opaca. */
export type Par = { nombre: string; texto: string; fondo: string[]; minimo: 4.5 | 3 };

const T = 4.5 as const;
const UI = 3 as const;

/** Los pares que MASTER.md promete. Texto: 4.5:1. Componentes de UI, bordes de control y foco: 3:1. */
export const PARES: Par[] = [
  // Texto principal y secundario sobre cada superficie y estado de fila
  ...["--crm-text", "--crm-text-2"].flatMap((t): Par[] => [
    { nombre: `${t} / canvas`, texto: t, fondo: ["--crm-canvas"], minimo: T },
    { nombre: `${t} / panel`, texto: t, fondo: ["--crm-panel"], minimo: T },
    { nombre: `${t} / panel-2`, texto: t, fondo: ["--crm-panel-2"], minimo: T },
    { nombre: `${t} / hover sobre panel`, texto: t, fondo: ["--crm-hover", "--crm-panel"], minimo: T },
    { nombre: `${t} / pressed sobre panel`, texto: t, fondo: ["--crm-pressed", "--crm-panel"], minimo: T },
    { nombre: `${t} / fila seleccionada`, texto: t, fondo: ["--crm-selected", "--crm-panel"], minimo: T },
    { nombre: `${t} / seleccionada + hover`, texto: t, fondo: ["--crm-hover", "--crm-selected", "--crm-panel"], minimo: T },
  ]),
  // Acento como texto (links, item activo, tab activa)
  { nombre: "accent-text / panel", texto: "--crm-accent-text", fondo: ["--crm-panel"], minimo: T },
  { nombre: "accent-text / canvas", texto: "--crm-accent-text", fondo: ["--crm-canvas"], minimo: T },
  { nombre: "accent-text / panel-2", texto: "--crm-accent-text", fondo: ["--crm-panel-2"], minimo: T },
  { nombre: "accent-text / seleccionada", texto: "--crm-accent-text", fondo: ["--crm-selected", "--crm-panel"], minimo: T },
  // Botones sólidos
  { nombre: "on-accent / accent (botón primario)", texto: "--crm-on-accent", fondo: ["--crm-accent"], minimo: T },
  { nombre: "on-accent / accent-hover", texto: "--crm-on-accent", fondo: ["--crm-accent-hover"], minimo: T },
  { nombre: "on-danger / danger (botón destructivo)", texto: "--crm-on-danger", fondo: ["--crm-danger"], minimo: T },
  { nombre: "on-danger / danger-hover", texto: "--crm-on-danger", fondo: ["--crm-danger-hover"], minimo: T },
  // Semánticos: texto sólido sobre su tinte (banner, badge) y suelto sobre panel/canvas (estado, error de campo)
  ...(["success", "warning", "danger", "info"] as const).flatMap((s): Par[] => [
    { nombre: `${s} / ${s}-tint sobre panel`, texto: `--crm-${s}`, fondo: [`--crm-${s}-tint`, "--crm-panel"], minimo: T },
    { nombre: `${s} / ${s}-tint sobre canvas`, texto: `--crm-${s}`, fondo: [`--crm-${s}-tint`, "--crm-canvas"], minimo: T },
    { nombre: `${s} / panel`, texto: `--crm-${s}`, fondo: ["--crm-panel"], minimo: T },
    { nombre: `${s} / canvas`, texto: `--crm-${s}`, fondo: ["--crm-canvas"], minimo: T },
  ]),
  { nombre: "text / success-tint (texto del banner)", texto: "--crm-text", fondo: ["--crm-success-tint", "--crm-panel"], minimo: T },
  { nombre: "text / danger-tint (texto del banner)", texto: "--crm-text", fondo: ["--crm-danger-tint", "--crm-panel"], minimo: T },
  { nombre: "text / warning-tint (texto del banner)", texto: "--crm-text", fondo: ["--crm-warning-tint", "--crm-panel"], minimo: T },
  { nombre: "text / info-tint (texto del banner)", texto: "--crm-text", fondo: ["--crm-info-tint", "--crm-panel"], minimo: T },
  // Tooltip
  { nombre: "on-inverse / inverse (tooltip)", texto: "--crm-on-inverse", fondo: ["--crm-inverse"], minimo: T },
  // Componentes de UI (WCAG 1.4.11)
  { nombre: "border-strong / panel (borde de input, checkbox)", texto: "--crm-border-strong", fondo: ["--crm-panel"], minimo: UI },
  { nombre: "border-strong / canvas", texto: "--crm-border-strong", fondo: ["--crm-canvas"], minimo: UI },
  { nombre: "border-strong / panel-2", texto: "--crm-border-strong", fondo: ["--crm-panel-2"], minimo: UI },
  { nombre: "focus / panel (anillo de foco)", texto: "--crm-focus", fondo: ["--crm-panel"], minimo: UI },
  { nombre: "focus / canvas", texto: "--crm-focus", fondo: ["--crm-canvas"], minimo: UI },
  { nombre: "focus / panel-2", texto: "--crm-focus", fondo: ["--crm-panel-2"], minimo: UI },
  { nombre: "focus / fila seleccionada", texto: "--crm-focus", fondo: ["--crm-selected", "--crm-panel"], minimo: UI },
  { nombre: "accent / panel (check, switch, barra de selección)", texto: "--crm-accent", fondo: ["--crm-panel"], minimo: UI },
  { nombre: "accent / canvas", texto: "--crm-accent", fondo: ["--crm-canvas"], minimo: UI },
  // Indicadores de estado: la barra de 2 px es lo que cumple 3:1 (el tinte solo, no)
  { nombre: "accent / fila seleccionada (barra de 2 px)", texto: "--crm-accent", fondo: ["--crm-selected", "--crm-panel"], minimo: UI },
  { nombre: "accent / seleccionada + hover (barra)", texto: "--crm-accent", fondo: ["--crm-hover", "--crm-selected", "--crm-panel"], minimo: UI },
  { nombre: "accent / item activo de menú o lista (barra)", texto: "--crm-accent", fondo: ["--crm-pressed", "--crm-panel"], minimo: UI },
  { nombre: "accent / panel-2 (borde del segmento elegido)", texto: "--crm-accent", fondo: ["--crm-panel-2"], minimo: UI },
  { nombre: "accent-text / pressed (página o segmento activo)", texto: "--crm-accent-text", fondo: ["--crm-pressed", "--crm-panel"], minimo: T },
  { nombre: "on-accent / accent (tilde del checkbox)", texto: "--crm-on-accent", fondo: ["--crm-accent"], minimo: UI },
  { nombre: "danger / panel (borde de campo con error)", texto: "--crm-danger", fondo: ["--crm-panel"], minimo: UI },
  { nombre: "text-2 / panel (ícono secundario)", texto: "--crm-text-2", fondo: ["--crm-panel"], minimo: UI },
];

/**
 * Tokens de color que a propósito NO se miden en ningún par, con el motivo. Todo otro `--crm-*` de color tiene que
 * aparecer en `PARES` (si no, `auditarTokens` falla): así un color nuevo no entra sin medirse.
 */
export const SIN_PAR: Record<string, string> = {
  "--crm-border": "hairline decorativo (paneles, divisores): no identifica un control; WCAG 1.4.11 no lo exige",
  "--crm-scrim": "velo de fondo de drawer y diálogo: no lleva texto encima",
  "--crm-skeleton": "decorativo; la región lleva aria-busy y un status \"Cargando…\"",
  "--crm-text-disabled": "texto deshabilitado: exento de contraste (WCAG 1.4.3)",
};

/** Tokens de color que a propósito valen lo mismo en oscuro (hoy ninguno). Cualquier otro tiene que redefinirse. */
export const IGUAL_EN_OSCURO: readonly string[] = [];

/* ---------------------------------------------------------------------------
   Lectura del CSS
   ------------------------------------------------------------------------ */

function declaraciones(cuerpo: string): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const m of cuerpo.matchAll(/(--crm-[\w-]+)\s*:\s*([^;]+);/g)) salida[m[1]] = m[2].trim();
  return salida;
}

/** Tokens `--crm-*` de cada tema. El oscuro hereda del claro lo que no redefine (como en el navegador). */
export function leerTokens(css: string): Record<Tema, Record<string, string>> {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const claro: Record<string, string> = {};
  const oscuro: Record<string, string> = {};
  // Bloques sin llaves adentro: los de nivel superior (los de @keyframes/@media no tienen esos selectores).
  for (const m of limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (selector === "[data-crm]") Object.assign(claro, declaraciones(m[2]));
    else if (selector === ".dark [data-crm]") Object.assign(oscuro, declaraciones(m[2]));
  }
  return { claro, oscuro: { ...claro, ...oscuro } };
}

/* ---------------------------------------------------------------------------
   Colores
   ------------------------------------------------------------------------ */

function hslARgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** Separa por comas de primer nivel (no las de adentro de un paréntesis). */
function argumentos(texto: string): string[] {
  const salida: string[] = [];
  let prof = 0;
  let actual = "";
  for (const c of texto) {
    if (c === "(") prof++;
    if (c === ")") prof--;
    if (c === "," && prof === 0) {
      salida.push(actual.trim());
      actual = "";
    } else actual += c;
  }
  salida.push(actual.trim());
  return salida;
}

/** Resuelve un valor de color a sRGB 0–255 con alfa 0–1. Lanza si no lo entiende (mejor que medir mal). */
export function resolverColor(valor: string, tokens: Record<string, string>, prof = 0): Rgba {
  if (prof > 20) throw new Error(`referencia circular en ${valor}`);
  const v = valor.trim();
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  if (ref) {
    const destino = tokens[ref[1]];
    if (destino === undefined) throw new Error(`token inexistente: ${ref[1]}`);
    return resolverColor(destino, tokens, prof + 1);
  }
  if (v === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const hsl = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*(?:\/\s*([\d.]+))?\s*\)$/.exec(v);
  if (hsl) {
    const [r, g, b] = hslARgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]));
    return { r, g, b, a: hsl[4] === undefined ? 1 : Number(hsl[4]) };
  }
  const mix = /^color-mix\(\s*in srgb\s*,([\s\S]*)\)$/.exec(v);
  if (mix) {
    const [p1, p2] = argumentos(mix[1]);
    const parte = (p: string) => {
      const m = /^([\s\S]*?)(?:\s+([\d.]+)%)?$/.exec(p)!;
      return { color: resolverColor(m[1], tokens, prof + 1), pct: m[2] === undefined ? null : Number(m[2]) / 100 };
    };
    const a = parte(p1);
    const b = parte(p2);
    const pa = a.pct ?? (b.pct === null ? 0.5 : 1 - b.pct);
    const pb = b.pct ?? 1 - pa;
    // color-mix interpola con alfa premultiplicado (CSS Color 5).
    const alfa = a.color.a * pa + b.color.a * pb;
    if (alfa === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const canal = (k: "r" | "g" | "b") => (a.color[k] * a.color.a * pa + b.color[k] * b.color.a * pb) / alfa;
    return { r: canal("r"), g: canal("g"), b: canal("b"), a: alfa };
  }
  throw new Error(`color que no sé leer: ${v}`);
}

/** Compone capas (de arriba hacia abajo) sobre la última, que tiene que ser opaca. */
export function componer(capas: Rgba[]): Rgba {
  let base = capas[capas.length - 1];
  if (base.a < 1) throw new Error("la capa de abajo de un fondo tiene que ser opaca");
  for (let i = capas.length - 2; i >= 0; i--) {
    const c = capas[i];
    base = {
      r: c.r * c.a + base.r * (1 - c.a),
      g: c.g * c.a + base.g * (1 - c.a),
      b: c.b * c.a + base.b * (1 - c.a),
      a: 1,
    };
  }
  return base;
}

function luminancia({ r, g, b }: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contraste(a: Rgba, b: Rgba): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export type Medicion = Par & { tema: Tema; ratio: number; ok: boolean };

/** Mide todos los pares en los dos temas. */
export function medir(css: string, pares: Par[] = PARES): Medicion[] {
  const temas = leerTokens(css);
  return (["claro", "oscuro"] as const).flatMap((tema) =>
    pares.map((par) => {
      const tokens = temas[tema];
      const col = (t: string) => resolverColor(`var(${t})`, tokens);
      const fondo = componer(par.fondo.map(col));
      const texto = componer([col(par.texto), fondo]);
      const ratio = contraste(texto, fondo);
      return { ...par, tema, ratio, ok: ratio >= par.minimo };
    }),
  );
}

/**
 * Errores de cobertura de los tokens: un color del claro que el oscuro no redefine (y no está en `IGUAL_EN_OSCURO`)
 * hereda en silencio el valor claro; un color que no está en ningún par ni en `SIN_PAR` nunca se midió.
 */
export function auditarTokens(css: string, pares: Par[] = PARES): string[] {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const oscuroPropio: Record<string, string> = {};
  for (const m of limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (m[1].trim() === ".dark [data-crm]") Object.assign(oscuroPropio, declaraciones(m[2]));
  const { claro } = leerTokens(css);
  const esColor = (t: string) => {
    try {
      resolverColor(`var(${t})`, claro);
      return true;
    } catch {
      return false;
    }
  };
  const colores = Object.keys(claro).filter(esColor);
  const usados = new Set(pares.flatMap((p) => [p.texto, ...p.fondo]));
  const errores: string[] = [];
  for (const t of colores) {
    if (!(t in oscuroPropio) && !IGUAL_EN_OSCURO.includes(t)) errores.push(`${t}: el tema oscuro no lo redefine (heredaría el valor claro)`);
    if (!usados.has(t) && !(t in SIN_PAR)) errores.push(`${t}: no aparece en ningún par de PARES ni en SIN_PAR`);
  }
  for (const t of Object.keys(SIN_PAR)) if (!colores.includes(t)) errores.push(`${t}: está en SIN_PAR pero no existe en crm.css`);
  return errores;
}

/** Tabla para MASTER.md: un par por fila, claro y oscuro lado a lado. */
export function tablaMarkdown(css: string): string {
  const m = medir(css);
  const filas = PARES.map((par) => {
    const c = m.find((x) => x.tema === "claro" && x.nombre === par.nombre)!;
    const o = m.find((x) => x.tema === "oscuro" && x.nombre === par.nombre)!;
    const f = (x: Medicion) => `${x.ratio.toFixed(2)}${x.ok ? "" : " ✗"}`;
    return `| ${par.nombre} | ${par.minimo}:1 | ${f(c)} | ${f(o)} |`;
  });
  return ["| Par | Mínimo | Claro | Oscuro |", "|---|---|---|---|", ...filas].join("\n");
}
