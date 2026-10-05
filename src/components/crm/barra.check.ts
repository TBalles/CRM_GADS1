import assert from "node:assert/strict";
import { test } from "node:test";
import { anchoBarra, porcentajeDe } from "./barra.ts";

test("anchoBarra: proporcional al mayor, con piso de 2 % y sin barra para el cero", () => {
  assert.equal(anchoBarra(3, 3), 100);
  assert.equal(anchoBarra(2, 3), (2 / 3) * 100);
  // Empresas con más valor en juego de la demo: $152.000 contra $1.900.000.
  assert.equal(anchoBarra(152_000, 1_900_000), 8);
  assert.equal(anchoBarra(1, 1000), 2);
  assert.equal(anchoBarra(0, 10), 0);
  assert.equal(anchoBarra(-5, 10), 0);
  assert.equal(anchoBarra(5, 0), 0);
  assert.equal(anchoBarra(Number.NaN, 10), 0);
  assert.equal(anchoBarra(20, 10), 100);
});

test("porcentajeDe: la misma cuenta que la leyenda de la distribución del embudo", () => {
  // Demo, Administrador: 15 oportunidades; 2 en Consulta recibida (13 %), 3 en Relevamiento (20 %).
  assert.equal(porcentajeDe(2, 15), 13);
  assert.equal(porcentajeDe(3, 15), 20);
  // Vendedor: 8 oportunidades; 1 → 13 %, 2 → 25 %.
  assert.equal(porcentajeDe(1, 8), 13);
  assert.equal(porcentajeDe(2, 8), 25);
  assert.equal(porcentajeDe(0, 0), 0);
  assert.equal(porcentajeDe(4, 4), 100);
});

test("porcentajeDe: las filas redondeadas no suman 100 (por eso el pie de Inicio no dice «100 %»)", () => {
  const suma = (cantidades: number[]) => {
    const total = cantidades.reduce((a, b) => a + b, 0);
    return cantidades.reduce((a, c) => a + porcentajeDe(c, total), 0);
  };
  // Demo: Administrador (15 en 6 etapas) y Vendedor (8 en 6 etapas).
  assert.equal(suma([2, 3, 2, 3, 2, 3]), 99);
  assert.equal(suma([1, 2, 1, 1, 2, 1]), 102);
});
