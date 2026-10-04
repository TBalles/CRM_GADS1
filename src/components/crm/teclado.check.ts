/**
 * Self-check de la navegación por teclado de los primitivos CRM 2.0. Correr con:
 *   node --test src/components/crm/teclado.check.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import { TIPEO_MS, acumularTipeo, buscarPorTexto, moverIndice, paradasDeTab, pasoDeTecla } from "./teclado.ts";

test("pasoDeTecla según la orientación", () => {
  assert.equal(pasoDeTecla("ArrowDown", "vertical"), "next");
  assert.equal(pasoDeTecla("ArrowUp", "vertical"), "prev");
  assert.equal(pasoDeTecla("ArrowRight", "vertical"), null);
  assert.equal(pasoDeTecla("ArrowRight", "horizontal"), "next");
  assert.equal(pasoDeTecla("ArrowLeft", "horizontal"), "prev");
  assert.equal(pasoDeTecla("ArrowDown", "horizontal"), null);
  assert.equal(pasoDeTecla("Home", "horizontal"), "first");
  assert.equal(pasoDeTecla("End", "vertical"), "last");
  assert.equal(pasoDeTecla("a", "vertical"), null);
});

test("moverIndice da la vuelta y salta los deshabilitados", () => {
  assert.equal(moverIndice(0, 3, "next"), 1);
  assert.equal(moverIndice(2, 3, "next"), 0);
  assert.equal(moverIndice(0, 3, "prev"), 2);
  assert.equal(moverIndice(-1, 3, "next"), 0, "sin activo, la flecha abajo va al primero");
  assert.equal(moverIndice(1, 3, "first"), 0);
  assert.equal(moverIndice(1, 3, "last"), 2);
  const off = (i: number) => i === 1;
  assert.equal(moverIndice(0, 3, "next", off), 2);
  assert.equal(moverIndice(2, 3, "prev", off), 0);
  assert.equal(moverIndice(0, 3, "first", (i) => i === 0), 1);
  assert.equal(moverIndice(0, 3, "last", (i) => i === 2), 1);
  assert.equal(moverIndice(0, 2, "next", () => true), -1);
  assert.equal(moverIndice(0, 0, "next"), -1);
});

test("buscarPorTexto: desde el siguiente, sin mayúsculas ni tildes", () => {
  const items = ["Editar", "Dar de baja", "Descargar", "Árbitro"];
  assert.equal(buscarPorTexto(items, -1, "d"), 1);
  assert.equal(buscarPorTexto(items, 1, "d"), 2);
  assert.equal(buscarPorTexto(items, 2, "d"), 1, "da la vuelta");
  assert.equal(buscarPorTexto(items, 0, "arb"), 3);
  assert.equal(buscarPorTexto(items, 0, "z"), -1);
  assert.equal(buscarPorTexto(items, 0, ""), -1);
  assert.equal(buscarPorTexto(items, -1, "d", (i) => i === 1), 2);
});

test("buscarPorTexto con varias letras incluye el actual y arranca en 0 sin activo", () => {
  const prov = ["Buenos Aires", "Córdoba", "Corrientes", "Chaco"];
  assert.equal(buscarPorTexto(prov, 1, "co"), 1, "'co' se queda en Córdoba");
  assert.equal(buscarPorTexto(prov, 1, "cor"), 1);
  assert.equal(buscarPorTexto(prov, 1, "corr"), 2);
  assert.equal(buscarPorTexto(prov, -1, "ch"), 3);
  assert.equal(buscarPorTexto(prov, -1, "bu"), 0);
});

test("acumularTipeo junta letras dentro de 500 ms y reinicia después", () => {
  let b = { texto: "", t: 0 };
  b = acumularTipeo(b, "c", 1000);
  assert.equal(b.texto, "c");
  b = acumularTipeo(b, "o", 1300);
  assert.equal(b.texto, "co");
  b = acumularTipeo(b, "r", 1300 + TIPEO_MS + 1);
  assert.equal(b.texto, "r");
});

test("paradasDeTab: un grupo de radios es una sola parada (el marcado, o el primero)", () => {
  type E = { id: string; radio?: { name: string; checked: boolean } };
  const info = (e: E) => e.radio ?? null;
  const ids = (l: E[]) => paradasDeTab(l, info).map((e) => e.id);
  const conMarcado: E[] = [
    { id: "chip" },
    { id: "todos", radio: { name: "estado", checked: false } },
    { id: "activo", radio: { name: "estado", checked: true } },
    { id: "baja", radio: { name: "estado", checked: false } },
    { id: "limpiar" },
    { id: "aplicar" },
  ];
  assert.deepEqual(ids(conMarcado), ["chip", "activo", "limpiar", "aplicar"]);
  const sinMarcado: E[] = [
    { id: "a", radio: { name: "g", checked: false } },
    { id: "b", radio: { name: "g", checked: false } },
    { id: "ok" },
  ];
  assert.deepEqual(ids(sinMarcado), ["a", "ok"]);
  // grupos distintos no se mezclan; un radio sin name es su propia parada
  const mezcla: E[] = [
    { id: "x1", radio: { name: "x", checked: false } },
    { id: "y1", radio: { name: "y", checked: true } },
    { id: "x2", radio: { name: "x", checked: true } },
    { id: "suelto", radio: { name: "", checked: false } },
  ];
  assert.deepEqual(ids(mezcla), ["y1", "x2", "suelto"]);
});
