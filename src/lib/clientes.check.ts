/**
 * Self-check del vocabulario de clientes. Correr con:
 *   node --test src/lib/clientes.check.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  estaDeBaja,
  esUuid,
  estadoInfo,
  formatFecha,
  formatFechaAlta,
  hrefSitioWeb,
  mensajeErrorGuardado,
  nombreCompleto,
} from "./clientes.ts";

test("baja logica: inactivo y no_contactar quedan fuera de la lista por defecto", () => {
  assert.equal(estaDeBaja("inactivo"), true);
  assert.equal(estaDeBaja("no_contactar"), true);
  assert.equal(estaDeBaja("potencial"), false);
  assert.equal(estaDeBaja("cliente"), false);
});

test("estadoInfo conoce los cuatro estados y no revienta con uno desconocido", () => {
  assert.equal(estadoInfo("no_contactar").label, "No contactar");
  assert.equal(estadoInfo("raro").label, "raro");
});

test("nombreCompleto no deja espacios de mas", () => {
  assert.equal(nombreCompleto({ nombre: "Ana", apellido: null }), "Ana");
  assert.equal(nombreCompleto({ nombre: "Ana", apellido: "Paz" }), "Ana Paz");
});

test("fechas y links", () => {
  assert.equal(formatFecha("2026-10-04"), "04/10/2026");
  assert.equal(formatFecha("2026-10-04T10:00:00Z"), "04/10/2026");
  assert.equal(hrefSitioWeb("www.club.com.ar"), "https://www.club.com.ar");
  assert.equal(hrefSitioWeb("http://club.com.ar"), "http://club.com.ar");
  assert.equal(hrefSitioWeb("javascript:alert(1)"), null);
});

test("el alta usa la fecha de Buenos Aires, no la del servidor", () => {
  // 01:30 UTC del 5/10 son las 22:30 del 4/10 en Argentina (UTC-3).
  assert.equal(formatFechaAlta("2026-10-05T01:30:00Z"), "04/10/2026");
  assert.equal(formatFechaAlta("2026-10-05T12:00:00Z"), "05/10/2026");
});

test("esUuid filtra ids de la URL", () => {
  assert.equal(esUuid("11111111-1111-1111-1111-111111111111"), true);
  assert.equal(esUuid("nuevo"), false);
  assert.equal(esUuid("1; drop table empresas"), false);
});

test("los errores de la base se traducen", () => {
  const g = "generico";
  assert.match(
    mensajeErrorGuardado({ code: "42501", message: "No tenés permiso para asignar o reasignar el responsable." }, g),
    /asignar/,
  );
  assert.match(mensajeErrorGuardado({ code: "42501", message: "new row violates row-level security" }, g), /rol/);
  assert.match(mensajeErrorGuardado({ code: "23514", message: "El responsable tiene que ser..." }, g), /responsable/);
  assert.match(mensajeErrorGuardado({ code: "23503" }, g), /ya no existe/);
  assert.equal(mensajeErrorGuardado({ code: "XX000" }, g), g);
  assert.equal(mensajeErrorGuardado(null, g), g);
});
