import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acotar,
  acotarNumero,
  deIso,
  diaSemana,
  diasDelMes,
  enRango,
  enmascarar,
  finSemana,
  formatear,
  grillaMes,
  horaDe,
  hoyIso,
  inicioSemana,
  interpretar,
  mesEnRango,
  pasoCircular,
  soloFecha,
  sumarDias,
  sumarMeses,
  textoLargo,
  tituloMes,
} from "./fecha.ts";

test("bisiestos y días por mes", () => {
  assert.equal(diasDelMes(2024, 2), 29);
  assert.equal(diasDelMes(2026, 2), 28);
  assert.equal(diasDelMes(1900, 2), 28); // múltiplo de 100
  assert.equal(diasDelMes(2000, 2), 29); // múltiplo de 400
  assert.equal(diasDelMes(2026, 4), 30);
  assert.equal(diasDelMes(2026, 12), 31);
});

test("deIso valida que la fecha exista", () => {
  assert.deepEqual(deIso("2024-02-29"), { y: 2024, m: 2, d: 29 });
  assert.equal(deIso("2026-02-29"), null);
  assert.equal(deIso("2026-04-31"), null);
  assert.equal(deIso("2026-13-01"), null);
  assert.equal(deIso(""), null);
  assert.deepEqual(deIso("2026-10-06T14:30"), { y: 2026, m: 10, d: 6 });
  assert.equal(soloFecha("2026-10-06T14:30"), "2026-10-06");
  assert.equal(soloFecha("basura"), "");
  assert.deepEqual(horaDe("2026-10-06T14:30"), { h: 14, min: 30 });
  assert.equal(horaDe("2026-10-06T24:00"), null);
  assert.equal(horaDe("2026-10-06"), null);
});

test("hoy en hora local, no UTC", () => {
  // 23:30 del 4/10 en hora local: toISOString() podría dar el 5; hoyIso, el 4.
  assert.equal(hoyIso(new Date(2026, 9, 4, 23, 30)), "2026-10-04");
  assert.equal(hoyIso(new Date(2026, 0, 1, 0, 5)), "2026-01-01");
});

test("aritmética de días y meses sin desbordes", () => {
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(sumarDias("2024-03-01", -1), "2024-02-29");
  assert.equal(sumarDias("2026-03-01", -1), "2026-02-28");
  assert.equal(sumarMeses("2026-01-31", 1), "2026-02-28");
  assert.equal(sumarMeses("2024-01-31", 1), "2024-02-29");
  assert.equal(sumarMeses("2026-12-15", 1), "2027-01-15");
  assert.equal(sumarMeses("2026-01-15", -1), "2025-12-15");
  assert.equal(sumarMeses("2024-02-29", 12), "2025-02-28");
  assert.equal(sumarMeses("2024-02-29", -48), "2020-02-29");
});

test("semana de lunes a domingo", () => {
  assert.equal(diaSemana("2026-10-05"), 0); // lunes
  assert.equal(diaSemana("2026-10-04"), 6); // domingo
  assert.equal(inicioSemana("2026-10-04"), "2026-09-28");
  assert.equal(finSemana("2026-10-06"), "2026-10-11");
});

test("grilla del mes: 6 × 7 desde el lunes", () => {
  const g = grillaMes("2026-10-17");
  assert.equal(g.length, 6);
  assert.ok(g.every((s) => s.length === 7));
  assert.equal(g[0][0], "2026-09-28"); // el 1/10/2026 es jueves
  assert.equal(g[0][3], "2026-10-01");
  assert.equal(g[5][6], "2026-11-08");
  // Febrero de 2027 empieza lunes: la primera celda es el 1.
  assert.equal(grillaMes("2027-02-10")[0][0], "2027-02-01");
  assert.deepEqual(grillaMes("no"), []);
});

test("rango por día (min/max pueden traer hora)", () => {
  assert.equal(enRango("2026-10-04", undefined, "2026-10-04T15:30"), true);
  assert.equal(enRango("2026-10-05", undefined, "2026-10-04T15:30"), false);
  assert.equal(enRango("2026-10-01", "2026-10-02"), false);
  assert.equal(acotar("2026-10-10", "2026-10-01", "2026-10-05"), "2026-10-05");
  assert.equal(acotar("2026-09-10", "2026-10-01", "2026-10-05"), "2026-10-01");
  assert.equal(acotar("2026-10-03", "2026-10-01", "2026-10-05"), "2026-10-03");
  // min > max: ningún día vale.
  assert.equal(enRango(acotar("2026-10-03", "2026-10-09", "2026-10-01"), "2026-10-09", "2026-10-01"), false);
  assert.equal(mesEnRango(2026, 10, "2026-10-09", "2026-10-01"), false);
  assert.equal(mesEnRango(2026, 9, "2026-09-30"), true);
  assert.equal(mesEnRango(2026, 8, "2026-09-30"), false);
});

test("formatear y textos en es-AR", () => {
  assert.equal(formatear("2026-10-06", false), "06/10/2026");
  assert.equal(formatear("2026-10-06T09:05", true), "06/10/2026 09:05");
  assert.equal(formatear("", false), "");
  assert.equal(formatear("2026-02-30", false), "");
  assert.equal(textoLargo("2026-10-06"), "martes 6 de octubre de 2026");
  assert.equal(textoLargo("2026-10-04"), "domingo 4 de octubre de 2026");
  assert.equal(tituloMes("2026-10-06"), "Octubre 2026");
});

test("máscara: barras solas, cero adelante, borrar no reacomoda", () => {
  assert.equal(enmascarar("06", false, true), "06/");
  assert.equal(enmascarar("0610", false, true), "06/10/");
  assert.equal(enmascarar("06102026", false, true), "06/10/2026");
  assert.equal(enmascarar("061020269", false, true), "06/10/2026"); // sin hora no sobra nada
  assert.equal(enmascarar("6/", false, true), "06/");
  assert.equal(enmascarar("6/10/2026", false, true), "6/10/2026"); // pegado: se respeta
  assert.equal(enmascarar("06//", false, true), "06/");
  assert.equal(enmascarar("ab06", false, true), "06/");
  assert.equal(enmascarar("06/", false, false), "06/");
  assert.equal(enmascarar("06", false, false), "06"); // Backspace sobre la barra
  assert.equal(enmascarar("061020261430", true, true), "06/10/2026 14:30");
  assert.equal(enmascarar("06/10/2026", true, true), "06/10/2026 ");
  assert.equal(enmascarar("06/10/2026 9:", true, true), "06/10/2026 09:");
});

test("interpretar: válido, inexistente, formato, rango", () => {
  assert.deepEqual(interpretar("", false), { valor: "" });
  assert.deepEqual(interpretar("  ", true), { valor: "" });
  assert.deepEqual(interpretar("06/10/2026", false), { valor: "2026-10-06" });
  assert.deepEqual(interpretar("6/10/2026", false), { valor: "2026-10-06" });
  assert.deepEqual(interpretar("29/02/2024", false), { valor: "2024-02-29" });
  assert.deepEqual(interpretar("29/02/2026", false), { error: "El 29/02/2026 no existe." });
  assert.deepEqual(interpretar("31/04/2026", false), { error: "El 31/04/2026 no existe." });
  assert.deepEqual(interpretar("06/10/26", false), { error: "Escribí la fecha como dd/mm/aaaa." });
  assert.deepEqual(interpretar("06/10/2026 10:00", false), { error: "Escribí la fecha como dd/mm/aaaa." });
  assert.deepEqual(interpretar("06/10/2026", true), { error: "Escribí la fecha como dd/mm/aaaa hh:mm." });
  assert.deepEqual(interpretar("06/10/2026 14:30", true), { valor: "2026-10-06T14:30" });
  assert.deepEqual(interpretar("06/10/2026 24:00", true), { error: "La hora va de 00:00 a 23:59." });
  assert.deepEqual(interpretar("05/10/2026", false, undefined, "2026-10-04T15:00"), { error: "Elegí una fecha hasta el 04/10/2026." });
  assert.deepEqual(interpretar("01/09/2026", false, "2026-10-01"), { error: "Elegí una fecha desde el 01/10/2026." });
  assert.deepEqual(interpretar("01/09/2026", false, "2026-10-01", "2026-10-31"), { error: "Elegí una fecha entre el 01/10/2026 y el 31/10/2026." });
  assert.deepEqual(interpretar("01/10/2026", false, "2026-10-09", "2026-10-01"), { error: "No hay fechas disponibles." });
  // El día del tope vale con cualquier hora: la hora contra el tope la valida quien llama.
  assert.deepEqual(interpretar("04/10/2026 23:00", true, undefined, "2026-10-04T15:00"), { valor: "2026-10-04T23:00" });
});

test("hora y minutos: tope al tipear, vuelta con flechas", () => {
  assert.equal(acotarNumero("7", 23, 0), 7);
  assert.equal(acotarNumero("99", 23, 0), 23);
  assert.equal(acotarNumero("", 59, 12), 12);
  assert.equal(pasoCircular(23, 1, 23), 0);
  assert.equal(pasoCircular(0, -1, 59), 59);
  assert.equal(pasoCircular(10, 1, 59), 11);
});
