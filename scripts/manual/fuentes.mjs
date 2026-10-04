/**
 * Las tres tipografías del manual (las mismas de la aplicación), guardadas localmente en docs/manual/fuentes/.
 *
 *   Varela Round        títulos y la marca "Tuco & Nito"
 *   Plus Jakarta Sans   texto corrido
 *   JetBrains Mono      cifras
 *
 * La primera vez se bajan de Google Fonts (hace falta internet); a partir de ahí quedan en el repositorio
 * (licencia SIL Open Font License, que permite redistribuirlas) y el manual se genera sin conexión.
 * Solo se guardan los subconjuntos `latin` y `latin-ext`: cubren el castellano completo.
 */
import fs from "node:fs";
import path from "node:path";
import { DIR_FUENTES } from "./comun.mjs";

const FAMILIAS = [
  { slug: "varela-round", url: "https://fonts.googleapis.com/css2?family=Varela+Round&display=swap" },
  { slug: "plus-jakarta-sans", url: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400..800&display=swap" },
  { slug: "jetbrains-mono", url: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400..700&display=swap" },
];
const SUBCONJUNTOS = ["latin", "latin-ext"];
// Google Fonts entrega woff2 solo a navegadores modernos.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export const CSS_FUENTES = path.join(DIR_FUENTES, "fuentes.css");

/** Garantiza que estén las fuentes y `fuentes.css`; si faltan, las baja. Devuelve la ruta del CSS. */
export async function asegurarFuentes() {
  if (fs.existsSync(CSS_FUENTES) && fs.readdirSync(DIR_FUENTES).filter((f) => f.endsWith(".woff2")).length >= FAMILIAS.length * 2) return CSS_FUENTES;
  fs.mkdirSync(DIR_FUENTES, { recursive: true });
  console.log("[manual] Bajando las fuentes de Google Fonts (solo la primera vez)…");
  let css = "/* Generado por scripts/manual/fuentes.mjs. Fuentes con licencia SIL OFL 1.1 (Google Fonts). */\n";
  for (const fam of FAMILIAS) {
    const r = await fetch(fam.url, { headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error(`No se pudo bajar ${fam.url}: ${r.status}. Sin internet el manual no puede traer sus fuentes la primera vez.`);
    const texto = await r.text();
    for (const m of texto.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
      const [, subconjunto, cuerpo] = m;
      if (!SUBCONJUNTOS.includes(subconjunto)) continue;
      const url = /url\((https:[^)]+\.woff2)\)/.exec(cuerpo)?.[1];
      if (!url) continue;
      const archivo = `${fam.slug}-${subconjunto}.woff2`;
      const bin = await fetch(url);
      if (!bin.ok) throw new Error(`No se pudo bajar ${url}: ${bin.status}`);
      fs.writeFileSync(path.join(DIR_FUENTES, archivo), Buffer.from(await bin.arrayBuffer()));
      css += `/* ${fam.slug} ${subconjunto} */\n@font-face {${cuerpo.replace(/url\([^)]+\)/, `url(${archivo})`).replace(/font-display:[^;]+;/, "font-display: block;")}}\n`;
    }
  }
  fs.writeFileSync(CSS_FUENTES, css);
  return CSS_FUENTES;
}
