/**
 * Clases compartidas de los primitivos de CRM 2.0 (MASTER.md §4 y §9). Sin "use client": lo importan también los
 * primitivos que se usan desde server components.
 *
 * Regla de consumo de tokens: utilidades de Tailwind v4 que leen la variable (`bg-(--crm-panel)`). Ningún color,
 * radio, sombra ni z-index literal en un primitivo: si falta un valor, se agrega un `--crm-*` en crm.css.
 */
export { cn } from "@/lib/utils";

/** Raíz tipográfica: la llevan la página CRM 2.0 y CADA capa portalizada (el portal no hereda de la página). */
export const UI_ROOT =
  "font-(family-name:--crm-font-sans) text-[14px] leading-5 text-(--crm-text) antialiased [font-feature-settings:'kern']";

/** Escala tipográfica (MASTER.md §4). 12 es el mínimo: nada más chico en el CRM. */
export const TYPE = {
  meta: "text-[12px] leading-4",
  table: "text-[13px] leading-[18px]",
  ui: "text-[14px] leading-5",
  section: "text-[16px] leading-6 font-semibold",
  title: "text-[20px] leading-7 font-semibold tracking-[-0.01em]",
  kpi: "font-(family-name:--crm-font-mono) text-[28px] leading-9 font-medium tabular-nums",
  /** Cifras e identificadores: mono, numerales tabulares. */
  mono: "font-(family-name:--crm-font-mono) tabular-nums",
  /** Cabecera de tabla: 12/500 secundaria, en sentence case (sin mayúsculas ni versalitas); la línea fuerte de abajo
   *  la pone el `Th`. */
  th: "text-[12px] leading-4 font-medium text-(--crm-text-2)",
  /** Unidad o símbolo junto a una cifra ($, u., %, d): mismo tamaño, color secundario. */
  unit: "text-(--crm-text-2) font-normal",
} as const;

/**
 * Anillo de foco único: 2 px de acento, offset 1. Solo con teclado (`:focus-visible`).
 * `focus-visible:outline-solid` es obligatorio: en Tailwind v4 `outline-none` deja `--tw-outline-style: none` y
 * `outline-2` usa esa variable, así que sin él el anillo NO se dibuja (bug de la Etapa 1, corregido en la Etapa 3).
 */
export const FOCUS =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-(--crm-focus)";

/** Deshabilitado: 45 % y `not-allowed`, igual en todos los controles. */
export const DISABLED = "disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45";

/** Caja de un control de formulario (input, select, textarea). Alto lo pone cada uno (32 / 28 / 36). */
export const FIELD = [
  "w-full min-w-0 rounded-(--crm-radius-sm) border border-(--crm-border-strong) bg-(--crm-panel) px-3 text-(--crm-text)",
  "placeholder:text-(--crm-text-2) transition-[border-color,outline-color] duration-(--crm-dur-fast) ease-(--crm-ease)",
  "hover:border-(--crm-text-2) aria-invalid:border-(--crm-danger)",
  // 16 px en mobile para que iOS no haga zoom al enfocar; 14 px desde sm.
  "text-[16px] sm:text-[14px]",
  FOCUS,
  DISABLED,
].join(" ");

/** Superficie de una capa flotante (popover, menú, listbox). */
export const FLOATING =
  "rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel) shadow-(--crm-shadow-float) animate-[crm-pop_var(--crm-dur-fast)_var(--crm-ease)] motion-reduce:animate-none";

/**
 * Item de menú o de listbox (fila de 32). `data-active` es el item "activo" del teclado: tinte `--crm-pressed` MÁS una
 * barra izquierda de 2 px en acento (el tinte solo no llega a 3:1; la barra sí, medida en PARES).
 */
export const ITEM = [
  "flex h-8 w-full cursor-pointer select-none items-center gap-2 rounded-(--crm-radius-sm) px-2 text-left text-[14px] text-(--crm-text) outline-none",
  "hover:bg-(--crm-hover) data-[active=true]:bg-(--crm-pressed) data-[active=true]:shadow-[inset_2px_0_0_var(--crm-accent)]",
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-45",
].join(" ");
