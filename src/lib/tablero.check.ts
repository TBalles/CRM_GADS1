/**
 * Self-check del tablero del responsable. Correr con:
 *   node --test src/lib/tablero.check.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  VENTANA_ACTIVIDADES_DIAS,
  coberturaActividades,
  diasParam,
  mesParam,
  mesesDisponibles,
  pipelinePorResponsable,
  rangoMes,
  rankingMotivos,
  resumenCierres,
  sinActividad,
  sumarDias,
} from "./tablero.ts";

test("?dias= solo acepta 7, 14 o 30", () => {
  assert.equal(diasParam("7"), 7);
  assert.equal(diasParam("30"), 30);
  assert.equal(diasParam(["14", "7"]), 14);
  for (const malo of [undefined, "", "0", "8", "-7", "abc", "7.5", "1e1", "30; drop table"]) assert.equal(diasParam(malo), 14, String(malo));
});

test("?mes= valida el formato y el calendario; lo inválido vale el mes de hoy", () => {
  const hoy = "2026-10-04";
  assert.equal(mesParam("2026-09", hoy), "2026-09");
  assert.equal(mesParam("2025-12", hoy), "2025-12");
  for (const malo of [undefined, "", "2026-13", "2026-00", "2026-9", "26-09", "1999-12", "2101-01", "2026-09-01", "abc", "2026-09\n"]) {
    assert.equal(mesParam(malo, hoy), "2026-10", String(malo));
  }
});

test("rango del mes: de su primer día al primero del siguiente (exclusivo), también en diciembre", () => {
  assert.deepEqual(rangoMes("2026-09"), { desde: "2026-09-01", hasta: "2026-10-01" });
  assert.deepEqual(rangoMes("2026-12"), { desde: "2026-12-01", hasta: "2027-01-01" });
  assert.deepEqual(rangoMes("2024-02"), { desde: "2024-02-01", hasta: "2024-03-01" });
});

test("sumarDias cruza meses y años sin zona horaria", () => {
  assert.equal(sumarDias("2026-10-04", -120), "2026-06-06");
  assert.equal(sumarDias("2026-01-01", -1), "2025-12-31");
  assert.equal(sumarDias("2024-02-28", 2), "2024-03-01");
});

test("meses disponibles: el actual primero, hacia atrás, y el elegido entra aunque sea viejo", () => {
  const m = mesesDisponibles("2026-02-10", "2026-02", 3);
  assert.deepEqual(m.map((x) => x.value), ["2026-02", "2026-01", "2025-12"]);
  assert.equal(m[0].label, "febrero de 2026");
  assert.deepEqual(mesesDisponibles("2026-02-10", "2020-05", 2).map((x) => x.value), ["2026-02", "2026-01", "2020-05"]);
});

test("cobertura de actividades: el borde de la ventana, o la más vieja leída si se cortó en el tope", () => {
  assert.equal(VENTANA_ACTIVIDADES_DIAS, 120);
  assert.equal(coberturaActividades("2026-10-04", false, "2026-09-30"), "2026-06-06");
  assert.equal(coberturaActividades("2026-10-04", true, "2026-09-30"), "2026-09-30");
  assert.equal(coberturaActividades("2026-10-04", true, "2026-01-01"), "2026-06-06"); // leyó más de lo necesario
  assert.equal(coberturaActividades("2026-10-04", true, null), "2026-06-06");
});

const HOY = "2026-10-04";
const COB = "2026-06-06";
// created_at al mediodía UTC = 09:00 en Buenos Aires: el día no se corre.
const op = (id: string, creada: string, extra: Record<string, unknown> = {}) => ({
  id,
  titulo: `Op ${id}`,
  monto: 1000,
  responsable_id: "v1",
  empresa_id: null,
  contacto_id: null,
  created_at: `${creada}T12:00:00Z`,
  ...extra,
});
const act = (dia: string, extra: Record<string, unknown> = {}) => ({
  oportunidad_id: null,
  empresa_id: null,
  contacto_id: null,
  ocurrido_en: `${dia}T15:00:00Z`,
  ...extra,
});

test("sin actividad: el día del umbral ya cuenta y el anterior no", () => {
  // 2026-10-04 menos 14 días = 2026-09-20
  const r14 = sinActividad([op("a", "2026-01-01"), op("b", "2026-01-01")], [act("2026-09-20", { oportunidad_id: "a" }), act("2026-09-21", { oportunidad_id: "b" })], HOY, 14, COB);
  assert.deepEqual(r14.map((x) => [x.id, x.dias]), [["a", 14]]); // b tiene 13: todavía no
  const r7 = sinActividad([op("b", "2026-01-01")], [act("2026-09-21", { oportunidad_id: "b" })], HOY, 7, COB);
  assert.deepEqual(r7.map((x) => [x.id, x.dias]), [["b", 13]]);
});

test("sin actividad: cuenta la de la propia oportunidad, la de su empresa y la de su contacto; gana la más reciente", () => {
  const o = op("a", "2026-01-01", { empresa_id: "e1", contacto_id: "c1" });
  const base = (acts: ReturnType<typeof act>[]) => sinActividad([o], acts, HOY, 7, COB)[0];

  assert.equal(base([act("2026-08-01", { oportunidad_id: "a" })]).ultima, "2026-08-01");
  assert.equal(base([act("2026-08-01", { oportunidad_id: "a" })]).base, "oportunidad");

  const porEmpresa = base([act("2026-08-01", { oportunidad_id: "a" }), act("2026-09-01", { empresa_id: "e1" })]);
  assert.equal(porEmpresa.ultima, "2026-09-01");
  assert.equal(porEmpresa.base, "cliente");
  assert.equal(porEmpresa.dias, 33);

  // otra empresa, otro contacto u otra oportunidad no cuentan
  const ajenas = base([act("2026-09-30", { empresa_id: "e2" }), act("2026-09-30", { contacto_id: "c2" }), act("2026-09-30", { oportunidad_id: "z" })]);
  assert.equal(ajenas.base, "alta");
  assert.equal(ajenas.ultima, "2026-06-06");

  // a igual fecha, manda la de la oportunidad
  assert.equal(base([act("2026-09-01", { empresa_id: "e1" }), act("2026-09-01", { oportunidad_id: "a" })]).base, "oportunidad");
});

test("sin actividad: la que nunca tuvo se cuenta desde el alta; si el alta es anterior a lo leído, es un piso ('más de')", () => {
  const nueva = sinActividad([op("n", "2026-09-10")], [], HOY, 14, COB)[0];
  assert.equal(nueva.dias, 24);
  assert.equal(nueva.base, "alta");
  assert.equal(nueva.masDe, false);

  const vieja = sinActividad([op("v", "2025-01-01")], [], HOY, 14, COB)[0];
  assert.equal(vieja.dias, 120);
  assert.equal(vieja.masDe, true);

  // una oportunidad de hoy nunca aparece, aunque no tenga actividad
  assert.deepEqual(sinActividad([op("h", "2026-10-04")], [], HOY, 7, COB), []);
});

test("sin actividad: si la lectura se cortó y no llega tan atrás como el umbral, la fila no se descarta: va al final como incierta", () => {
  // la lectura solo cubre desde el 30/09 (4 días) y el umbral es 14: una oportunidad vieja sin actividad en ese tramo
  const filas = sinActividad(
    [op("vieja", "2025-01-01"), op("nueva", "2026-10-01"), op("con", "2025-01-01"), op("quieta", "2026-09-01")],
    [act("2026-10-02", { oportunidad_id: "con" })],
    HOY,
    14,
    "2026-09-30",
  );
  // "con" tiene actividad hace 2 días: fuera. "nueva" nació dentro de lo leído (hace 3 días): fuera.
  // "quieta" se creó el 01/09 (antes de lo leído) y no tiene actividad leída: incierta, igual que "vieja".
  assert.deepEqual(filas.map((f) => [f.id, f.dias, f.incierta]), [["quieta", 4, true], ["vieja", 4, true]]);
  assert.ok(filas.every((f) => f.masDe));
  // con cobertura que sí llega al umbral, la misma oportunidad es una quieta cierta
  const cierta = sinActividad([op("vieja", "2025-01-01")], [], HOY, 14, "2026-09-01");
  assert.deepEqual(cierta.map((f) => [f.dias, f.incierta]), [[33, false]]);
});

test("sin actividad: el día se cuenta en horario argentino", () => {
  // 01:00 UTC del 21/09 = 22:00 del 20/09 en Buenos Aires -> son 14 días justos al 04/10
  const r = sinActividad([op("a", "2026-01-01")], [{ ...act("2026-09-21", { oportunidad_id: "a" }), ocurrido_en: "2026-09-21T01:00:00Z" }], HOY, 14, COB);
  assert.equal(r[0]?.ultima, "2026-09-20");
  assert.equal(r[0]?.dias, 14);
});

test("sin actividad: orden por días, después por valor, y resultado estable", () => {
  const filas = sinActividad(
    [op("a", "2026-01-01", { monto: 10 }), op("b", "2026-01-01", { monto: 500 }), op("c", "2026-01-01", { monto: 10 })],
    [act("2026-09-01", { oportunidad_id: "a" }), act("2026-09-01", { oportunidad_id: "b" }), act("2026-08-01", { oportunidad_id: "c" })],
    HOY,
    7,
    COB,
  );
  assert.deepEqual(filas.map((f) => f.id), ["c", "b", "a"]);
  // monto null o texto no rompen
  assert.equal(sinActividad([op("x", "2026-01-01", { monto: null })], [], HOY, 7, COB)[0].monto, 0);
  assert.equal(sinActividad([op("x", "2026-01-01", { monto: "2500.50" })], [], HOY, 7, COB)[0].monto, 2500.5);
});

test("pipeline por vendedor: monto y cantidad por responsable, el que ya no se ve va a 'Sin responsable'", () => {
  const nombres = new Map([["v1", "Ana"], ["v2", "Beto"]]);
  const r = pipelinePorResponsable(
    [
      { responsable_id: "v1", monto: 100 },
      { responsable_id: "v1", monto: "50" },
      { responsable_id: "v2", monto: 1000 },
      { responsable_id: null, monto: 7 },
      { responsable_id: "baja", monto: 3 }, // un perfil que no se ve
      { responsable_id: "v2", monto: null },
    ],
    nombres,
  );
  assert.deepEqual(r, [
    { key: "v2", label: "Beto", cantidad: 2, monto: 1000 },
    { key: "v1", label: "Ana", cantidad: 2, monto: 150 },
    { key: "sin-responsable", label: "Sin responsable", cantidad: 2, monto: 10 },
  ]);
});

test("cierres del mes: cuenta y suma ganadas y perdidas; ignora lo que no es cierre", () => {
  assert.deepEqual(
    resumenCierres([
      { estado: "ganada", monto: 1000 },
      { estado: "ganada", monto: "250.5" },
      { estado: "perdida", monto: 400 },
      { estado: "abierta", monto: 99999 },
      { estado: "ganada", monto: null },
    ]),
    { ganadas: { cantidad: 3, monto: 1250.5 }, perdidas: { cantidad: 1, monto: 400 } },
  );
  assert.deepEqual(resumenCierres([]), { ganadas: { cantidad: 0, monto: 0 }, perdidas: { cantidad: 0, monto: 0 } });
});

test("ranking de motivos: por cantidad, desempata por valor, y el sin motivo no se pierde", () => {
  const motivos = new Map([["m1", "Precio"], ["m2", "Plazo"], ["m3", "Competencia"]]);
  const r = rankingMotivos(
    [
      { motivo_perdida_id: "m2", monto: 10 },
      { motivo_perdida_id: "m1", monto: 5 },
      { motivo_perdida_id: "m1", monto: 5 },
      { motivo_perdida_id: "m3", monto: 900 },
      { motivo_perdida_id: "m3", monto: 100 },
      { motivo_perdida_id: null, monto: 1 },
      { motivo_perdida_id: "borrado", monto: 1 },
    ],
    motivos,
  );
  assert.deepEqual(r.map((x) => [x.label, x.cantidad, x.monto]), [
    ["Competencia", 2, 1000],
    ["Precio", 2, 10],
    ["Sin motivo cargado", 2, 2],
    ["Plazo", 1, 10],
  ]);
});
