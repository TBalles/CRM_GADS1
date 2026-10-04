/**
 * Self-check del sitio web. Correr con:
 *   node --test src/lib/sitioweb.check.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import { sitioWebValido } from "./sitioweb.ts";

test("acepta dominios pelados y URLs http(s)", () => {
  assert.equal(sitioWebValido("www.tuempresa.com.ar"), true);
  assert.equal(sitioWebValido("tuempresa.com.ar/contacto"), true);
  assert.equal(sitioWebValido("https://tuempresa.com.ar"), true);
  assert.equal(sitioWebValido("HTTP://club.com.ar:8080/x?y=1"), true);
});

test("rechaza otros esquemas, espacios y basura", () => {
  assert.equal(sitioWebValido("javascript:alert(1)"), false);
  assert.equal(sitioWebValido("data:text/html,x"), false);
  assert.equal(sitioWebValido("ftp://club.com.ar"), false);
  assert.equal(sitioWebValido("localhost:3000"), false);
  assert.equal(sitioWebValido("mi sitio.com"), false);
  assert.equal(sitioWebValido("sinpunto"), false);
  assert.equal(sitioWebValido("https://user:pass@club.com.ar"), false);
  assert.equal(sitioWebValido(""), false);
});
