/**
 * Self-check de la ficha 360. Correr con:
 *   node --test src/lib/timeline360.check.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  agruparPorMes,
  armarEventos360,
  contarPorFiltro,
  diaAR,
  etiquetaMes,
  filtrarEventos,
  instanteDeFecha,
  mesAR,
  resumenCuenta,
  textoContacto,
  tramo,
} from "./timeline360.ts";

const tipoDeEtapa = new Map([
  ["e1", "abierta"],
  ["e2", "abierta"],
  ["g", "ganada"],
  ["p", "perdida"],
]);

test("fechas y meses se cuentan en horario argentino, no en UTC", () => {
  // 01:00 UTC del 1 de octubre = 22:00 del 30 de septiembre en Buenos Aires.
  assert.equal(diaAR("2026-10-01T01:00:00Z"), "2026-09-30");
  assert.equal(mesAR("2026-10-01T01:00:00Z"), "2026-09");
  // 03:00 UTC ya es 00:00 en Buenos Aires: primer instante de octubre.
  assert.equal(mesAR("2026-10-01T03:00:00Z"), "2026-10");
  assert.equal(etiquetaMes("2026-09"), "septiembre de 2026");
  assert.equal(etiquetaMes("2027-01"), "enero de 2027");
});

test("una fecha sin hora cae al mediodía argentino y nunca cambia de día", () => {
  assert.equal(instanteDeFecha("2026-10-04"), "2026-10-04T15:00:00.000Z");
  assert.equal(diaAR(instanteDeFecha("2026-10-04")), "2026-10-04");
  assert.equal(diaAR(instanteDeFecha("2026-12-31")), "2026-12-31");
});

const fuentes = {
  tipoDeEtapa,
  actividades: [
    { id: "a1", ocurrido_en: "2026-09-10T15:00:00Z" },
    { id: "a2", ocurrido_en: "2026-10-02T18:00:00Z" },
  ],
  oportunidades: [{ id: "o1", created_at: "2026-09-01T12:00:00Z", fecha_cierre: "2026-09-20" }],
  cambios: [
    // Fila inicial: el alta ya figura con el created_at real de la oportunidad.
    { id: "c0", oportunidad_id: "o1", etapa_anterior_id: null, etapa_nueva_id: "e1", cambiado_en: "2026-09-01T12:00:00Z", observacion: null },
    { id: "c1", oportunidad_id: "o1", etapa_anterior_id: "e1", etapa_nueva_id: "e2", cambiado_en: "2026-09-12T14:00:00Z", observacion: null },
    { id: "c2", oportunidad_id: "o1", etapa_anterior_id: "e2", etapa_nueva_id: "g", cambiado_en: "2026-09-20T14:00:00Z", observacion: null },
  ],
  ventas: [{ id: "v1", fecha: "2026-09-21" }],
  avisos: [{ id: "x1", enviado_at: "2026-10-03T13:30:00Z" }],
};

test("junta todo, lo más reciente arriba, y descarta la fila inicial del historial", () => {
  const ev = armarEventos360(fuentes);
  assert.deepEqual(
    ev.map((e) => e.id),
    ["aviso:x1", "actividad:a2", "venta:v1", "etapa:c2", "etapa:c1", "actividad:a1", "oportunidad:o1"],
  );
  // c2: de abierta a ganada es un cierre.
  assert.equal(ev.find((e) => e.id === "etapa:c2")?.titulo, "Cierre");
  assert.equal(ev.find((e) => e.id === "etapa:c2")?.resultado, "ganada");
  assert.equal(ev.find((e) => e.id === "etapa:c1")?.titulo, "Cambio de etapa");
});

test("el orden no depende de cómo llegan las fuentes", () => {
  const al_reves = armarEventos360({
    ...fuentes,
    actividades: [...fuentes.actividades].reverse(),
    cambios: [...fuentes.cambios].reverse(),
  });
  assert.deepEqual(al_reves.map((e) => e.id), armarEventos360(fuentes).map((e) => e.id));
});

test("a igual instante: aviso, venta, etapa, oportunidad y actividad; entre iguales, el orden de entrada", () => {
  const t = "2026-09-21T15:00:00.000Z"; // = mediodía AR del 21/09, el mismo instante que una venta de esa fecha
  const ev = armarEventos360({
    tipoDeEtapa,
    actividades: [
      { id: "a1", ocurrido_en: t },
      { id: "a2", ocurrido_en: t },
    ],
    oportunidades: [{ id: "o1", created_at: t, fecha_cierre: null }],
    cambios: [{ id: "c1", oportunidad_id: "o1", etapa_anterior_id: "e1", etapa_nueva_id: "e2", cambiado_en: t, observacion: null }],
    ventas: [{ id: "v1", fecha: "2026-09-21" }],
    avisos: [{ id: "x1", enviado_at: t }],
  });
  assert.deepEqual(
    ev.map((e) => e.id),
    ["aviso:x1", "venta:v1", "etapa:c1", "oportunidad:o1", "actividad:a1", "actividad:a2"],
  );
});

test("un cierre, una reapertura y un cambio de resultado se titulan según los tipos de etapa", () => {
  const ev = armarEventos360({
    tipoDeEtapa,
    cambios: [
      { id: "c1", oportunidad_id: "o", etapa_anterior_id: "e2", etapa_nueva_id: "p", cambiado_en: "2026-01-01T10:00:00Z", observacion: null },
      { id: "c2", oportunidad_id: "o", etapa_anterior_id: "p", etapa_nueva_id: "e1", cambiado_en: "2026-01-02T10:00:00Z", observacion: "volvió a escribir" },
      { id: "c3", oportunidad_id: "o", etapa_anterior_id: "e1", etapa_nueva_id: "g", cambiado_en: "2026-01-03T10:00:00Z", observacion: null },
      { id: "c4", oportunidad_id: "o", etapa_anterior_id: "g", etapa_nueva_id: "p", cambiado_en: "2026-01-04T10:00:00Z", observacion: null },
    ],
  });
  const titulo = (id: string) => ev.find((e) => e.id === id)?.titulo;
  assert.equal(titulo("etapa:c1"), "Cierre");
  assert.equal(titulo("etapa:c2"), "Reapertura");
  assert.equal(titulo("etapa:c3"), "Cierre");
  assert.equal(titulo("etapa:c4"), "Cambio de resultado");
  assert.equal(ev.find((e) => e.id === "etapa:c2")?.resultado, "abierta");
});

test("una oportunidad que nació (o se migró) cerrada muestra su cierre con la fecha real, no la de la migración", () => {
  const ev = armarEventos360({
    tipoDeEtapa,
    oportunidades: [{ id: "o", created_at: "2026-01-05T10:00:00Z", fecha_cierre: "2026-02-10" }],
    cambios: [{ id: "c0", oportunidad_id: "o", etapa_anterior_id: null, etapa_nueva_id: "g", cambiado_en: "2026-10-04T00:00:00Z", observacion: "Registro inicial" }],
  });
  const cierre = ev.find((e) => e.id === "etapa:c0");
  assert.equal(cierre?.titulo, "Cierre");
  assert.equal(diaAR(cierre!.cuando), "2026-02-10");
});

test("filtrar por chip: 'etapas' incluye las altas de oportunidades", () => {
  const ev = armarEventos360(fuentes);
  assert.deepEqual(filtrarEventos(ev, "actividades").map((e) => e.id), ["actividad:a2", "actividad:a1"]);
  assert.deepEqual(filtrarEventos(ev, "etapas").map((e) => e.id), ["etapa:c2", "etapa:c1", "oportunidad:o1"]);
  assert.deepEqual(filtrarEventos(ev, "ventas").map((e) => e.id), ["venta:v1"]);
  assert.deepEqual(filtrarEventos(ev, "avisos").map((e) => e.id), ["aviso:x1"]);
  assert.equal(filtrarEventos(ev, "todo").length, ev.length);
  assert.deepEqual(contarPorFiltro(ev), { todo: 7, actividades: 2, etapas: 3, ventas: 1, avisos: 1 });
  // no muta la entrada
  assert.equal(ev.length, 7);
});

test("agrupa por mes argentino, en orden, y un evento de la noche del 30 no salta de mes", () => {
  const ev = armarEventos360({
    actividades: [
      { id: "a1", ocurrido_en: "2026-10-01T01:00:00Z" }, // 22:00 del 30/09 en AR
      { id: "a2", ocurrido_en: "2026-10-01T04:00:00Z" }, // 01:00 del 01/10 en AR
      { id: "a3", ocurrido_en: "2026-08-15T12:00:00Z" },
    ],
  });
  const grupos = agruparPorMes(ev);
  assert.deepEqual(grupos.map((g) => g.mes), ["2026-10", "2026-09", "2026-08"]);
  assert.deepEqual(grupos.map((g) => g.eventos.map((e) => e.refId)), [["a2"], ["a1"], ["a3"]]);
  assert.equal(grupos[1].etiqueta, "septiembre de 2026");
  assert.deepEqual(agruparPorMes([]), []);
});

test("'Ver más': tramos de a N, sin pasarse", () => {
  const lista = Array.from({ length: 70 }, (_, i) => i);
  assert.deepEqual(tramo(lista, 30).quedan, 40);
  assert.equal(tramo(lista, 30).items.length, 30);
  assert.deepEqual(tramo(lista, 90), { items: lista, quedan: 0 });
  assert.deepEqual(tramo(lista, -3), { items: [], quedan: 70 });
});

test("resumen: cliente desde, total, última compra, abiertas y días sin contacto (hechos a mano)", () => {
  const r = resumenCuenta({
    ventas: [
      { fecha: "2026-03-10", total: 100000 },
      { fecha: "2026-08-01", total: 50000.5 },
      { fecha: "2025-11-20", total: 0 },
    ],
    oportunidades: [
      { estado: "abierta", monto: 200000 },
      { estado: "abierta", monto: null },
      { estado: "ganada", monto: 999 },
      { estado: "perdida", monto: 5 },
    ],
    actividades: [{ ocurrido_en: "2026-08-25T15:00:00Z" }, { ocurrido_en: "2026-07-01T15:00:00Z" }],
    hoy: "2026-10-04",
  });
  assert.equal(r.primeraCompra, "2025-11-20");
  assert.equal(r.totalComprado, 150000.5);
  assert.equal(r.cantidadCompras, 3);
  assert.equal(r.ultimaCompra, "2026-08-01");
  assert.deepEqual(r.abiertas, { cantidad: 2, valor: 200000 });
  assert.equal(r.ultimoContacto, "2026-08-25");
  assert.equal(r.diasDesdeContacto, 40); // 6 días de agosto + 30 de septiembre + 4 de octubre
  assert.equal(r.tonoContacto, "atencion");
});

test("resumen: la primera compra consultada aparte manda sobre la más vieja de las ventas recibidas (que pueden estar truncadas)", () => {
  const base = { oportunidades: [], actividades: null, hoy: "2026-10-04" };
  const ventas = [{ fecha: "2026-03-10", total: 1 }];
  assert.equal(resumenCuenta({ ...base, ventas, primeraCompra: "2019-05-02" }).primeraCompra, "2019-05-02");
  assert.equal(resumenCuenta({ ...base, ventas, primeraCompra: null }).primeraCompra, null);
  assert.equal(resumenCuenta({ ...base, ventas }).primeraCompra, "2026-03-10");
});

test("resumen: umbrales del tono (30 y 90 días) y los casos sin datos", () => {
  const base = { ventas: [], oportunidades: [], hoy: "2026-10-04" };
  const con = (dia: string) => resumenCuenta({ ...base, actividades: [{ ocurrido_en: `${dia}T15:00:00Z` }] });
  assert.equal(con("2026-09-04").tonoContacto, "reciente"); // 30 días justos
  assert.equal(con("2026-09-03").tonoContacto, "atencion"); // 31
  assert.equal(con("2026-07-06").tonoContacto, "atencion"); // 90
  assert.equal(con("2026-07-05").tonoContacto, "frio"); // 91
  assert.equal(con("2026-10-04").diasDesdeContacto, 0);

  const sin = resumenCuenta({ ...base, actividades: [] });
  assert.equal(sin.tonoContacto, "sin-datos");
  assert.equal(sin.diasDesdeContacto, null);
  assert.equal(sin.primeraCompra, null);
  assert.equal(sin.totalComprado, 0);
  // Rol sin bitácora: no se afirma nada.
  assert.equal(resumenCuenta({ ...base, actividades: null }).diasDesdeContacto, null);
});

test("las frases del contacto no dramatizan ni afirman lo que no se sabe", () => {
  assert.equal(textoContacto(0, "reciente"), "Hoy");
  assert.equal(textoContacto(1, "reciente"), "Hace 1 día");
  assert.equal(textoContacto(45, "atencion"), "Hace 45 días: conviene retomar");
  assert.equal(textoContacto(120, "frio"), "Hace 120 días: la cuenta se enfrió");
  assert.equal(textoContacto(null, "sin-datos"), "Sin contactos registrados");
});
