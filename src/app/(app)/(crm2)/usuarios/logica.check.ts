/**
 * Auto-chequeo de la lógica de Usuarios y roles: node --test "src/app/(app)/(crm2)/usuarios/logica.check.ts"
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { PERMISOS, type Permiso } from "../../../../lib/permisos.ts";
import { alternarPermiso, errorDeRol, estadoUsuario, gruposDePermisos } from "./logica.ts";

test("estadoUsuario: baja manda sobre pendiente", () => {
  assert.equal(estadoUsuario({ activo: false, activado_at: null }), "baja");
  assert.equal(estadoUsuario({ activo: true, activado_at: null }), "pendiente");
  assert.equal(estadoUsuario({ activo: true, activado_at: "2026-10-01T00:00:00Z" }), "activo");
});

test("gruposDePermisos cubre el catálogo entero, en orden y sin repetir grupos", () => {
  const grupos = gruposDePermisos();
  assert.deepEqual(grupos.flatMap(([, ps]) => ps.map((p) => p.clave)).sort(), PERMISOS.map((p) => p.clave).sort());
  assert.equal(new Set(grupos.map(([g]) => g)).size, grupos.length);
  assert.equal(grupos[0][0], PERMISOS[0].grupo);
});

test("alternarPermiso tilda lo que hace falta y destilda lo que depende", () => {
  const conVentas = alternarPermiso(new Set<Permiso>(), "ventas.editar");
  for (const p of ["ventas.editar", "ventas.ver", "clientes.ver", "productos.ver"] as Permiso[]) assert.ok(conVentas.has(p), p);
  const sinClientes = alternarPermiso(conVentas, "clientes.ver");
  assert.ok(!sinClientes.has("clientes.ver"));
  assert.ok(!sinClientes.has("ventas.ver"), "ventas.ver depende de clientes.ver");
  assert.ok(!sinClientes.has("ventas.editar"));
  assert.ok(sinClientes.has("productos.ver"), "lo que no depende queda");
});

test("errorDeRol: mensajes y orden de siempre", () => {
  const algo = new Set<Permiso>(["clientes.ver"]);
  assert.equal(errorDeRol("  ", algo, false), "Ponele un nombre al rol.");
  assert.equal(errorDeRol("RRHH", new Set(), false), "Elegí al menos un permiso.");
  assert.equal(errorDeRol("Admin 2", algo, true), "No podés quitarle a tu propio rol la gestión de usuarios.");
  assert.equal(errorDeRol("Admin 2", new Set<Permiso>(["usuarios.gestionar"]), true), null);
});
