/**
 * Auto-chequeo de la lógica de Alertas: node --test "src/app/(app)/(crm2)/alertas/logica.check.ts"
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { contarAlertas, filtrarAlertas, textoVencimiento } from "./logica.ts";

const fila = (o: Partial<{ estado: string; ultimo_envio: string | null; empresa_nombre: string; producto_nombre: string; contacto_nombre: string | null }>) => ({
  estado: "por_vencer",
  ultimo_envio: null,
  empresa_nombre: "Club",
  producto_nombre: "Red",
  contacto_nombre: null,
  ...o,
});

const alertas = [
  fila({ estado: "vencido", empresa_nombre: "Club Atlético San Justo", producto_nombre: "Red para arco", ultimo_envio: "2026-09-24T10:00:00Z" }),
  fila({ estado: "vencido", empresa_nombre: "Escuela Ramos Mejía", producto_nombre: "Pecheras", contacto_nombre: "Carolina Ferreyra" }),
  fila({ estado: "por_vencer", empresa_nombre: "La Tablada", producto_nombre: "Pelota N°5" }),
];

test("contarAlertas: los tres contadores de siempre y el total", () => {
  assert.deepEqual(contarAlertas(alertas), { todas: 3, vencido: 2, por_vencer: 1, sin_avisar: 2 });
});

test("filtrarAlertas por grupo", () => {
  assert.equal(filtrarAlertas(alertas, "todas", "").length, 3);
  assert.equal(filtrarAlertas(alertas, "vencido", "").length, 2);
  assert.equal(filtrarAlertas(alertas, "por_vencer", "").length, 1);
  assert.equal(filtrarAlertas(alertas, "sin_avisar", "").length, 2);
});

test("filtrarAlertas busca en cliente, producto y contacto, sin mayúsculas ni espacios de las puntas", () => {
  assert.equal(filtrarAlertas(alertas, "todas", "  CAROLINA ").length, 1);
  assert.equal(filtrarAlertas(alertas, "todas", "red para").length, 1);
  assert.equal(filtrarAlertas(alertas, "por_vencer", "san justo").length, 0);
});

test("textoVencimiento: el texto de la pastilla de antes", () => {
  assert.equal(textoVencimiento(0, true), "Vence hoy");
  assert.equal(textoVencimiento(-72, true), "Vencido hace 72 d");
  assert.equal(textoVencimiento(20, false), "Vence en 20 d");
});
