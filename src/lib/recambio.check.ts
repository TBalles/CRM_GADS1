/**
 * Self-check del recambio en 1 clic: node --test src/lib/recambio.check.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  abiertasPorItem,
  etapaInicialId,
  oportunidadDeRecambio,
  origenRecambioId,
  tituloRecambio,
  valorRecambio,
  type AlertaRecambio,
} from "./recambio.ts";

const alerta: AlertaRecambio = {
  venta_item_id: "vi-1",
  producto_id: "p-1",
  producto_nombre: "Arco de fútbol 11 (7.32 x 2.44 m)",
  cantidad: 2,
  empresa_id: "e-1",
  empresa_nombre: "Club Atlético Norte",
  contacto_id: "c-1",
  fecha_entrega: "2024-08-01",
  vida_util_meses: 24,
  vence_el: "2026-08-01",
};

test("el titulo es 'Recambio: <producto> — <empresa>'", () => {
  assert.equal(tituloRecambio("Red para arco", "Club Norte"), "Recambio: Red para arco — Club Norte");
  assert.equal(tituloRecambio("Red para arco", null), "Recambio: Red para arco");
  assert.equal(tituloRecambio(null, "Club Norte"), "Recambio: equipo — Club Norte");
  assert.equal(tituloRecambio("x".repeat(300), "Club").length, 200);
});

test("el valor es precio por cantidad; sin precio no se inventa", () => {
  assert.equal(valorRecambio(450000, 2), 900000);
  assert.equal(valorRecambio("450000.50", 2), 900001);
  assert.equal(valorRecambio(100, null), 100);
  assert.equal(valorRecambio(100, 0), 100);
  assert.equal(valorRecambio(null, 3), null);
  assert.equal(valorRecambio(undefined, 3), null);
  assert.equal(valorRecambio("", 3), null);
  assert.equal(valorRecambio(-5, 3), null);
  assert.equal(valorRecambio(0, 3), 0);
});

test("el origen sale del catalogo por nombre, solo si esta activo", () => {
  const origenes = [
    { id: "o1", nombre: "Web", activo: true },
    { id: "o2", nombre: "Recambio por vida util", activo: true },
  ];
  assert.equal(origenRecambioId(origenes), "o2");
  assert.equal(origenRecambioId([{ id: "o2", nombre: "Recambio por vida útil", activo: false }]), null);
  assert.equal(origenRecambioId([{ id: "o1", nombre: "Web", activo: true }]), null);
});

test("la etapa inicial es la primera abierta por orden", () => {
  assert.equal(
    etapaInicialId([
      { id: "g", tipo: "ganada", orden: 1 },
      { id: "b", tipo: "abierta", orden: 3 },
      { id: "a", tipo: "abierta", orden: 2 },
    ]),
    "a",
  );
  assert.equal(etapaInicialId([{ id: "g", tipo: "ganada", orden: 1 }]), null);
});

test("duplicados: solo cuenta la oportunidad ABIERTA del mismo equipo", () => {
  const mapa = abiertasPorItem([
    { id: "op-1", venta_item_id: "vi-1", estado: "abierta" },
    { id: "op-2", venta_item_id: "vi-2", estado: "perdida" },
    { id: "op-3", venta_item_id: "vi-3", estado: "ganada" },
    { id: "op-4", venta_item_id: null, estado: "abierta" },
    { id: "op-5", venta_item_id: "vi-1", estado: "abierta" },
  ]);
  assert.equal(mapa.get("vi-1"), "op-1");
  assert.equal(mapa.has("vi-2"), false);
  assert.equal(mapa.has("vi-3"), false);
  assert.equal(mapa.size, 1);
});

test("la fila a insertar lleva todo lo que se sabe del equipo", () => {
  const fila = oportunidadDeRecambio({ alerta, precioUnitario: 450000, etapaId: "et-1", origenId: "or-1", responsableId: "u-1" });
  assert.ok(fila);
  assert.equal(fila.titulo, "Recambio: Arco de fútbol 11 (7.32 x 2.44 m) — Club Atlético Norte");
  assert.equal(fila.monto, 900000);
  assert.equal(fila.venta_item_id, "vi-1");
  assert.equal(fila.contacto_id, "c-1");
  assert.equal(fila.origen_id, "or-1");
  assert.equal(fila.responsable_id, "u-1");
  assert.equal(fila.tipo, "directa");
  assert.match(fila.notas, /Entregado el 01\/08\/2024, vida útil de 24 meses, vence el 01\/08\/2026/);
});

test("sin origen en el catalogo queda null; sin etapa o sin equipo no se crea nada", () => {
  assert.equal(oportunidadDeRecambio({ alerta, precioUnitario: null, etapaId: "et-1", origenId: null, responsableId: "u" })?.origen_id, null);
  assert.equal(oportunidadDeRecambio({ alerta, precioUnitario: null, etapaId: "et-1", origenId: null, responsableId: "u" })?.monto, null);
  assert.equal(oportunidadDeRecambio({ alerta, precioUnitario: 1, etapaId: null, origenId: null, responsableId: "u" }), null);
  assert.equal(oportunidadDeRecambio({ alerta: { ...alerta, venta_item_id: null }, precioUnitario: 1, etapaId: "e", origenId: null, responsableId: "u" }), null);
});
