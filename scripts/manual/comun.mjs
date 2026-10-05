/**
 * Rutas y constantes compartidas por los scripts del manual (`capturas.mjs` y `generar.mjs`).
 * Cómo se usa todo esto: docs/manual/LEEME.md.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";

const aca = path.dirname(fileURLToPath(import.meta.url));

export const RAIZ = path.resolve(aca, "..", "..");
export const DIR_MANUAL = path.join(RAIZ, "docs", "manual");
export const DIR_CAPITULOS = path.join(DIR_MANUAL, "capitulos");
export const DIR_CAPTURAS = path.join(DIR_MANUAL, "capturas");
export const DIR_FUENTES = path.join(DIR_MANUAL, "fuentes");
export const PENDIENTES = path.join(DIR_MANUAL, "pendientes.json");
export const HTML_FUENTE = path.join(DIR_MANUAL, "manual.html");
/** Se arma a partir de `manual.html` y los capítulos; vive junto a ellos para que las rutas relativas anden. Está en .gitignore. */
export const HTML_GENERADO = path.join(DIR_MANUAL, "_manual.generado.html");
export const PDF_SALIDA = path.join(RAIZ, "docs", "Manual-de-usuario-Tuco-y-Nito.pdf");

/** Versión y fecha que lleva la tapa. La versión sale de package.json; la fecha, la de esa versión (2.0.0: CRM 2.0). */
export const FECHA_MANUAL = "5 de octubre de 2026";
