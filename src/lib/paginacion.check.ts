/**
 * Self-check de la paginación y la búsqueda por URL. Correr con:
 *   node --test src/lib/paginacion.check.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  condicionIn,
  escaparLike,
  fechaParam,
  filtroOr,
  leerPagina,
  leerPaginacion,
  opcionParam,
  rango,
  terminos,
  textoParam,
  textoRango,
  totalPaginas,
  urlConParams,
  uuidParam,
  ventanaPaginas,
} from "./paginacion.ts";

/* --- Emulación de lo que hace PostgREST + Postgres con un filtro ilike --- */

/** Lo que PostgREST le pasa a ILIKE: desescapa las comillas y convierte `*` en `%`. */
function valorQueLlegaAIlike(filtro: string): string {
  const m = /\.ilike\.("(?:[^"\\]|\\.)*")/.exec(filtro);
  assert.ok(m, `filtro sin valor entre comillas: ${filtro}`);
  const crudo = m[1].slice(1, -1).replace(/\\(["\\])/g, "$1");
  return crudo.replace(/\*/g, "%");
}

/** ILIKE de Postgres: `\x` es el literal x, `%` cualquier cosa, `_` un carácter, sin distinguir mayúsculas. */
function ilike(valor: string, patron: string): boolean {
  let re = "^";
  for (let i = 0; i < patron.length; i++) {
    const c = patron[i];
    if (c === "\\") re += (patron[++i] ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (c === "%") re += "[\\s\\S]*";
    else if (c === "_") re += "[\\s\\S]";
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`${re}$`, "i").test(valor);
}

function busca(columna: string, texto: string, valor: string): boolean {
  return ilike(valor, valorQueLlegaAIlike(filtroOr([columna], texto)));
}

test("la búsqueda es literal: % _ \\ y * no son comodines de la persona", () => {
  assert.equal(busca("nombre", "100%", "Descuento 100% off"), true);
  assert.equal(busca("nombre", "100%", "Descuento 1000 off"), false);
  assert.equal(busca("nombre", "a_b", "xa_by"), true);
  assert.equal(busca("nombre", "a_b", "xaxby"), false);
  assert.equal(busca("nombre", "C:\\temp", "ruta C:\\temp\\x"), true);
  assert.equal(busca("nombre", "C:\\temp", "ruta C:/temp"), false);
  // el * se vuelve "un carácter cualquiera", no "cualquier cosa"
  assert.equal(busca("nombre", "a*b", "aXb"), true);
  assert.equal(busca("nombre", "a*b", "aXXXb"), false);
});

test("la búsqueda no distingue mayúsculas y encuentra en el medio", () => {
  assert.equal(busca("nombre", "club", "Sporting CLUB Norte"), true);
  assert.equal(busca("nombre", "norte", "Sporting Club"), false);
});

test("coma, paréntesis, comillas y puntos no rompen el .or()", () => {
  const filtro = filtroOr(["nombre", "email"], 'O\'Brien, "Juan" (hijo).x:y');
  // dos condiciones, y la coma del texto queda dentro de las comillas
  assert.equal(filtro.match(/\.ilike\./g)?.length, 2);
  assert.equal(busca("nombre", 'O\'Brien, "Juan" (hijo).x:y', 'Sr O\'Brien, "Juan" (hijo).x:y!'), true);
  // fuera de comillas solo queda la coma que separa las dos condiciones
  const sinComillas = filtro.replace(/"(?:[^"\\]|\\.)*"/g, "Q");
  assert.equal(sinComillas, "nombre.ilike.Q,email.ilike.Q");
});

test("filtroOr suma condiciones extra y condicionIn descarta lo que no es uuid", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  assert.deepEqual(condicionIn("id", [id, "no-es-uuid", "1) or (x"]), [`id.in.(${id})`]);
  assert.deepEqual(condicionIn("id", []), []);
  assert.equal(filtroOr(["nombre"], "x", condicionIn("id", [id])), `nombre.ilike."*x*",id.in.(${id})`);
});

test("escaparLike", () => {
  assert.equal(escaparLike("50%_\\"), "50\\%\\_\\\\");
  assert.equal(escaparLike("plano"), "plano");
});

test("terminos separa por espacios y pone tope", () => {
  assert.deepEqual(terminos("juan  perez"), ["juan", "perez"]);
  assert.deepEqual(terminos("a b c d e f", 3), ["a", "b", "c"]);
  assert.deepEqual(terminos(""), []);
});

test("textoParam limpia, colapsa y recorta", () => {
  assert.equal(textoParam("  hola   mundo \n"), "hola mundo");
  assert.equal(textoParam(["uno", "dos"]), "uno");
  assert.equal(textoParam(undefined), "");
  assert.equal(textoParam("x".repeat(500)).length, 100);
  assert.equal(textoParam("a\u0000b\u0007c"), "a b c");
});

test("opcionParam, uuidParam y fechaParam rechazan lo inventado", () => {
  assert.equal(opcionParam("cliente", ["potencial", "cliente"]), "cliente");
  assert.equal(opcionParam("hack", ["potencial", "cliente"]), "");
  assert.equal(opcionParam(undefined, ["potencial"]), "");
  const id = "AAAAAAAA-1111-2222-3333-444444444444";
  assert.equal(uuidParam(id), id.toLowerCase());
  assert.equal(uuidParam("1; drop table"), "");
  assert.equal(uuidParam(undefined), "");
  assert.equal(fechaParam("2026-02-28"), "2026-02-28");
  assert.equal(fechaParam("2026-02-31"), "");
  assert.equal(fechaParam("ayer"), "");
  assert.equal(fechaParam("0002-01-15"), "");
  assert.equal(fechaParam("1899-12-31"), "");
  assert.equal(fechaParam("1900-01-01"), "1900-01-01");
});

test("leerPaginacion: por defecto, límites y basura", () => {
  assert.deepEqual(leerPaginacion({}), { page: 1, pageSize: 20, desde: 0, hasta: 19 });
  assert.deepEqual(leerPaginacion({ page: "3", pageSize: "10" }), { page: 3, pageSize: 10, desde: 20, hasta: 29 });
  assert.equal(leerPaginacion({ page: "0" }).page, 1);
  assert.equal(leerPaginacion({ page: "-4" }).page, 1);
  assert.equal(leerPaginacion({ page: "2.5" }).page, 1);
  assert.equal(leerPaginacion({ page: "abc" }).page, 1);
  assert.equal(leerPaginacion({ page: "99999999999" }).page, 1);
  assert.equal(leerPaginacion({ pageSize: "7" }).pageSize, 20);
  assert.equal(leerPaginacion({ pageSize: "5000" }).pageSize, 20);
  assert.equal(leerPaginacion({ pageSize: "50" }).pageSize, 50);
  assert.equal(leerPaginacion({ page: ["2", "9"] }).page, 2);
});

test("rango, totalPaginas y textoRango", () => {
  assert.deepEqual(rango(2, 20), { desde: 20, hasta: 39 });
  assert.equal(totalPaginas(0, 20), 1);
  assert.equal(totalPaginas(20, 20), 1);
  assert.equal(totalPaginas(21, 20), 2);
  assert.equal(totalPaginas(134, 20), 7);
  assert.equal(textoRango(2, 20, 134), "Mostrando 21–40 de 134");
  assert.equal(textoRango(7, 20, 134), "Mostrando 121–134 de 134");
  assert.equal(textoRango(1, 20, 1), "Mostrando 1–1 de 1");
  assert.equal(textoRango(1, 20, 0), "Sin resultados");
});

test("ventanaPaginas: primera, última y vecinas, con puntos suspensivos", () => {
  assert.deepEqual(ventanaPaginas(1, 1), [1]);
  assert.deepEqual(ventanaPaginas(1, 3), [1, 2, 3]);
  assert.deepEqual(ventanaPaginas(1, 10), [1, 2, "…", 10]);
  assert.deepEqual(ventanaPaginas(5, 10), [1, "…", 4, 5, 6, "…", 10]);
  assert.deepEqual(ventanaPaginas(10, 10), [1, "…", 9, 10]);
  // un salto de una sola página se muestra entero, no se esconde tras un "…"
  assert.deepEqual(ventanaPaginas(4, 7), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(ventanaPaginas(3, 10), [1, 2, 3, 4, "…", 10]);
});

test("urlConParams conserva el resto, borra vacíos y no escribe los valores por defecto", () => {
  assert.equal(urlConParams("/empresas", {}, {}), "/empresas");
  assert.equal(urlConParams("/empresas", { q: "club", estado: "cliente" }, { page: "2" }), "/empresas?q=club&estado=cliente&page=2");
  assert.equal(urlConParams("/empresas", { q: "club", page: "4" }, { page: "1" }), "/empresas?q=club");
  assert.equal(urlConParams("/empresas", { q: "club" }, { q: "" }), "/empresas");
  assert.equal(urlConParams("/empresas", { pageSize: "50" }, { pageSize: "20" }), "/empresas");
  assert.equal(urlConParams("/x", new URLSearchParams("a=1&b=2"), { b: null, c: "3" }), "/x?a=1&c=3");
  assert.equal(urlConParams("/x", { q: "a b&c" }, {}), "/x?q=a+b%26c");
  assert.equal(urlConParams("/x", { q: ["a", "b"] }, {}), "/x?q=a&q=b");
});

test("leerPagina: página normal, vacía en la primera y fuera de rango", async () => {
  const filas = Array.from({ length: 134 }, (_, i) => i);
  const consultar = async (desde: number, hasta: number) => {
    if (desde >= filas.length && desde > 0) {
      return { data: null, count: null, error: { code: "PGRST103", message: "Requested range not satisfiable" } };
    }
    return { data: filas.slice(desde, hasta + 1), count: filas.length, error: null };
  };

  const normal = await leerPagina(consultar, leerPaginacion({ page: "2" }));
  assert.equal(normal.filas.length, 20);
  assert.equal(normal.total, 134);
  assert.equal(normal.ultimaPagina, undefined);

  const fuera = await leerPagina(consultar, leerPaginacion({ page: "99" }));
  assert.deepEqual(fuera, { filas: [], total: 134, ultimaPagina: 7 });

  const vacia = async () => ({ data: [], count: 0, error: null });
  assert.deepEqual(await leerPagina(vacia, leerPaginacion({})), { filas: [], total: 0 });
  // pidieron la página 3 de una lista que quedó vacía: no hay a dónde redirigir
  assert.deepEqual(await leerPagina(vacia, leerPaginacion({ page: "3" })), { filas: [], total: 0, ultimaPagina: undefined });
});

test("leerPagina propaga los errores de la base en vez de mostrar una lista vacía", async () => {
  const roto = async () => ({ data: null, count: null, error: { code: "42P01", message: "no existe la tabla" } });
  await assert.rejects(() => leerPagina(roto, leerPaginacion({})), /no existe la tabla/);
});
