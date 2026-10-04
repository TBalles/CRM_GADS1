/**
 * Self-check del equipamiento sugerido: node --test src/lib/canchas.check.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  equipamientoSugerido,
  faltantesTexto,
  medidasDeProducto,
  notasEquipamiento,
  textoLinea,
  unirLista,
  tituloEquipamiento,
  unidadesDelParque,
  type CanchaBasica,
  type UnidadParque,
} from "./canchas.ts";
import { filaParque } from "./parque.ts";

const cancha = (extra: Partial<CanchaBasica> = {}): CanchaBasica => ({ nombre: "Canchas F5", formato: "F5", cantidad: 1, activa: true, ...extra });
const arcos = (nombre: string, unidades: number): UnidadParque => ({ tipo: "arco", nombre, unidades });
const redes = (nombre: string, unidades: number): UnidadParque => ({ tipo: "red", nombre, unidades });

test("las medidas se leen del nombre del producto", () => {
  assert.deepEqual(medidasDeProducto("Arco de fútbol 11 (7.32 x 2.44 m)"), ["7,32x2,44"]);
  assert.deepEqual(medidasDeProducto("Arco de fútbol 5/7"), ["3x2", "6x2,10"]);
  assert.deepEqual(medidasDeProducto("Red para arco de fútbol 11"), ["7,32x2,44"]);
  assert.deepEqual(medidasDeProducto("Arco de futsal"), ["3x2"]);
  assert.deepEqual(medidasDeProducto("Arco F7 6 x 2,10"), ["6x2,10"]);
  assert.deepEqual(medidasDeProducto("Arco 3x2 m"), ["3x2"]);
  assert.deepEqual(medidasDeProducto("Arco profesional"), []);
  // "Redex" o "Fuente 5" no son un formato.
  assert.deepEqual(medidasDeProducto("Kit Redex"), []);
});

test("2 arcos y 2 redes por cancha, por la cantidad de canchas; sin nada en el parque faltan todos", () => {
  const s = equipamientoSugerido([cancha({ cantidad: 2 })], []);
  const arco = s.lineas.find((l) => l.tipo === "arco");
  assert.equal(arco?.necesarias, 4);
  assert.equal(arco?.faltan, 4);
  assert.deepEqual(arco?.formatos, ["F5"]);
  assert.equal(s.lineas.find((l) => l.tipo === "red")?.faltan, 4);
  assert.equal(s.completo, false);
  assert.deepEqual(faltantesTexto(s), ["4 arcos de 3 × 2 m (F5)", "4 redes de 3 × 2 m (F5)"]);
});

test("las pelotas son opcionales: no hacen falta para decir que esta completo", () => {
  const s = equipamientoSugerido([cancha()], [arcos("Arco de fútbol 5/7", 2), redes("Red para arco de fútbol 5/7", 2)]);
  const pelotas = s.lineas.find((l) => l.tipo === "pelota");
  assert.equal(pelotas?.opcional, true);
  assert.equal(pelotas?.faltan, 2);
  assert.equal(s.completo, true);
  assert.deepEqual(faltantesTexto(s), []);
});

test("un arco de otra medida no cubre la cancha: F11 no se completa con arcos 5/7", () => {
  const s = equipamientoSugerido([cancha({ formato: "F11" })], [arcos("Arco de fútbol 5/7", 4)]);
  assert.equal(s.lineas.find((l) => l.tipo === "arco")?.faltan, 2);
  assert.deepEqual(faltantesTexto(s)[0], "2 arcos de 7,32 × 2,44 m (F11)");
});

test("F9 y F11 comparten medida; futsal comparte con F5", () => {
  const s = equipamientoSugerido([cancha({ formato: "F9" }), cancha({ formato: "F11", nombre: "Grande" })], [arcos("Arco de fútbol 11 (7.32 x 2.44 m)", 3)]);
  const arco = s.lineas.find((l) => l.tipo === "arco");
  assert.equal(arco?.necesarias, 4);
  assert.equal(arco?.faltan, 1);
  assert.equal(textoLinea(arco!, 1), "1 arco de 7,32 × 2,44 m (F9 y F11)");
  const f = equipamientoSugerido([cancha(), cancha({ formato: "futsal" })], []);
  assert.deepEqual(f.lineas.find((l) => l.tipo === "arco")?.formatos, ["F5", "futsal"]);
});

test("un producto que no dice la medida sirve de comodin; el '5/7' va primero a F5", () => {
  const generico = equipamientoSugerido([cancha({ formato: "F7" })], [arcos("Arco profesional", 2)]);
  assert.equal(generico.lineas.find((l) => l.tipo === "arco")?.faltan, 0);
  const mezcla = equipamientoSugerido([cancha(), cancha({ formato: "F7", nombre: "Siete" })], [arcos("Arco de fútbol 5/7", 3)]);
  const porMedida = Object.fromEntries(mezcla.lineas.filter((l) => l.tipo === "arco").map((l) => [l.medida, l.faltan]));
  assert.deepEqual(porMedida, { "3x2": 0, "6x2,10": 1 });
});

test("las canchas dadas de baja no piden equipamiento y sin canchas no hay sugerencia", () => {
  const s = equipamientoSugerido([cancha({ activa: false })], []);
  assert.equal(s.hayCanchas, false);
  assert.equal(s.completo, false);
  assert.deepEqual(s.lineas, []);
  assert.equal(equipamientoSugerido([], []).hayCanchas, false);
});

test("los vencidos no cuentan como cubiertos", () => {
  const hoy = "2026-10-04";
  const filas = [
    filaParque({ id: "1", producto: "Arco de fútbol 5/7", categoria: "Arcos", cantidad: 2, fechaEntrega: "2023-01-01", vidaUtilMeses: 24 }, hoy), // vencido
    filaParque({ id: "2", producto: "Arco de fútbol 5/7", categoria: "Arcos", cantidad: 1, fechaEntrega: "2026-01-01", vidaUtilMeses: 24 }, hoy),
    filaParque({ id: "3", producto: "Kit de mantenimiento", categoria: "Mantenimiento", cantidad: 1, fechaEntrega: null, vidaUtilMeses: null }, hoy),
  ];
  const unidades = unidadesDelParque(filas);
  assert.equal(unidades.length, 2);
  assert.equal(equipamientoSugerido([cancha()], unidades).lineas.find((l) => l.tipo === "arco")?.faltan, 1);
});

test("titulo y notas de la oportunidad creada desde la sugerencia", () => {
  assert.equal(tituloEquipamiento("Club Atlético Norte", [cancha({ nombre: "Cancha 1" })]), "Equipamiento para Cancha 1");
  assert.equal(tituloEquipamiento("Club Atlético Norte", [cancha(), cancha({ nombre: "Otra" })]), "Equipamiento para Club Atlético Norte");
  const notas = notasEquipamiento(equipamientoSugerido([cancha()], []));
  assert.match(notas, /no es un relevamiento/);
  assert.match(notas, /Faltarían: 2 arcos de 3 × 2 m \(F5\); 2 redes de 3 × 2 m \(F5\)\./);
});

test("las listas se unen como se habla", () => {
  assert.equal(unirLista([]), "");
  assert.equal(unirLista(["2 arcos"]), "2 arcos");
  assert.equal(unirLista(["2 arcos", "2 redes"]), "2 arcos y 2 redes");
  assert.equal(unirLista(["2 arcos", "2 redes", "4 pelotas"]), "2 arcos, 2 redes y 4 pelotas");
});
