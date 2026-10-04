/**
 * Auto-chequeo del catalogo de permisos.
 *
 *   node --test src/lib/permisos.check.ts
 *
 * El catalogo esta en dos lugares que no se pueden importar entre si: este
 * modulo (TS) y la ultima migracion que redefine el CHECK de roles.permisos y
 * los roles por defecto (hoy, la 0007). Este test lee el SQL y falla si
 * divergen. Sin el, agregar un permiso en la app y no en la base haria que
 * guardar un rol con ese permiso explote con un error de CHECK.
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CLAVES_PERMISOS, PERMISOS, ROLES_POR_DEFECTO, conDependencias, rutaInicial } from "./permisos.ts";

const SQL = readFileSync(new URL("../../supabase/migrations/0007_entrega_final.sql", import.meta.url), "utf8");

const claves = (texto: string) => [...texto.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]).sort();

test("el CHECK de roles.permisos tiene exactamente las claves del catálogo", () => {
  const bloque = SQL.match(/roles_permisos_validos check \(permisos <@ array\[([\s\S]*?)\]::text\[\]\)/);
  assert.ok(bloque, "no se encontró el CHECK roles_permisos_validos en la migración");
  assert.deepEqual(claves(bloque[1]), [...CLAVES_PERMISOS].sort());
});

test("los roles por defecto del SQL coinciden con ROLES_POR_DEFECTO", () => {
  for (const rol of ROLES_POR_DEFECTO) {
    const re = new RegExp(`\\(p_org, '${rol.nombre}', '[^']*', (true|false),\\s*array\\[([\\s\\S]*?)\\]\\)`);
    const m = SQL.match(re);
    assert.ok(m, `no se encontró el rol "${rol.nombre}" en crear_roles_iniciales`);
    assert.equal(m[1] === "true", rol.esAdmin, `es_admin distinto para "${rol.nombre}"`);
    assert.deepEqual(claves(m[2]), [...rol.permisos].sort(), `permisos distintos para "${rol.nombre}"`);
  }
});

test("todas las dependencias apuntan a permisos que existen", () => {
  for (const p of PERMISOS) {
    for (const r of p.requiere) assert.ok(CLAVES_PERMISOS.includes(r), `${p.clave} requiere ${r}, que no existe`);
  }
});

test("conDependencias agrega lo que hace falta, transitivamente", () => {
  // alertas.enviar -> alertas.ver -> ventas.ver -> clientes.ver + productos.ver
  assert.deepEqual(conDependencias(["alertas.enviar"]), [
    "clientes.ver",
    "productos.ver",
    "ventas.ver",
    "alertas.ver",
    "alertas.enviar",
  ]);
  assert.deepEqual(conDependencias([]), []);
});

test("asignar clientes implica ver la cartera de todos", () => {
  // Sin ver_todos, el selector de responsable ofrecería a quien el que asigna no puede ver el resultado.
  assert.ok(conDependencias(["clientes.asignar"]).includes("clientes.ver_todos"));
  assert.ok(conDependencias(["clientes.asignar"]).includes("clientes.editar"));
});

test("el rol Administrador tiene TODOS los permisos", () => {
  const admin = ROLES_POR_DEFECTO.find((r) => r.esAdmin);
  assert.deepEqual([...(admin?.permisos ?? [])].sort(), [...CLAVES_PERMISOS].sort());
});

test("rutaInicial lleva a la primera pantalla permitida", () => {
  assert.equal(rutaInicial(["tablero.ver", "clientes.ver"]), "/dashboard");
  assert.equal(rutaInicial(["clientes.ver", "productos.ver"]), "/empresas");
  assert.equal(rutaInicial(["usuarios.gestionar"]), "/usuarios");
  assert.equal(rutaInicial(["configuracion.gestionar"]), "/configuracion");
  assert.equal(rutaInicial([]), "/sin-permisos");
});
