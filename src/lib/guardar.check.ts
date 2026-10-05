/** Auto-chequeo: node --test src/lib/guardar.check.ts */
import { strict as assert } from "node:assert";
import test from "node:test";
import { ERROR_INESPERADO, sinTrabarse } from "./guardar.ts";

test("si el guardado termina, no libera nada y devuelve true", async () => {
  const llamadas: string[] = [];
  assert.equal(await sinTrabarse(async () => "ok", (m) => llamadas.push(m)), true);
  assert.deepEqual(llamadas, []);
});

test("si el guardado tira, libera con el mensaje genérico y devuelve false (no propaga)", async () => {
  const llamadas: string[] = [];
  const original = console.error;
  console.error = () => {};
  try {
    const r = await sinTrabarse(async () => {
      throw new TypeError("Failed to fetch");
    }, (m) => llamadas.push(m));
    assert.equal(r, false);
  } finally {
    console.error = original;
  }
  assert.deepEqual(llamadas, [ERROR_INESPERADO]);
});
