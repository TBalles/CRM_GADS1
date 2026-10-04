/**
 * Self-check del límite de llamadas de la IA (F7): node --test src/lib/ia/limite.check.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_LLAMADAS, VENTANA_MS, crearLimitador } from "./limite.ts";

test("deja pasar hasta el máximo y frena la siguiente, diciendo cuánto esperar", () => {
  let t = 1_000_000;
  const l = crearLimitador(3, 60_000, () => t);
  assert.deepEqual(l.intentar("u1"), { ok: true });
  t += 10_000;
  assert.deepEqual(l.intentar("u1"), { ok: true });
  t += 10_000;
  assert.deepEqual(l.intentar("u1"), { ok: true });
  t += 10_000;
  // La primera llamada (hace 30 s) sale de la ventana en 30 s.
  assert.deepEqual(l.intentar("u1"), { ok: false, reintentarEnSeg: 30 });
});

test("la ventana se desliza: pasado el tiempo vuelve a haber cupo", () => {
  let t = 0;
  const l = crearLimitador(1, 1000, () => t);
  assert.equal(l.intentar("u").ok, true);
  assert.equal(l.intentar("u").ok, false);
  t = 1001;
  assert.equal(l.intentar("u").ok, true);
});

test("cada persona tiene su propio cupo", () => {
  const l = crearLimitador(1, 60_000, () => 0);
  assert.equal(l.intentar("a").ok, true);
  assert.equal(l.intentar("b").ok, true);
  assert.equal(l.intentar("a").ok, false);
});

test("una llamada rechazada no consume cupo", () => {
  let t = 0;
  const l = crearLimitador(1, 1000, () => t);
  l.intentar("u");
  for (let i = 0; i < 5; i++) assert.equal(l.intentar("u").ok, false);
  t = 1001;
  assert.equal(l.intentar("u").ok, true);
});

test("el Map no crece sin techo: las claves vencidas se barren", () => {
  let t = 0;
  const l = crearLimitador(1, 1000, () => t);
  for (let i = 0; i < 600; i++) l.intentar(`u${i}`);
  t = 5000;
  l.intentar("nuevo");
  assert.ok(l.tamanio() <= 2, `quedaron ${l.tamanio()} claves`);
});

test("los valores por defecto: 10 cada 10 minutos", () => {
  assert.equal(MAX_LLAMADAS, 10);
  assert.equal(VENTANA_MS, 600_000);
});
