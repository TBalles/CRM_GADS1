/**
 * Auto-chequeo del manual de usuario (docs/manual/ y scripts/manual/).
 *
 *   node --test src/lib/manual.check.ts
 *
 * No genera el PDF (eso es `npm run manual:pdf`): solo cuida que las piezas del manual no se desarmen sin avisar.
 *  - cada figura que el capítulo pide existe en scripts/manual/figuras.mjs y al revés (si no, quedaría un hueco o una captura
 *    que nunca se saca);
 *  - los id de capítulo son únicos y los capítulos se numeran sin saltos;
 *  - cada figura tiene su captura en docs/manual/capturas/ (PNG o JPG) o, si no, figura en docs/manual/pendientes.json, y nunca las dos cosas
 *    (una pendiente con captura vieja mostraría una pantalla que no existe);
 *  - docs/manual/pendientes.json no menciona figuras que ya no existen;
 *  - los scripts del manual no llevan contraseñas (el repositorio es público: las credenciales se pasan por entorno).
 */
import { strict as assert } from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { FIGURAS } from "../../scripts/manual/figuras.mjs";

const raiz = new URL("../../", import.meta.url);
const leer = (ruta: string) => readFileSync(new URL(ruta, raiz), "utf8");
const capitulos = readdirSync(new URL("docs/manual/capitulos/", raiz))
  .filter((f) => /^\d\d.*\.html$/.test(f))
  .sort()
  .map((f) => ({ archivo: f, html: leer(`docs/manual/capitulos/${f}`) }));

test("hay capítulos y todos declaran id, número y título", () => {
  assert.ok(capitulos.length >= 22, "faltan capítulos del manual");
  for (const c of capitulos) {
    const tag = /<section\b[^>]*class="cap[^"]*"[^>]*>/.exec(c.html)?.[0];
    assert.ok(tag, `${c.archivo}: falta <section class="cap">`);
    for (const attr of ["id", "data-num", "data-titulo"]) assert.ok(new RegExp(`${attr}="[^"]+"`).test(tag), `${c.archivo}: falta ${attr}`);
  }
});

test("los id de capítulo son únicos y los números van de 1 en 1", () => {
  const ids = capitulos.map((c) => /\bid="([^"]+)"/.exec(c.html)![1]);
  assert.equal(new Set(ids).size, ids.length, "hay capítulos con el mismo id");
  const numericos = capitulos.filter((c) => !/class="cap[^"]*apendice/.test(c.html)).map((c) => Number(/data-num="(\d+)"/.exec(c.html)![1]));
  assert.deepEqual(numericos, numericos.map((_, i) => i + 1), "los capítulos no se numeran 1, 2, 3…");
});

test("cada figura de los capítulos está en figuras.mjs, y cada figura de figuras.mjs está en un capítulo", () => {
  const enCapitulos = capitulos.flatMap((c) => [...c.html.matchAll(/data-fig="([^"]+)"/g)].map((m) => m[1]));
  assert.equal(new Set(enCapitulos).size, enCapitulos.length, "una figura se usa en dos lugares");
  const definidas = FIGURAS.map((f: { id: string }) => f.id);
  assert.equal(new Set(definidas).size, definidas.length, "figuras.mjs tiene ids repetidos");
  assert.deepEqual([...enCapitulos].sort(), [...definidas].sort());
});

test("pendientes.json solo nombra figuras que existen", () => {
  const { pendientes } = JSON.parse(leer("docs/manual/pendientes.json")) as { pendientes: { id: string }[] };
  const definidas = new Set(FIGURAS.map((f: { id: string }) => f.id));
  for (const p of pendientes) assert.ok(definidas.has(p.id), `pendientes.json nombra "${p.id}", que ya no existe en figuras.mjs`);
});

test("cada figura tiene su captura o está en pendientes.json, y no las dos cosas", () => {
  const { pendientes } = JSON.parse(leer("docs/manual/pendientes.json")) as { pendientes: { id: string }[] };
  const pendientesIds = new Set(pendientes.map((p) => p.id));
  for (const { id } of FIGURAS as { id: string }[]) {
    const captura = ["png", "jpg"].some((ext) => existsSync(new URL(`docs/manual/capturas/${id}.${ext}`, raiz)));
    assert.ok(captura || pendientesIds.has(id), `la figura "${id}" no tiene captura ni figura en pendientes.json: corré npm run manual:capturas`);
    assert.ok(!(captura && pendientesIds.has(id)), `la figura "${id}" tiene captura Y figura en pendientes.json: una de las dos está vieja`);
  }
});

test("los scripts del manual y del kit no llevan contraseñas", () => {
  for (const ruta of ["scripts/manual/capturas.mjs", "scripts/manual/figuras.mjs", "scripts/manual/generar.mjs", "scripts/migraciones/consolidar.mjs"]) {
    const texto = leer(ruta);
    assert.ok(!/Catedra\.2026/i.test(texto), `${ruta}: no pongas la contraseña de la demo en el repositorio; se pasa por entorno`);
    assert.ok(!/(password|contrase[nñ]a)\s*[:=]\s*["'][^"']{4,}["']/i.test(texto), `${ruta}: parece tener una contraseña escrita`);
  }
});
