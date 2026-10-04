/**
 * Auto-chequeo del kit de migraciones (supabase/aplicar/aplicar_0008_a_0012.sql).
 *
 *   node --test src/lib/migraciones.check.ts
 *
 * El kit es un archivo GENERADO por scripts/migraciones/consolidar.mjs a partir de las migraciones 0008 a 0012.
 * Si alguien toca una migración y se olvida de regenerarlo, la base viva recibiría una versión vieja. Esta prueba
 * lo regenera en memoria y falla si el archivo del repositorio no es idéntico.
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SALIDA, VERIFICACIONES, armar, leerMigraciones } from "../../scripts/migraciones/consolidar.mjs";

const delRepo = () => readFileSync(SALIDA, "utf8").replace(/\r\n/g, "\n");

test("el kit del repositorio está al día con las migraciones (si falla: npm run migraciones:consolidar)", () => {
  assert.equal(
    delRepo(),
    armar(),
    "supabase/aplicar/aplicar_0008_a_0012.sql quedó desactualizado: corré `npm run migraciones:consolidar` y commiteá el resultado.",
  );
});

test("incluye las migraciones 0008 a 0012, una vez cada una y en orden", () => {
  const sql = delRepo();
  const migraciones = leerMigraciones();
  assert.deepEqual(migraciones.map((m) => m.numero), [8, 9, 10, 11, 12]);
  let desde = 0;
  for (const m of migraciones) {
    const cartel = `-- >>> ${m.archivo}`;
    const i = sql.indexOf(cartel, desde);
    assert.ok(i >= 0, `falta (o está fuera de orden) ${m.archivo}`);
    assert.equal(sql.split(cartel).length - 1, 1, `${m.archivo} aparece más de una vez`);
    desde = i;
  }
});

test("no envuelve nada en una transacción propia (el editor la maneja) ni deja el bloque de pg_trgm encendido", () => {
  const sql = delRepo();
  assert.ok(!/^\s*(begin|commit|rollback)\s*;/im.test(sql), "no debería haber begin/commit/rollback a nivel de archivo");
  assert.ok(!/concurrently/i.test(sql.replace(/^--.*$/gm, "")), "create index concurrently no corre dentro de una transacción");
  const [, bloque] = /-- >>> BLOQUE OPCIONAL: PG_TRGM\n([\s\S]*?)\n-- <<< FIN BLOQUE OPCIONAL: PG_TRGM/.exec(sql) ?? [];
  assert.ok(bloque, "falta el bloque opcional de pg_trgm");
  for (const linea of bloque.split("\n")) assert.ok(linea.trim() === "" || linea.startsWith("-- "), `línea del bloque opcional sin comentar: ${linea}`);
  assert.ok(/create extension if not exists pg_trgm/.test(bloque), "el bloque opcional ya no tiene el create extension");
});

test("termina con el select de verificación (la última sentencia es la que muestra el editor)", () => {
  const sql = delRepo().trimEnd();
  const final = sql.slice(sql.lastIndexOf("with v(paso, migracion, verificacion, ok) as ("));
  assert.ok(final.startsWith("with v("), "no se encontró el select de verificación");
  assert.equal(final.split(";").filter((s) => s.trim() && !s.trim().startsWith("--")).length, 1, "después del select final no debería haber otra sentencia");
  assert.ok(VERIFICACIONES.length >= 20);
  for (const [mig] of VERIFICACIONES) assert.ok(["0008", "0009", "0010", "0011", "0012"].includes(mig));
});
