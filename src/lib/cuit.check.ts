/**
 * Self-check del CUIT. Correr con:
 *   node --test src/lib/cuit.check.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import { cuitValido, formatearCuit } from "./cuit.ts";

test("cuitValido acepta CUITs reales con o sin guiones", () => {
  assert.equal(cuitValido("20123456786"), true);
  assert.equal(cuitValido("20-12345678-6"), true);
  // Verificador 0 (resto 11).
  assert.equal(cuitValido("30-30000013-0"), true);
});

test("cuitValido rechaza largo, verificador y basura", () => {
  assert.equal(cuitValido(""), false);
  assert.equal(cuitValido("2012345678"), false);
  assert.equal(cuitValido("201234567866"), false);
  assert.equal(cuitValido("20-12345678-7"), false);
  assert.equal(cuitValido("abc"), false);
});

test("formatearCuit pone los guiones y deja en paz lo que no es un CUIT", () => {
  assert.equal(formatearCuit("20123456786"), "20-12345678-6");
  assert.equal(formatearCuit(" 20-12345678-6 "), "20-12345678-6");
  assert.equal(formatearCuit("123"), "123");
});
