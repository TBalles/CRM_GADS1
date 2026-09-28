/**
 * Self-check de tipoEquipo: node --test src/lib/equipo.check.ts
 * Sin framework: Node saca los tipos solo y `node:test` ya viene incluido.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tipoEquipo } from "./equipo.ts";

test("el nombre manda, y la red le gana al arco", () => {
  assert.equal(tipoEquipo("Red para arco de fútbol 11", "Redes"), "red");
  assert.equal(tipoEquipo("Arco de fútbol 11 (7.32 x 2.44 m)", "Arcos"), "arco");
  assert.equal(tipoEquipo("Pelota de fútbol N°5 (unidad)", "Pelotas"), "pelota");
  assert.equal(tipoEquipo("Set de conos de entrenamiento x 50", "Entrenamiento"), "cono");
  assert.equal(tipoEquipo("Pecheras de entrenamiento x 15 (juego)", "Indumentaria"), "pechera");
  assert.equal(tipoEquipo("Banderines de córner (juego x 4)", "Accesorios"), "banderin");
  assert.equal(tipoEquipo("Escalera y aros de agilidad", "Entrenamiento"), "escalera");
  assert.equal(tipoEquipo("Vallas de entrenamiento (juego x 6)", "Entrenamiento"), "valla");
});

test("una marca no se confunde con el producto", () => {
  // "Redex" es la marca de las redes: no tiene que leerse como "red".
  assert.equal(tipoEquipo("Kit Redex", null), "otro");
});

test("sin pista en el nombre, decide la categoría; sin nada, 'otro'", () => {
  assert.equal(tipoEquipo("Kit de mantenimiento de cancha", "Mantenimiento"), "mantenimiento");
  assert.equal(tipoEquipo("Tablero electrónico de tantos", "Accesorios"), "banderin");
  assert.equal(tipoEquipo("Tablero electrónico de tantos", null), "otro");
  assert.equal(tipoEquipo(null, null), "otro");
});
