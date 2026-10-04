/**
 * Self-check de la búsqueda global (lógica pura) y de la lista de pantallas. Correr con:
 *   node --test src/lib/paleta.check.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import { RUTAS, rutasVisibles, tieneTodos } from "./navegacion.ts";
import {
  MAX_POR_GRUPO,
  accionesRapidas,
  anuncio,
  aplanar,
  consultaBuscable,
  gruposPermitidos,
  moverIndice,
  ordenarGrupos,
} from "./paleta.ts";
import { ROLES_POR_DEFECTO, esPermiso } from "./permisos.ts";

const rol = (nombre: string) => ROLES_POR_DEFECTO.find((r) => r.nombre === nombre)!.permisos as string[];
const admin = rol("Administrador");
const vendedor = rol("Vendedor");
const responsable = rol("Responsable comercial");
const lectura = rol("Solo lectura");

test("todas las rutas piden permisos que existen en el catálogo", () => {
  for (const r of RUTAS) for (const p of r.permisos) assert.ok(esPermiso(p), `${r.href}: ${p}`);
  assert.equal(new Set(RUTAS.map((r) => r.href)).size, RUTAS.length);
});

test("el menú por rol: el Vendedor no ve las dos pantallas del equipo; el Responsable sí; Solo lectura no ve oportunidades", () => {
  const hrefs = (p: string[]) => rutasVisibles(p).map((r) => r.href);
  assert.ok(!hrefs(vendedor).includes("/tablero-comercial"));
  assert.ok(!hrefs(vendedor).includes("/embudo"));
  assert.ok(hrefs(vendedor).includes("/oportunidades"));
  assert.ok(hrefs(responsable).includes("/tablero-comercial"));
  assert.ok(hrefs(responsable).includes("/embudo"));
  assert.ok(hrefs(admin).includes("/tablero-comercial") && hrefs(admin).includes("/embudo"));
  // Solo lectura ve la cartera de todos pero no las oportunidades: no hay nada que mostrarle en esas dos pantallas.
  assert.ok(!hrefs(lectura).includes("/tablero-comercial"));
  assert.ok(!hrefs(lectura).includes("/embudo"));
  assert.deepEqual(rutasVisibles([]), []);
  assert.ok(tieneTodos(["a", "b"], ["a"]));
  assert.ok(!tieneTodos(["a"], ["a", "b"]));
});

test("en qué tablas se busca según el rol", () => {
  assert.deepEqual(gruposPermitidos(admin), ["empresas", "contactos", "oportunidades", "productos"]);
  assert.deepEqual(gruposPermitidos(vendedor), ["empresas", "contactos", "oportunidades", "productos"]);
  assert.deepEqual(gruposPermitidos(lectura), ["empresas", "contactos", "productos"]); // sin oportunidades.ver
  assert.deepEqual(gruposPermitidos(["productos.ver"]), ["productos"]);
  assert.deepEqual(gruposPermitidos([]), []);
});

test("la consulta se limpia y exige 2 caracteres", () => {
  assert.equal(consultaBuscable("  club   norte "), "club norte");
  assert.equal(consultaBuscable("ab"), "ab");
  assert.equal(consultaBuscable("a"), null);
  assert.equal(consultaBuscable("   a   "), null);
  assert.equal(consultaBuscable(""), null);
  assert.equal(consultaBuscable("\u0000\u0007 \n"), null);
  assert.equal(consultaBuscable(42), null);
  assert.equal(consultaBuscable(null), null);
  assert.equal(consultaBuscable({ toString: () => "hack" }), null);
  assert.equal(consultaBuscable("x".repeat(500))?.length, 100);
  // lo hostil no se descarta ni se reescribe acá: se escapa al armar el filtro (paginacion.filtroOr)
  assert.equal(consultaBuscable(`O'Brien, "Juan" (hijo) 100% a_b \\`), `O'Brien, "Juan" (hijo) 100% a_b \\`);
});

const r = (id: string) => ({ id, titulo: `T${id}`, detalle: "", href: `/x/${id}` });

test("grupos: orden fijo, sin vacíos y con tope por grupo", () => {
  const grupos = ordenarGrupos({
    productos: [r("p1")],
    oportunidades: [],
    contactos: [r("c1"), r("c2"), r("c3"), r("c4"), r("c5"), r("c6"), r("c7")],
    empresas: [r("e1")],
  });
  assert.deepEqual(grupos.map((g) => g.clave), ["empresas", "contactos", "productos"]);
  assert.equal(grupos[1].resultados.length, MAX_POR_GRUPO);
  assert.deepEqual(grupos[1].titulo, "Contactos");
  assert.deepEqual(ordenarGrupos({}), []);
});

test("acciones con la caja vacía: solo las que el rol puede abrir, en orden de uso", () => {
  const titulos = (p: string[], texto = "") => accionesRapidas(p, texto, 20).map((a) => a.titulo);
  assert.deepEqual(titulos(vendedor).slice(0, 3), ["Ir a Oportunidades", "Ir a Empresas", "Ir a Alertas"]);
  assert.ok(!titulos(vendedor).includes("Ir a Conversión del embudo"));
  assert.ok(titulos(responsable).includes("Ir a Tablero comercial"));
  assert.deepEqual(titulos([]), []);
  assert.equal(accionesRapidas(admin, "", 3).length, 3);
});

test("acciones con texto: por nombre de pantalla, sin tildes ni mayúsculas, primero las que empiezan", () => {
  const t = (texto: string) => accionesRapidas(admin, texto, 20).map((a) => a.titulo);
  assert.deepEqual(t("ALERT"), ["Ir a Alertas"]);
  assert.deepEqual(t("conversion"), ["Ir a Conversión del embudo"]);
  assert.deepEqual(t("embudo"), ["Ir a Conversión del embudo"]); // empieza una palabra del nombre
  assert.deepEqual(t("configuracion"), ["Ir a Configuración"]);
  // "o": empieza Oportunidades; las que solo la contienen van después, en orden de uso
  assert.deepEqual(t("o").slice(0, 3), ["Ir a Oportunidades", "Ir a Contactos", "Ir a Productos"]);
  assert.deepEqual(t("zzz"), []);
  // un rol que no puede abrir la pantalla no la recibe ni buscándola
  assert.deepEqual(accionesRapidas(vendedor, "tablero", 20), []);
});

test("las flechas dan la vuelta y sin opciones no hay índice", () => {
  assert.equal(moverIndice(-1, 1, 3), 0);
  assert.equal(moverIndice(-1, -1, 3), 2);
  assert.equal(moverIndice(2, 1, 3), 0);
  assert.equal(moverIndice(0, -1, 3), 2);
  assert.equal(moverIndice(1, 1, 3), 2);
  assert.equal(moverIndice(5, 1, 3), 0); // un índice viejo que ya no existe
  assert.equal(moverIndice(0, 1, 0), -1);
});

test("aplanar: resultados y después acciones, con ids únicos por grupo", () => {
  const grupos = ordenarGrupos({ empresas: [r("1")], contactos: [r("1")] });
  const acciones = accionesRapidas(["clientes.ver"], "", 5);
  const opciones = aplanar(grupos, acciones);
  assert.deepEqual(opciones.map((o) => o.id), ["empresas:1", "contactos:1", "ir:/empresas", "ir:/contactos"]);
  assert.deepEqual(opciones.map((o) => o.grupo), ["Empresas", "Contactos", "Ir a", "Ir a"]);
  assert.equal(new Set(opciones.map((o) => o.id)).size, opciones.length);
});

test("lo que anuncia la región viva", () => {
  assert.equal(anuncio("cargando", 0), "Buscando…");
  assert.equal(anuncio("listo", 0), "Sin resultados");
  assert.equal(anuncio("listo", 1), "1 resultado");
  assert.equal(anuncio("listo", 4), "4 resultados");
  assert.equal(anuncio("error", 0), "No se pudo buscar.");
  assert.equal(anuncio("inactivo", 0), "");
});
