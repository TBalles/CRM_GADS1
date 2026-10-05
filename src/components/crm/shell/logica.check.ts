/**
 * Self-check del shell de CRM 2.0 (lógica pura): rail por rol, cookie del rail y migas de pan. Correr con:
 *   node --test src/components/crm/shell/logica.check.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import { RUTAS, SECCIONES, rutaActual, seccionesVisibles } from "../../../lib/navegacion.ts";
import { ROLES_POR_DEFECTO } from "../../../lib/permisos.ts";
import { FICHA, RAIL_COOKIE, cookieRail, fichaDe, migas, railColapsado } from "./logica.ts";

const rol = (nombre: string) => ROLES_POR_DEFECTO.find((r) => r.nombre === nombre)!.permisos as string[];
const titulos = (p: string[]) => seccionesVisibles(p).map((s) => s.titulo);
const hrefs = (p: string[]) => seccionesVisibles(p).flatMap((s) => s.rutas.map((r) => r.href));

test("rail: cada ruta en una sección conocida, y el orden del rail es el de RUTAS", () => {
  for (const r of RUTAS) assert.ok(SECCIONES.includes(r.seccion), r.href);
  assert.deepEqual(hrefs(rol("Administrador")), RUTAS.map((r) => r.href));
});

test("rail por rol: el Administrador ve las cuatro secciones; las vacías no aparecen", () => {
  assert.deepEqual(titulos(rol("Administrador")), ["Comercial", "Operación", "Análisis", "Administración"]);
  // El Vendedor no ve Análisis (le falta clientes.ver_todos) ni Administración.
  assert.deepEqual(titulos(rol("Vendedor")), ["Comercial", "Operación"]);
  assert.ok(!hrefs(rol("Vendedor")).includes("/usuarios"));
  assert.deepEqual(
    seccionesVisibles(rol("Administrador")).find((s) => s.titulo === "Comercial")?.rutas.map((r) => r.label),
    ["Inicio", "Oportunidades", "Empresas", "Contactos"],
  );
  assert.deepEqual(seccionesVisibles([]), []);
  // Un permiso suelto: solo su sección.
  assert.deepEqual(titulos(["configuracion.gestionar"]), ["Administración"]);
});

test("ruta actual: el detalle cuelga de su sección, sin confundir prefijos", () => {
  assert.equal(rutaActual("/empresas")?.href, "/empresas");
  assert.equal(rutaActual("/empresas/123")?.href, "/empresas");
  assert.equal(rutaActual("/empresasx"), undefined);
  assert.equal(rutaActual("/tablero-comercial")?.href, "/tablero-comercial");
  assert.equal(rutaActual("/"), undefined);
});

test("cookie del rail: ida y vuelta, y cualquier otro valor es expandido", () => {
  const valor = (c: string) => c.split(";")[0].split("=")[1];
  assert.ok(cookieRail(true).startsWith(`${RAIL_COOKIE}=collapsed;`));
  assert.equal(railColapsado(valor(cookieRail(true))), true);
  assert.equal(railColapsado(valor(cookieRail(false))), false);
  assert.match(cookieRail(true), /Path=\/; Max-Age=\d+; SameSite=Lax$/);
  for (const raro of [undefined, null, "", "COLLAPSED", "collapsed ", "1", "<script>"]) assert.equal(railColapsado(raro), false);
});

test("migas: lista, ficha (con y sin nombre) y presupuesto", () => {
  assert.deepEqual(migas("/empresas"), [{ label: "Empresas", href: "/empresas" }]);
  assert.deepEqual(migas("/dashboard"), [{ label: "Inicio", href: "/dashboard" }]);
  assert.deepEqual(migas("/empresas/abc"), [
    { label: "Empresas", href: "/empresas" },
    { label: FICHA, href: "/empresas/abc" },
  ]);
  assert.deepEqual(migas("/empresas/abc", { "/empresas/abc": "Complejo La Tablada" })[1], {
    label: "Complejo La Tablada",
    href: "/empresas/abc",
  });
  // El nombre de OTRA ficha no se usa; uno en blanco tampoco.
  assert.equal(migas("/empresas/abc", { "/empresas/xyz": "Otro" })[1].label, FICHA);
  assert.equal(migas("/empresas/abc", { "/empresas/abc": "   " })[1].label, FICHA);
  assert.deepEqual(
    migas("/oportunidades/o1/presupuesto", { "/oportunidades/o1": "Recambio cancha 2" }).map((m) => m.label),
    ["Oportunidades", "Recambio cancha 2", "Presupuesto"],
  );
  assert.equal(migas("/oportunidades/o1/presupuesto").at(-1)?.href, "/oportunidades/o1/presupuesto");
});

test("migas: pantallas sin ficha, rutas desconocidas y basura en la URL", () => {
  assert.deepEqual(migas("/alertas/xyz").map((m) => m.label), ["Alertas"]);
  assert.deepEqual(migas("/sin-permisos").map((m) => m.label), ["Sin permisos"]);
  assert.deepEqual(migas("/admin").map((m) => m.label), ["Clientes"]);
  assert.deepEqual(migas("/"), []);
  assert.deepEqual(migas("/no-existe/1"), []);
  assert.deepEqual(migas("/empresas?q=hola#x").map((m) => m.label), ["Empresas"]);
  assert.equal(fichaDe("/empresas/abc/algo"), "/empresas/abc");
  assert.equal(fichaDe("/alertas/abc"), null);
  assert.equal(fichaDe("/empresas"), null);
});
