/**
 * Self-check del contraste de los tokens de CRM 2.0. Correr con:
 *   node --test src/lib/contrasteCrm.check.ts
 *
 * Lee el crm.css real: si alguien cambia un color y rompe un par documentado en MASTER.md, falla con el nombre del par.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PARES, auditarTokens, componer, contraste, leerTokens, medir, resolverColor } from "./contrasteCrm.ts";

const CSS = readFileSync(new URL("../app/(app)/crm.css", import.meta.url), "utf8");

test("el lector de colores: hsl, hex, var, color-mix con transparencia y composición", () => {
  const negro = resolverColor("#000000", {});
  const blanco = resolverColor("hsl(0 0% 100%)", {});
  assert.equal(contraste(negro, blanco).toFixed(2), "21.00");
  assert.equal(contraste(blanco, blanco), 1);
  // #767676 sobre blanco es el gris AA de referencia: 4.54
  assert.equal(contraste(resolverColor("#767676", {}), blanco).toFixed(2), "4.54");
  const tinte = resolverColor("color-mix(in srgb, var(--x) 8%, transparent)", { "--x": "#000000" });
  assert.equal(tinte.a.toFixed(2), "0.08");
  const compuesto = componer([tinte, blanco]);
  assert.equal(Math.round(compuesto.r), Math.round(255 * 0.92));
  assert.throws(() => resolverColor("var(--no-existe)", {}), /token inexistente/);
  assert.throws(() => resolverColor("oklch(0.5 0.1 120)", {}), /no sé leer/);
});

test("crm.css define cada token que usan los pares, en los dos temas", () => {
  const temas = leerTokens(CSS);
  const usados = new Set(PARES.flatMap((p) => [p.texto, ...p.fondo]));
  for (const tema of ["claro", "oscuro"] as const) {
    for (const t of usados) assert.ok(temas[tema][t], `falta ${t} en el tema ${tema}`);
  }
  // el oscuro redefine las superficies (no hereda las del claro por olvido)
  assert.notEqual(leerTokens(CSS).oscuro["--crm-panel"], leerTokens(CSS).claro["--crm-panel"]);
});

test("cobertura: el oscuro redefine cada color y todo color está medido o exceptuado con motivo", () => {
  assert.deepEqual(auditarTokens(CSS), []);
  // la auditoría detecta los dos olvidos
  const sinOscuro = CSS.replace(/(\.dark \[data-crm\] \{[^}]*?)--crm-info:[^;]+;/, "$1");
  assert.ok(auditarTokens(sinOscuro).some((e) => e.startsWith("--crm-info: el tema oscuro")));
  const conNuevo = CSS.replace("[data-crm] {", "[data-crm] {\n  --crm-nuevo: hsl(0 0% 50%);");
  assert.ok(auditarTokens(conNuevo).some((e) => e.startsWith("--crm-nuevo: no aparece")));
});

for (const m of medir(CSS)) {
  test(`contraste ${m.tema}: ${m.nombre} >= ${m.minimo}:1`, () => {
    assert.ok(m.ok, `${m.tema} · ${m.nombre}: ${m.ratio.toFixed(2)}:1, el mínimo es ${m.minimo}:1`);
  });
}
