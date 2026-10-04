/**
 * Self-check de esErrorDeEsquema: node --test src/lib/esquema.check.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { esErrorDeEsquema } from "./esquema.ts";

test("reconoce la tabla o la columna que falta (0011 sin aplicar)", () => {
  assert.equal(esErrorDeEsquema({ code: "PGRST205", message: "Could not find the table 'public.canchas' in the schema cache" }), true);
  assert.equal(esErrorDeEsquema({ code: "42703", message: "column oportunidades.venta_item_id does not exist" }), true);
  assert.equal(esErrorDeEsquema({ code: "42P01", message: 'relation "public.licitaciones" does not exist' }), true);
  assert.equal(esErrorDeEsquema({ code: "PGRST204", message: "Could not find the 'venta_item_id' column of 'oportunidades' in the schema cache" }), true);
  assert.equal(esErrorDeEsquema({ code: "PGRST200", message: "Could not find a relationship between 'a' and 'b' in the schema cache" }), true);
});

test("sin codigo, el texto de PostgREST alcanza", () => {
  assert.equal(esErrorDeEsquema({ message: "Could not find the table 'public.canchas' in the schema cache" }), true);
});

test("no confunde un error de verdad con un esquema desactualizado", () => {
  assert.equal(esErrorDeEsquema(null), false);
  assert.equal(esErrorDeEsquema(undefined), false);
  assert.equal(esErrorDeEsquema({ code: "42501", message: "permission denied for table canchas" }), false);
  assert.equal(esErrorDeEsquema({ code: "23503", message: "violates foreign key constraint; key does not exist" }), false);
  assert.equal(esErrorDeEsquema({ code: "PGRST301", message: "JWT expired" }), false);
  assert.equal(esErrorDeEsquema({ message: "Failed to fetch" }), false);
  // Una funcion inexistente (42883) o cualquier otro codigo con "does not exist" no es un esquema sin migrar.
  assert.equal(esErrorDeEsquema({ code: "42883", message: "function public.cambiar_etapa(uuid) does not exist" }), false);
  assert.equal(esErrorDeEsquema({ code: "42704", message: 'type "foo" does not exist' }), false);
  assert.equal(esErrorDeEsquema({ message: "function foo() does not exist" }), false);
});
