import { test } from "node:test";
import assert from "node:assert/strict";
import { filaTrasRefresco, tabValida, vecinoSel } from "./seleccion.ts";

/** ↓↓↓ con la tecla apretada: cada paso parte de lo que dejó el anterior (el foco sigue a la selección optimista). */
function recorrer(ids: readonly string[], actual: string | null, foco: string | null, pasos: readonly ("next" | "prev")[]) {
  let sel = actual;
  let f = foco;
  for (const p of pasos) {
    const d = vecinoSel(ids, sel, f, p);
    if (d) sel = f = d;
  }
  return sel;
}

const ids = ["a", "b", "c"];

test("vecinoSel: ↓/↑ desde la seleccionada, sin vuelta en los bordes", () => {
  assert.equal(vecinoSel(ids, "a", null, "next"), "b");
  assert.equal(vecinoSel(ids, "b", null, "prev"), "a");
  assert.equal(vecinoSel(ids, "c", null, "next"), null);
  assert.equal(vecinoSel(ids, "a", null, "prev"), null);
});

test("vecinoSel: cuenta desde la fila con foco, no desde un sel viejo", () => {
  // Foco en "b" y la selección que se ve es "b": baja a "c" aunque el servidor todavía diga "a".
  assert.equal(vecinoSel(ids, "b", "b", "next"), "c");
  // Foco en otra fila que no es la elegida: la flecha elige la fila con foco.
  assert.equal(vecinoSel(ids, "a", "c", "prev"), "c");
  assert.equal(vecinoSel(ids, null, "b", "next"), "b");
});

test("vecinoSel: sin foco ni selección en la página, la primera o la última", () => {
  assert.equal(vecinoSel(ids, "otra-pagina", null, "next"), "a");
  assert.equal(vecinoSel(ids, null, null, "prev"), "c");
  assert.equal(vecinoSel(ids, null, "fuera", "next"), "a");
  assert.equal(vecinoSel(ids, "b", null, "next"), "c");
  assert.equal(vecinoSel([], "a", "a", "next"), null);
});

test("recorrer: ↓↓↓ seguidas terminan en la fila correcta (y se quedan en el borde)", () => {
  assert.equal(recorrer(ids, "a", "a", ["next", "next"]), "c");
  assert.equal(recorrer(ids, "a", "a", ["next", "next", "next", "next"]), "c");
  assert.equal(recorrer(ids, null, null, ["next", "next", "prev"]), "a");
  assert.equal(recorrer(ids, "c", "c", ["prev", "prev", "prev"]), "a");
});

test("tabValida: la pedida si existe; si no, la primera", () => {
  const tabs = ["resumen", "actividad", "contactos"] as const;
  assert.equal(tabValida("contactos", tabs), "contactos");
  assert.equal(tabValida(undefined, tabs), "resumen");
  assert.equal(tabValida("ventas", tabs), "resumen");
  assert.equal(tabValida(["actividad"], tabs), "resumen");
});

test("filaTrasRefresco: la misma si sigue (baja con «Ver bajas», reactivar sin filtro)", () => {
  assert.equal(filaTrasRefresco(ids, ids, "b"), "b");
});

test("filaTrasRefresco: si salió, la siguiente que sigue; si no, la anterior; vacía, ninguna", () => {
  // baja sin «Ver bajas», o con ?estado=cliente&bajas=1: la fila b ya no está.
  assert.equal(filaTrasRefresco(ids, ["a", "c"], "b"), "c");
  // ?estado=inactivo + Reactivar sobre la última.
  assert.equal(filaTrasRefresco(ids, ["a", "b"], "c"), "b");
  // salieron b y c (otra pestaña cambió c): la anterior.
  assert.equal(filaTrasRefresco(ids, ["a"], "b"), "a");
  // al salir entra una fila de la página siguiente: igual va a la siguiente de antes que siga.
  assert.equal(filaTrasRefresco(ids, ["a", "c", "d"], "b"), "c");
  assert.equal(filaTrasRefresco(["a"], [], "a"), null);
  assert.equal(filaTrasRefresco(ids, ["a", "b"], "fuera"), null);
});
