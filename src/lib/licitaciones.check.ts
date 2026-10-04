/**
 * Self-check de las reglas de licitaciones: node --test src/lib/licitaciones.check.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { diasEntre } from "./clientes.ts";
import { bloqueoGanada, datosApertura, filaLicitacion, textoApertura, validarLicitacion } from "./licitaciones.ts";

const HOY = "2026-10-04";

test("una licitacion no se gana antes de su apertura, pero el mismo dia si", () => {
  assert.match(bloqueoGanada({ fechaApertura: "2026-12-15" }, HOY) ?? "", /antes de la apertura \(15\/12\/2026\)/);
  assert.match(bloqueoGanada({ fechaApertura: "2026-10-05" }, HOY) ?? "", /antes de la apertura/);
  assert.equal(bloqueoGanada({ fechaApertura: HOY }, HOY), null);
  assert.equal(bloqueoGanada({ fechaApertura: "2026-09-01" }, HOY), null);
});

test("sin datos de licitacion se pide cargarlos; si no es licitacion no se bloquea nada", () => {
  assert.match(bloqueoGanada({ fechaApertura: null }, HOY) ?? "", /Cargá los datos de la licitación/);
  assert.equal(bloqueoGanada(undefined, HOY), null);
  assert.equal(bloqueoGanada(null, HOY), null);
});

test("diasEntre y textoApertura no dependen de la zona horaria", () => {
  assert.equal(diasEntre("2026-10-04", "2026-10-06"), 2);
  assert.equal(diasEntre("2026-10-04", "2026-10-03"), -1);
  assert.equal(diasEntre("2026-02-28", "2026-03-01"), 1);
  assert.equal(textoApertura("2026-10-04", HOY), "Abre hoy");
  assert.equal(textoApertura("2026-10-05", HOY), "Abre mañana");
  assert.equal(textoApertura("2026-10-09", HOY), "Abre en 5 días");
  assert.equal(textoApertura("2026-10-03", HOY), "Abrió ayer");
  assert.equal(textoApertura("2026-09-24", HOY), "Abrió hace 10 días");
});

test("el formulario exige organismo y una fecha de apertura que exista", () => {
  const ok = { expediente: "", organismo: "Municipalidad de Tigre", fechaApertura: "2026-11-20", montoOficial: null, garantia: "" };
  assert.deepEqual(validarLicitacion(ok), {});
  assert.ok(validarLicitacion({ ...ok, organismo: "  " }).organismo);
  assert.ok(validarLicitacion({ ...ok, fechaApertura: "" }).fechaApertura);
  assert.ok(validarLicitacion({ ...ok, fechaApertura: "2026-02-31" }).fechaApertura);
  assert.match(validarLicitacion({ ...ok, montoOficial: -5 }).montoOficial ?? "", /negativo/);
  assert.match(validarLicitacion({ ...ok, montoOficial: NaN }).montoOficial ?? "", /monto válido/);
  assert.match(validarLicitacion({ ...ok, montoOficial: 1e12 }).montoOficial ?? "", /demasiado grande/);
  assert.equal(validarLicitacion({ ...ok, montoOficial: 999_999_999_999.99 }).montoOficial, undefined);
  assert.equal(validarLicitacion({ ...ok, montoOficial: 0 }).montoOficial, undefined);
  assert.ok(validarLicitacion({ ...ok, expediente: "x".repeat(201) }).expediente);
});

test("lo que se guarda lleva null en los textos vacios", () => {
  assert.deepEqual(
    filaLicitacion({ expediente: " EX-1 ", organismo: " Munic ", fechaApertura: "2026-11-20", montoOficial: 1500000, garantia: "  " }),
    { expediente: "EX-1", organismo: "Munic", fecha_apertura: "2026-11-20", monto_oficial: 1500000, garantia: null },
  );
});

test("datosApertura solo existe para licitaciones con las tablas del rubro activas", () => {
  assert.equal(datosApertura("directa", true, null), undefined);
  assert.equal(datosApertura("licitacion", false, { fecha_apertura: "2026-12-01" }), undefined);
  assert.deepEqual(datosApertura("licitacion", true, { fecha_apertura: "2026-12-01" }), { fechaApertura: "2026-12-01" });
  assert.deepEqual(datosApertura("licitacion", true, null), { fechaApertura: null });
});
