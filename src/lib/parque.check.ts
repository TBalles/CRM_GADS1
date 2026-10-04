/**
 * Self-check del parque instalado: node --test src/lib/parque.check.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparParque, filaParque, sumarMeses, textoVidaUtil, totalUnidades, type ItemParque } from "./parque.ts";

const HOY = "2026-10-04";

const item = (extra: Partial<ItemParque> = {}): ItemParque => ({
  id: "i",
  producto: "Arco",
  categoria: "Arcos",
  cantidad: 1,
  fechaEntrega: "2024-10-04",
  vidaUtilMeses: 24,
  ...extra,
});

test("sumarMeses se comporta como date + make_interval de Postgres", () => {
  assert.equal(sumarMeses("2024-10-04", 24), "2026-10-04");
  assert.equal(sumarMeses("2026-01-31", 1), "2026-02-28");
  assert.equal(sumarMeses("2024-01-31", 1), "2024-02-29");
  assert.equal(sumarMeses("2026-11-15", 3), "2027-02-15");
  assert.equal(sumarMeses("2026-12-31", 12), "2027-12-31");
  assert.equal(sumarMeses("2026-03-31", 11), "2027-02-28");
});

test("el estado sale de los dias restantes: vence hoy es vencido, 60 es por vencer, 61 es vigente", () => {
  // vence el 2026-10-04 (hoy)
  assert.equal(filaParque(item(), HOY).estado, "vencido");
  assert.equal(filaParque(item(), HOY).diasRestantes, 0);
  // vencido hace 1 dia
  assert.equal(filaParque(item({ fechaEntrega: "2024-10-03" }), HOY).diasRestantes, -1);
  // vence en 60 dias (2026-12-03)
  const sesenta = filaParque(item({ fechaEntrega: "2024-12-03" }), HOY);
  assert.equal(sesenta.diasRestantes, 60);
  assert.equal(sesenta.estado, "por_vencer");
  // vence en 61 dias
  assert.equal(filaParque(item({ fechaEntrega: "2024-12-04" }), HOY).estado, "vigente");
});

test("sin vida util o sin fecha de entrega no hay reloj", () => {
  const sinVida = filaParque(item({ vidaUtilMeses: null }), HOY);
  assert.equal(sinVida.estado, "sin_seguimiento");
  assert.equal(sinVida.venceEl, null);
  assert.equal(sinVida.diasRestantes, null);
  assert.equal(filaParque(item({ fechaEntrega: null }), HOY).estado, "sin_seguimiento");
});

test("agrupa lo urgente primero, ordena por lo que antes vence y suma unidades", () => {
  const grupos = agruparParque(
    [
      item({ id: "v1", producto: "Red", cantidad: 4, fechaEntrega: "2025-01-01", vidaUtilMeses: 12 }), // vence 2026-01-01: vencido
      item({ id: "g1", producto: "Pelota", cantidad: 10, fechaEntrega: "2026-09-01", vidaUtilMeses: 36 }), // vigente
      item({ id: "p1", producto: "Arco", cantidad: 2, fechaEntrega: "2024-11-20", vidaUtilMeses: 24 }), // vence 2026-11-20: por vencer
      item({ id: "v0", producto: "Cono", cantidad: 1, fechaEntrega: "2024-06-01", vidaUtilMeses: 24 }), // vence 2026-06-01: vencido, mas reciente que v1
      item({ id: "s1", producto: "Kit", cantidad: 3, vidaUtilMeses: null }),
    ],
    HOY,
  );
  assert.deepEqual(grupos.map((g) => g.estado), ["vencido", "por_vencer", "vigente", "sin_seguimiento"]);
  assert.deepEqual(grupos[0].filas.map((f) => f.id), ["v1", "v0"]);
  assert.deepEqual(grupos.map((g) => g.unidades), [5, 2, 10, 3]);
  assert.equal(totalUnidades(grupos.flatMap((g) => g.filas)), 20);
});

test("un grupo vacio no aparece y sin items no hay grupos", () => {
  assert.deepEqual(agruparParque([], HOY), []);
  assert.deepEqual(agruparParque([item({ vidaUtilMeses: null })], HOY).map((g) => g.estado), ["sin_seguimiento"]);
});

test("la vida util restante se dice en dias hasta 60 y en meses despues", () => {
  const texto = (extra: Partial<ItemParque>) => textoVidaUtil(filaParque(item(extra), HOY));
  assert.equal(texto({}), "Vence hoy");
  assert.equal(texto({ fechaEntrega: "2024-10-03" }), "Venció hace 1 d");
  assert.equal(texto({ fechaEntrega: "2024-12-03" }), "Vence en 60 d");
  assert.equal(texto({ fechaEntrega: "2025-02-04" }), "Vence en 4 meses");
  assert.equal(texto({ fechaEntrega: "2023-10-04" }), "Venció hace 12 meses");
  assert.equal(texto({ vidaUtilMeses: null }), "Sin seguimiento de recambio");
});
