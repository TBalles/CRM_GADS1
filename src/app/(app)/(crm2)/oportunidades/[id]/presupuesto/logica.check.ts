/**
 * Auto-chequeo del editor de presupuesto: node --test "src/app/(app)/(crm2)/oportunidades/[id]/presupuesto/logica.check.ts"
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { calcularTotales } from "../../../../../../lib/presupuesto.ts";
import {
  aLinea,
  botonTrasMover,
  cambioDeProducto,
  deLinea,
  focoTrasQuitar,
  lineaDeProducto,
  lineaLibre,
  lineasIniciales,
  moverLinea,
} from "./logica.ts";

const arco = { id: "p1", nombre: "Arco de fútbol 11", precio: 450000 };

test("lineasIniciales: el producto de la oportunidad con su precio de catálogo", () => {
  assert.deepEqual(lineasIniciales({ titulo: "Venta", producto_id: "p1", monto: 10 }, [arco]), [
    { key: "l0", producto_id: "p1", descripcion: "Arco de fútbol 11", cantidad: "1", precio: "450.000,00", descuento: "" },
  ]);
});

test("lineasIniciales: sin producto, el valor estimado con el título; sin nada, ninguna línea", () => {
  assert.deepEqual(lineasIniciales({ titulo: "Redes", producto_id: null, monto: 1500.5 }, [arco]), [
    { key: "l0", producto_id: null, descripcion: "Redes", cantidad: "1", precio: "1.500,50", descuento: "" },
  ]);
  assert.deepEqual(lineasIniciales({ titulo: "Redes", producto_id: null, monto: null }, [arco]), []);
  // Un producto que ya no está en el catálogo activo cae al valor estimado.
  assert.equal(lineasIniciales({ titulo: "Redes", producto_id: "viejo", monto: null }, [arco]).length, 0);
});

test("aLinea / deLinea: ida y vuelta con la máscara es-AR", () => {
  const l = { key: "n1", producto_id: null, descripcion: "Red", cantidad: "2,5", precio: "1.234,56", descuento: "10" };
  assert.deepEqual(aLinea(l), { producto_id: null, descripcion: "Red", cantidad: 2.5, precio_unitario: 1234.56, descuento_pct: 10 });
  assert.deepEqual(deLinea(aLinea(l), "n1"), l);
  assert.equal(deLinea({ producto_id: null, descripcion: "x", cantidad: 1, precio_unitario: 5, descuento_pct: 0 }, "k").descuento, "");
});

test("líneas nuevas: libre vacía con cantidad 1; del catálogo con nombre y precio", () => {
  assert.deepEqual(lineaLibre("n3"), { key: "n3", producto_id: null, descripcion: "", cantidad: "1", precio: "", descuento: "" });
  assert.equal(lineaDeProducto("n4", arco).precio, "450.000,00");
  assert.equal(lineaDeProducto("n5", { ...arco, precio: null }).precio, "");
});

test("cambioDeProducto: elegir pisa nombre y precio (si tiene); Texto libre solo suelta el producto", () => {
  assert.deepEqual(cambioDeProducto(arco), { producto_id: "p1", descripcion: "Arco de fútbol 11", precio: "450.000,00" });
  assert.deepEqual(cambioDeProducto({ ...arco, precio: null }), { producto_id: "p1", descripcion: "Arco de fútbol 11" });
  assert.deepEqual(cambioDeProducto(undefined), { producto_id: null });
});

test("moverLinea intercambia con la vecina y en el borde devuelve la misma lista", () => {
  const l = ["a", "b", "c"];
  assert.deepEqual(moverLinea(l, 1, -1), ["b", "a", "c"]);
  assert.deepEqual(moverLinea(l, 1, 1), ["a", "c", "b"]);
  assert.equal(moverLinea(l, 0, -1), l);
  assert.equal(moverLinea(l, 2, 1), l);
  assert.equal(moverLinea(l, 5, 1), l);
  assert.deepEqual(l, ["a", "b", "c"]);
});

test("botonTrasMover: el mismo botón, o el otro si la línea quedó en el borde", () => {
  assert.equal(botonTrasMover(1, 3, -1), "subir");
  assert.equal(botonTrasMover(0, 3, -1), "bajar");
  assert.equal(botonTrasMover(1, 3, 1), "bajar");
  assert.equal(botonTrasMover(2, 3, 1), "subir");
});

test("focoTrasQuitar: la siguiente, si no la anterior, si no ninguna", () => {
  assert.equal(focoTrasQuitar(["a", "b", "c"], "b"), "c");
  assert.equal(focoTrasQuitar(["a", "b", "c"], "c"), "b");
  assert.equal(focoTrasQuitar(["a"], "a"), null);
  assert.equal(focoTrasQuitar(["a"], "z"), null);
});

test("los totales del editor salen de las mismas cuentas que la hoja (centavos, descuento, IVA 21 %)", () => {
  const lineas = [
    { key: "a", producto_id: null, descripcion: "A", cantidad: "2", precio: "13.375,50", descuento: "" },
    { key: "b", producto_id: null, descripcion: "B", cantidad: "2", precio: "17.500,50", descuento: "10" },
  ].map(aLinea);
  const t = calcularTotales(lineas, "responsable_inscripto");
  assert.equal(t.subtotal, 61752);
  assert.equal(t.descuento, 3500.1);
  assert.equal(t.neto, 58251.9);
  assert.equal(t.iva, 12232.9);
  assert.equal(t.total, 70484.8);
  assert.equal(calcularTotales(lineas, "monotributo").discrimina, false);
});
