/**
 * Self-check de las reglas puras de oportunidades. Correr con:
 *   node --test src/lib/oportunidades.check.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  accionesDisponibles,
  describirCambios,
  esFechaValida,
  estadoOportunidadInfo,
  etapasAbiertas,
  etapasDeCierre,
  etapasParaModo,
  hoyAR,
  lineaDeTiempo,
  mensajeErrorOportunidad,
  resultadoContrario,
  tituloCambioEtapa,
  validarCambio,
  validarFechaEstimada,
  validarProbabilidad,
} from "./oportunidades.ts";

const etapas = [
  { id: "p", nombre: "Perdida", tipo: "perdida", orden: 6 },
  { id: "n", nombre: "Negociación", tipo: "abierta", orden: 4 },
  { id: "c", nombre: "Consulta", tipo: "abierta", orden: 1 },
  { id: "e", nombre: "Entregado", tipo: "ganada", orden: 5 },
  { id: "e2", nombre: "Cerrado ganado", tipo: "ganada", orden: 7 },
];

test("el tablero muestra solo las etapas abiertas, en el orden configurado", () => {
  assert.deepEqual(etapasAbiertas(etapas).map((e) => e.id), ["c", "n"]);
});

test("a que etapas se puede cerrar: solo las del tipo, y si hay varias se elige", () => {
  assert.deepEqual(etapasDeCierre(etapas, "ganada").map((e) => e.id), ["e", "e2"]);
  assert.deepEqual(etapasDeCierre(etapas, "perdida").map((e) => e.id), ["p"]);
  assert.deepEqual(etapasDeCierre([etapas[1]], "perdida"), []);
});

test("destinos por modo: mover excluye la etapa actual, reabrir ofrece todas las abiertas", () => {
  assert.deepEqual(etapasParaModo(etapas, "etapa", "c").map((e) => e.id), ["n"]);
  assert.deepEqual(etapasParaModo(etapas, "reabrir", "e").map((e) => e.id), ["c", "n"]);
  assert.deepEqual(etapasParaModo(etapas, "perdida").map((e) => e.id), ["p"]);
});

test("cambiar el resultado ofrece las etapas del cierre contrario", () => {
  assert.equal(resultadoContrario("ganada"), "perdida");
  assert.equal(resultadoContrario("perdida"), "ganada");
  assert.deepEqual(etapasParaModo(etapas, "resultado", "e", "ganada").map((e) => e.id), ["p"]);
  assert.deepEqual(etapasParaModo(etapas, "resultado", "p", "perdida").map((e) => e.id), ["e", "e2"]);
  assert.deepEqual(etapasParaModo(etapas, "resultado"), []);
});

test("acciones: una cerrada se reabre o cambia de resultado, y solo con permiso; sin editar no hay nada", () => {
  assert.deepEqual(accionesDisponibles("abierta", { puedeEditar: true, puedeReabrir: false }), ["etapa", "ganada", "perdida"]);
  assert.deepEqual(accionesDisponibles("ganada", { puedeEditar: true, puedeReabrir: false }), []);
  assert.deepEqual(accionesDisponibles("perdida", { puedeEditar: true, puedeReabrir: true }), ["reabrir", "resultado"]);
  assert.deepEqual(accionesDisponibles("ganada", { puedeEditar: false, puedeReabrir: true }), []);
  assert.deepEqual(accionesDisponibles("abierta", { puedeEditar: false, puedeReabrir: true }), []);
});

test("estado: conoce los tres y no revienta con uno desconocido", () => {
  assert.equal(estadoOportunidadInfo("perdida").label, "Perdida");
  assert.equal(estadoOportunidadInfo("rara").label, "rara");
});

test("hoyAR usa el horario argentino (a las 22:30 de Buenos Aires ya es el dia siguiente en UTC)", () => {
  assert.equal(hoyAR(new Date("2026-10-05T01:30:00Z")), "2026-10-04");
  assert.equal(hoyAR(new Date("2026-10-05T04:00:00Z")), "2026-10-05");
});

test("fechas: existen en el calendario", () => {
  assert.equal(esFechaValida("2026-10-04"), true);
  assert.equal(esFechaValida("2026-02-31"), false);
  assert.equal(esFechaValida("04/10/2026"), false);
  assert.equal(esFechaValida("1999-01-01"), false);
  assert.equal(validarFechaEstimada(""), undefined);
  assert.equal(validarFechaEstimada("2027-01-15"), undefined);
  assert.ok(validarFechaEstimada("2027-13-01"));
});

test("probabilidad: vacia es null; entero 0 a 100; acepta el %", () => {
  assert.deepEqual(validarProbabilidad(""), { valor: null });
  assert.deepEqual(validarProbabilidad(" 60% "), { valor: 60 });
  assert.deepEqual(validarProbabilidad("0"), { valor: 0 });
  assert.deepEqual(validarProbabilidad("100"), { valor: 100 });
  assert.ok(validarProbabilidad("101").error);
  assert.ok(validarProbabilidad("-5").error);
  assert.ok(validarProbabilidad("12,5").error);
  assert.ok(validarProbabilidad("abc").error);
});

test("cierre: perdida sin motivo no pasa; ganada no pide motivo", () => {
  const base = { etapaId: "p", motivoId: "", fecha: "2026-10-04", observacion: "", hoy: "2026-10-04" };
  assert.deepEqual(validarCambio({ ...base, modo: "perdida" }), { motivo: "Elegí el motivo de pérdida." });
  assert.deepEqual(validarCambio({ ...base, modo: "ganada", etapaId: "e" }), {});
  assert.deepEqual(validarCambio({ ...base, modo: "perdida", motivoId: "m1" }), {});
});

test("cierre: la fecha real no puede ser futura ni faltar", () => {
  const base = { modo: "ganada" as const, etapaId: "e", motivoId: "", observacion: "", hoy: "2026-10-04" };
  assert.ok(validarCambio({ ...base, fecha: "2026-10-05" }).fecha);
  assert.ok(validarCambio({ ...base, fecha: "" }).fecha);
  assert.deepEqual(validarCambio({ ...base, fecha: "2026-09-30" }), {});
});

test("cambiar el resultado: razon, motivo si va a perdida, y la fecha NO puede repetir el cierre anterior", () => {
  const base = { modo: "resultado" as const, etapaId: "p", motivoId: "m1", fecha: "2026-09-30", observacion: "Se cayó la compra", hoy: "2026-10-04", destinoTipo: "perdida", fechaActual: "2026-09-01" };
  assert.deepEqual(validarCambio(base), {});
  assert.ok(validarCambio({ ...base, observacion: " " }).observacion);
  assert.ok(validarCambio({ ...base, motivoId: "" }).motivo);
  // Hacia ganada no se pide motivo.
  assert.deepEqual(validarCambio({ ...base, destinoTipo: "ganada", motivoId: "" }), {});
  // Misma fecha que el cierre anterior: la base la reemplazaria por hoy en silencio -> se rechaza.
  assert.match(validarCambio({ ...base, fecha: "2026-09-01" }).fecha ?? "", /01\/09\/2026/);
  // …salvo que sea hoy: ahi el reemplazo da lo mismo.
  assert.deepEqual(validarCambio({ ...base, fecha: "2026-10-04", fechaActual: "2026-10-04" }), {});
  assert.ok(validarCambio({ ...base, fecha: "2026-10-05" }).fecha);
  // La regla de la fecha repetida es solo del cambio de resultado.
  assert.deepEqual(validarCambio({ ...base, modo: "ganada", destinoTipo: undefined, motivoId: "", fecha: "2026-09-01" }), {});
});

test("mover de etapa no pide fecha ni motivo; reabrir pide la razon", () => {
  const base = { etapaId: "n", motivoId: "", fecha: "", hoy: "2026-10-04" };
  assert.deepEqual(validarCambio({ ...base, modo: "etapa", observacion: "" }), {});
  assert.ok(validarCambio({ ...base, modo: "reabrir", observacion: "  " }).observacion);
  assert.deepEqual(validarCambio({ ...base, modo: "reabrir", observacion: "El club retomó la compra" }), {});
  assert.ok(validarCambio({ ...base, modo: "etapa", etapaId: "", observacion: "" }).etapa);
});

test("errores de la base en palabras de persona", () => {
  const g = "generico";
  assert.match(
    mensajeErrorOportunidad({ code: "42501", message: "La oportunidad está cerrada: reabrirla requiere autorización (oportunidades.reabrir)." }, g),
    /no puede reabrirla/,
  );
  assert.match(
    mensajeErrorOportunidad({ code: "42501", message: "No tenés permiso para asignar o reasignar el responsable." }, g),
    /asignar o reasignar/,
  );
  assert.match(
    mensajeErrorOportunidad({ code: "42501", message: "No existe la oportunidad o no tenés permiso para modificarla." }, g),
    /cartera/,
  );
  assert.match(
    mensajeErrorOportunidad({ code: "42501", message: "new row violates row-level security policy" }, g),
    /Tu rol no puede/,
  );
  assert.match(
    mensajeErrorOportunidad({ code: "23514", message: "Para marcar la oportunidad como perdida hay que indicar el motivo de pérdida." }, g),
    /motivo de pérdida/,
  );
  assert.match(
    mensajeErrorOportunidad({ code: "23514", message: 'new row violates check constraint "oportunidades_estado_coherente"' }, g),
    /motivo de pérdida/,
  );
  assert.match(mensajeErrorOportunidad({ code: "23514", message: "Una oportunidad cerrada tiene que tener fecha real de cierre." }, g), /necesita su fecha de cierre/);
  // 0009: comparten "fecha real de cierre" con la regla anterior, pero el mensaje es otro.
  assert.equal(mensajeErrorOportunidad({ code: "23514", message: "La fecha real de cierre no puede ser futura." }, g), "La fecha de cierre no puede ser futura.");
  assert.match(mensajeErrorOportunidad({ code: "23514", message: "La oportunidad tiene que ser de una empresa o de un contacto." }, g), /empresa o un contacto/);
  assert.match(mensajeErrorOportunidad({ code: "23514", message: 'violates check constraint "oportunidades_probabilidad_check"' }, g), /0 a 100/);
  assert.match(mensajeErrorOportunidad({ code: "23503", message: "fk" }, g), /ya no existe/);
  assert.equal(mensajeErrorOportunidad({ code: "P0001", message: "Texto de la base." }, g), "Texto de la base.");
  assert.match(mensajeErrorOportunidad({ message: "TypeError: Failed to fetch" }, g), /conexión/);
  assert.equal(mensajeErrorOportunidad({ code: "XX000", message: "boom" }, g), g);
  assert.equal(mensajeErrorOportunidad(null, g), g);
});

test("linea de tiempo: mezcla actividades y cambios de etapa, la mas reciente arriba", () => {
  const acts = [
    { id: "a1", ocurrido_en: "2026-10-01T10:00:00Z" },
    { id: "a2", ocurrido_en: "2026-10-03T10:00:00Z" },
  ];
  const cambios = [
    { id: "c1", cambiado_en: "2026-09-30T10:00:00Z" },
    { id: "c2", cambiado_en: "2026-10-03T10:00:00Z" },
    { id: "c3", cambiado_en: "2026-10-02T10:00:00Z" },
  ];
  const orden = lineaDeTiempo(acts, cambios).map((i) => (i.tipo === "etapa" ? i.cambio.id : i.actividad.id));
  // a2 y c2 son el mismo instante: el cambio de etapa va primero.
  assert.deepEqual(orden, ["c2", "a2", "c3", "a1", "c1"]);
  assert.equal(acts[0].id, "a1"); // no muta la entrada
  assert.deepEqual(lineaDeTiempo([], []), []);
});

test("auditoria: traduce campos, ids y valores", () => {
  const resolver = (campo: string, id: string) => (campo === "etapa_id" && id === "e" ? "Entregado" : undefined);
  const filas = describirCambios(
    {
      etapa_id: { antes: "e", despues: "zzz" },
      monto: { antes: 1500, despues: 2500 },
      fecha_cierre: { antes: "2026-10-01", despues: null },
      estado: { antes: "ganada", despues: "abierta" },
      campo_raro: { antes: "x", despues: "y" },
    },
    resolver,
  );
  assert.deepEqual(filas[0], { campo: "Etapa", antes: "Entregado", despues: "Sin acceso" });
  assert.deepEqual(filas[1], { campo: "Valor estimado", antes: "$1.500", despues: "$2.500" });
  assert.deepEqual(filas[2], { campo: "Fecha de cierre", antes: "01/10/2026", despues: "vacío" });
  assert.deepEqual(filas[3], { campo: "Estado", antes: "Ganada", despues: "Abierta" });
  assert.equal(filas[4].campo, "campo_raro");
  assert.deepEqual(describirCambios(null, resolver), []);
  assert.deepEqual(describirCambios([1], resolver), []);
});

test("titulos del historial: alta, registro inicial, cambio, cierre, reapertura y cambio de resultado", () => {
  const t = tituloCambioEtapa;
  assert.equal(t({ hayAnterior: false, nuevaTipo: "abierta", observacion: null }), "Alta");
  assert.equal(t({ hayAnterior: false, nuevaTipo: "abierta", observacion: "Registro inicial: etapa vigente al activar el historial." }), "Registro inicial");
  assert.equal(t({ hayAnterior: true, anteriorTipo: "abierta", nuevaTipo: "abierta" }), "Cambio de etapa");
  assert.equal(t({ hayAnterior: true, anteriorTipo: "abierta", nuevaTipo: "ganada" }), "Cierre");
  assert.equal(t({ hayAnterior: true, anteriorTipo: "perdida", nuevaTipo: "abierta" }), "Reapertura");
  assert.equal(t({ hayAnterior: true, anteriorTipo: "ganada", nuevaTipo: "perdida" }), "Cambio de resultado");
  assert.equal(t({ hayAnterior: true, anteriorTipo: "ganada", nuevaTipo: "ganada" }), "Cambio de etapa");
  assert.equal(t({ hayAnterior: true, nuevaTipo: "perdida" }), "Cierre");
});

test("errores de la 0011: licitacion antes de la apertura y sin datos", () => {
  const g = "genérico";
  assert.equal(
    mensajeErrorOportunidad({ code: "23514", message: "No se puede marcar ganada una licitación antes de su apertura (fecha de apertura: 15/12/2026)." }, g),
    "No se puede marcar ganada antes de la apertura (15/12/2026).",
  );
  assert.match(
    mensajeErrorOportunidad({ code: "23514", message: "Una licitación necesita sus datos (al menos la fecha de apertura) antes de poder marcarse como ganada." }, g),
    /Cargá los datos de la licitación/,
  );
});

test("error de la 0011: segunda oportunidad abierta para el mismo equipo", () => {
  assert.equal(
    mensajeErrorOportunidad({ code: "23505", message: 'duplicate key value violates unique constraint "oportunidades_venta_item_abierta_key"' }, "genérico"),
    "Ya hay una oportunidad abierta para este equipo.",
  );
  assert.equal(mensajeErrorOportunidad({ code: "23505", message: "otra restriccion" }, "genérico"), "genérico");
});
