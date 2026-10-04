/**
 * Self-check de la conversión del embudo, con fixtures calculados a mano. Correr con:
 *   node --test src/lib/embudo.check.ts
 *
 * Etapas: A(1) B(2) C(3) abiertas; G ganada; P perdida. Medición: 2026-03-31 12:00 UTC.
 *
 *  O1 normal:       A 01/01 -> B 03/01 -> C 07/01 -> G 08/01   (ganada, cierre 08/01)
 *  O2 se salta B:   A 01/01 -> C 05/01 -> P 10/01              (perdida, cierre 10/01)
 *  O3 vuelve atrás: A 01/01 -> C 02/01 -> B 04/01              (abierta, sigue en B)
 *  O4 reabierta:    A 01/01 -> B 02/01 -> G 03/01 -> B 10/01 -> G 12/01   (ganada, cierre vigente 12/01)
 *  O5 trabada:      A 01/03                                    (abierta, sigue en A)
 *
 * Estadías (días):  A: O1 2, O2 4, O3 1, O4 1 (+ O5 en curso 30)
 *                   B: O1 4, O4 1 y 2 (+ O3 en curso 86)
 *                   C: O1 1, O2 5, O3 2
 */
import assert from "node:assert/strict";
import test from "node:test";

import { ORIGEN_SIN, calcularEmbudo, filtrarCohorte, formatDias, formatPorcentaje, mediana } from "./embudo.ts";

const etapas = [
  { id: "P", nombre: "Perdida", tipo: "perdida", orden: 6 },
  { id: "C", nombre: "Negociación", tipo: "abierta", orden: 3 },
  { id: "A", nombre: "Consulta", tipo: "abierta", orden: 1 },
  { id: "G", nombre: "Entregado", tipo: "ganada", orden: 5 },
  { id: "B", nombre: "Presupuesto", tipo: "abierta", orden: 2 },
];

const t = (mmdd: string) => `2026-${mmdd}T12:00:00Z`;
const cambio = (op: string, etapa: string, mmdd: string) => ({ oportunidad_id: op, etapa_nueva_id: etapa, cambiado_en: t(mmdd) });

const oportunidades = [
  { id: "O1", estado: "ganada", etapa_id: "G", created_at: t("01-01"), fecha_cierre: "2026-01-08", origen_id: "web" },
  { id: "O2", estado: "perdida", etapa_id: "P", created_at: t("01-01"), fecha_cierre: "2026-01-10", origen_id: "web" },
  { id: "O3", estado: "abierta", etapa_id: "B", created_at: t("01-01"), fecha_cierre: null, origen_id: null },
  { id: "O4", estado: "ganada", etapa_id: "G", created_at: t("01-01"), fecha_cierre: "2026-01-12", origen_id: "feria" },
  { id: "O5", estado: "abierta", etapa_id: "A", created_at: t("03-01"), fecha_cierre: null, origen_id: "web" },
];

const cambios = [
  cambio("O1", "A", "01-01"), cambio("O1", "B", "01-03"), cambio("O1", "C", "01-07"), cambio("O1", "G", "01-08"),
  cambio("O2", "A", "01-01"), cambio("O2", "C", "01-05"), cambio("O2", "P", "01-10"),
  cambio("O3", "A", "01-01"), cambio("O3", "C", "01-02"), cambio("O3", "B", "01-04"),
  cambio("O4", "A", "01-01"), cambio("O4", "B", "01-02"), cambio("O4", "G", "01-03"), cambio("O4", "B", "01-10"), cambio("O4", "G", "01-12"),
  cambio("O5", "A", "03-01"),
];

const ahora = "2026-03-31T12:00:00Z";

test("mediana", () => {
  assert.equal(mediana([]), null);
  assert.equal(mediana([5]), 5);
  assert.equal(mediana([4, 1, 2]), 2);
  assert.equal(mediana([4, 1, 2, 1]), 1.5);
});

test("las etapas salen solo las abiertas y en el orden configurado", () => {
  const r = calcularEmbudo({ etapas, oportunidades, cambios, ahora });
  assert.deepEqual(r.etapas.map((f) => f.etapa.id), ["A", "B", "C"]);
});

test("etapa A: entraron 5, avanzaron 4 (la trabada no), mediana 1,5 d terminadas y 2 d contando la que sigue", () => {
  const a = calcularEmbudo({ etapas, oportunidades, cambios, ahora }).etapas[0];
  assert.equal(a.entraron, 5);
  assert.equal(a.avanzaron, 4);
  assert.equal(a.conversion, 0.8);
  assert.equal(a.enEtapaAhora, 1);
  assert.equal(a.estadias, 4); // 2, 4, 1, 1
  assert.equal(a.medianaDias, 1.5);
  assert.equal(a.medianaHastaHoyDias, 2); // [1, 1, 2, 4, 30]
});

test("etapa B: la que se la salteó no entra; la que vuelve atrás no avanza; la reabierta cuenta una vez y dos estadías", () => {
  const b = calcularEmbudo({ etapas, oportunidades, cambios, ahora }).etapas[1];
  assert.equal(b.entraron, 3); // O1, O3, O4 (O2 saltó B)
  assert.equal(b.avanzaron, 2); // O1 -> C; O4 -> G. O3 llegó a B volviendo desde C: nada después
  assert.equal(b.conversion, 2 / 3);
  assert.equal(b.enEtapaAhora, 1); // O3
  assert.equal(b.estadias, 3); // O1 4 d; O4 1 d y 2 d
  assert.equal(b.medianaDias, 2);
  assert.equal(b.medianaHastaHoyDias, 3); // [1, 2, 4, 86]
});

test("etapa C: perder o volver atrás no es avanzar", () => {
  const c = calcularEmbudo({ etapas, oportunidades, cambios, ahora }).etapas[2];
  assert.equal(c.entraron, 3); // O1, O2, O3
  assert.equal(c.avanzaron, 1); // solo O1 -> G
  assert.equal(c.conversion, 1 / 3);
  assert.equal(c.enEtapaAhora, 0);
  assert.equal(c.medianaDias, 2); // [1, 5, 2]
  assert.equal(c.medianaHastaHoyDias, 2); // sin estadías en curso, igual
});

test("totales: éxito 2 de 3 cerradas; ciclo = alta -> cierre vigente", () => {
  const r = calcularEmbudo({ etapas, oportunidades, cambios, ahora });
  assert.equal(r.total, 5);
  assert.equal(r.abiertas, 2);
  assert.equal(r.ganadas, 2);
  assert.equal(r.perdidas, 1);
  assert.equal(r.tasaExito, 2 / 3);
  assert.equal(r.cicloGanadasDias, 9); // O1 7 d, O4 11 d
  assert.equal(r.cicloPerdidasDias, 9); // O2
  assert.equal(r.sinHistorial, 0);
});

test("sin cierres no hay tasa ni ciclo; sin oportunidades todo en cero", () => {
  const solo = calcularEmbudo({ etapas, oportunidades: [oportunidades[4]], cambios: [cambios[15]], ahora });
  assert.equal(solo.tasaExito, null);
  assert.equal(solo.cicloGanadasDias, null);
  assert.equal(solo.etapas[0].medianaDias, null); // la única estadía sigue en curso
  assert.equal(solo.etapas[0].medianaHastaHoyDias, 30);
  assert.equal(solo.etapas[0].conversion, 0);

  const nada = calcularEmbudo({ etapas, oportunidades: [], cambios: [], ahora });
  assert.equal(nada.total, 0);
  assert.equal(nada.etapas[0].conversion, null);
  assert.equal(nada.etapas[0].medianaHastaHoyDias, null);
});

test("una oportunidad sin historial se supone en su etapa actual desde el alta, y se avisa", () => {
  const r = calcularEmbudo({
    etapas,
    oportunidades: [{ id: "X", estado: "abierta", etapa_id: "B", created_at: t("03-21"), fecha_cierre: null, origen_id: null }],
    cambios: [],
    ahora,
  });
  assert.equal(r.sinHistorial, 1);
  assert.equal(r.etapas[1].entraron, 1);
  assert.equal(r.etapas[1].medianaHastaHoyDias, 10);
});

test("no importa en qué orden llega el historial", () => {
  const normal = calcularEmbudo({ etapas, oportunidades, cambios, ahora });
  const revuelto = calcularEmbudo({ etapas, oportunidades, cambios: [...cambios].reverse(), ahora });
  assert.deepEqual(revuelto, normal);
});

test("filas con el mismo instante: estadía de 0 días y el orden de llegada decide dónde queda", () => {
  const r = calcularEmbudo({
    etapas,
    oportunidades: [{ id: "Y", estado: "abierta", etapa_id: "C", created_at: t("01-01"), fecha_cierre: null, origen_id: null }],
    cambios: [cambio("Y", "A", "01-01"), cambio("Y", "B", "01-01"), cambio("Y", "C", "01-01")],
    ahora: t("01-11"),
  });
  assert.equal(r.etapas[0].medianaDias, 0);
  assert.equal(r.etapas[0].avanzaron, 1);
  assert.equal(r.etapas[2].enEtapaAhora, 1);
  assert.equal(r.etapas[2].medianaHastaHoyDias, 10);
});

test("la cohorte: por fecha de alta en horario argentino (inclusive) y por origen", () => {
  const ops = [
    { id: "a", created_at: "2026-02-01T02:00:00Z", origen_id: "web" }, // 31/01 23:00 en AR
    { id: "b", created_at: "2026-02-01T03:00:00Z", origen_id: "feria" }, // 01/02 00:00 en AR
    { id: "c", created_at: "2026-02-28T20:00:00Z", origen_id: null },
    { id: "d", created_at: "2026-03-01T02:59:00Z", origen_id: "web" }, // 28/02 23:59 en AR
    { id: "e", created_at: "2026-03-01T03:00:00Z", origen_id: "web" }, // 01/03 en AR
  ];
  const ids = (f: Parameters<typeof filtrarCohorte>[1]) => filtrarCohorte(ops, f).map((o) => o.id);
  assert.deepEqual(ids({}), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(ids({ desde: "2026-02-01", hasta: "2026-02-28" }), ["b", "c", "d"]);
  assert.deepEqual(ids({ desde: "2026-03-01" }), ["e"]);
  assert.deepEqual(ids({ hasta: "2026-01-31" }), ["a"]);
  assert.deepEqual(ids({ origen: "web" }), ["a", "d", "e"]);
  assert.deepEqual(ids({ origen: ORIGEN_SIN }), ["c"]);
  assert.deepEqual(ids({ origen: "web", desde: "2026-02-01", hasta: "2026-02-28" }), ["d"]);
});

test("formatos: días y porcentajes en castellano", () => {
  assert.equal(formatDias(null), "—");
  assert.equal(formatDias(0.4), "menos de 1 día");
  assert.equal(formatDias(1), "1 día");
  assert.equal(formatDias(1.5), "1,5 días");
  assert.equal(formatDias(12), "12 días");
  assert.equal(formatPorcentaje(null), "—");
  assert.equal(formatPorcentaje(2 / 3), "66,7%");
  assert.equal(formatPorcentaje(1), "100%");
  assert.equal(formatPorcentaje(0), "0%");
});
