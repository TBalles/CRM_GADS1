/**
 * Compara dos carpetas de capturas (mismo nombre = par) píxel a píxel y cuenta las diferencias.
 *
 *   node scripts/guard/compare-png.mjs <carpetaA> <carpetaB> [--solo=dashboard,empresas]
 *
 * Sale con 1 si alguna difiere (o falta del otro lado). Sirve para el antes/después de una etapa: correr
 * `guard:baseline-crm` con GUARD_BASELINE_OUT distinto y comparar. Usa el decodificador PNG que ya trae
 * playwright-core (`utilsBundle`, interno: si una versión nueva de Playwright lo mueve, hay que ajustar el import).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const { PNG } = createRequire(import.meta.url)("playwright-core/lib/utilsBundle");

const [a, b] = process.argv.slice(2).filter((x) => !x.startsWith("--"));
if (!a || !b) {
  console.error("Uso: node scripts/guard/compare-png.mjs <carpetaA> <carpetaB> [--solo=id1,id2]");
  process.exit(2);
}
const soloArg = process.argv.find((x) => x.startsWith("--solo="));
const solo = soloArg ? soloArg.slice(7).split(",").filter(Boolean) : null;

const nombres = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith(".png") && (!solo || solo.some((s) => f.startsWith(s + "__"))));
const todos = [...new Set([...nombres(a), ...nombres(b)])].sort();
let distintas = 0;
for (const f of todos) {
  const pa = path.join(a, f);
  const pb = path.join(b, f);
  if (!fs.existsSync(pa) || !fs.existsSync(pb)) {
    console.log(`  FALTA      ${f} (${fs.existsSync(pa) ? "no está en B" : "no está en A"})`);
    distintas++;
    continue;
  }
  const A = PNG.sync.read(fs.readFileSync(pa));
  const B = PNG.sync.read(fs.readFileSync(pb));
  if (A.width !== B.width || A.height !== B.height) {
    console.log(`  TAMAÑO     ${f}: ${A.width}x${A.height} vs ${B.width}x${B.height}`);
    distintas++;
    continue;
  }
  let px = 0;
  let minX = A.width, minY = A.height, maxX = -1, maxY = -1;
  for (let i = 0; i < A.data.length; i += 4) {
    if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2] || A.data[i + 3] !== B.data[i + 3]) {
      px++;
      const p = i / 4;
      const x = p % A.width;
      const y = (p - x) / A.width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (px) {
    distintas++;
    console.log(`  DIFIERE    ${f}: ${px} px (zona x ${minX}-${maxX}, y ${minY}-${maxY})`);
  } else console.log(`  igual      ${f}`);
}
console.log(`\n[compare-png] ${todos.length} pares, ${distintas} con diferencias.`);
process.exit(distintas ? 1 : 0);
