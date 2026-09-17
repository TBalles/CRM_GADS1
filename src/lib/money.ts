/**
 * es-AR money masking / parsing (DESIGN.md §3.10). `.` groups thousands,
 * `,` separates decimals. Amounts never go through `type="number"`.
 */

export function maskMoney(raw: string | number | null | undefined): string {
  if (raw == null) return "";
  const s = String(raw).replace(/[^0-9.,]/g, "");
  if (s === "") return "";

  let intRaw: string, decRaw: string, hasDecimal: boolean;
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    const decSep = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const cut = s.lastIndexOf(decSep);
    intRaw = s.slice(0, cut).replace(/\D/g, "");
    decRaw = s.slice(cut + 1).replace(/\D/g, "");
    hasDecimal = true;
  } else if (hasComma) {
    const cut = s.indexOf(",");
    intRaw = s.slice(0, cut).replace(/\D/g, "");
    decRaw = s.slice(cut + 1).replace(/\D/g, "");
    hasDecimal = true;
  } else {
    intRaw = s.replace(/\D/g, "");
    decRaw = "";
    hasDecimal = false;
  }

  intRaw = intRaw.replace(/^0+(?=\d)/, "");
  let grouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (!hasDecimal) return grouped;
  if (grouped === "") grouped = "0";
  return grouped + "," + decRaw.slice(0, 2);
}

/** Seeds a MoneyInput from a stored number. */
export function maskFromNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Turns a masked string back into a number at submit time. */
export function parseMoney(masked: string | number | null | undefined): number {
  if (masked == null) return 0;
  const s = String(masked).trim();
  if (!s) return 0;
  const negative = s.startsWith("-");
  const cleaned = s.replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

/**
 * Index in a masked string that sits just after its `count`-th digit.
 *
 * Lets a caret be anchored to a DIGIT COUNT instead of a character offset, so
 * the separators the mask inserts or removes shift around the caret rather
 * than dragging it to the end of the field. See MoneyInput.
 */
export function offsetAfterDigits(masked: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  let i = 0;
  while (i < masked.length && seen < count) {
    if (masked[i] >= "0" && masked[i] <= "9") seen++;
    i++;
  }
  return i;
}

const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** Display formatter for amounts already stored as numbers. */
export function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${nf0.format(Math.round(n))}`;
}

/** Compact formatter for dense tiles: $1,2 M / $340 k. */
export function formatMoneyCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)} k`;
  return `$${nf0.format(Math.round(n))}`;
}
