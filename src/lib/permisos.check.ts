/**
 * Auto-chequeo del catalogo de permisos.
 *
 *   node --test src/lib/permisos.check.ts
 *
 * El catalogo esta en dos lugares que no se pueden importar entre si: este
 * modulo (TS) y la migracion 0005 (SQL: el CHECK de roles.permisos y los roles
 * por defecto). Este test lee el SQL y falla si divergen. Sin el, agregar un
 * permiso en la app y no en la base haria que guardar un rol con ese permiso
 * explote con un error de CHECK.
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CLAVES_PERMISOS, PERMISOS, ROLES_POR_DEFECTO, conDependencias, rutaInicial } from "./permisos.ts";

const SQL = readFileSync(new URL("../../supabase/migrations/0005_roles_permisos.sql", import.meta.url), "utf8");

const claves = (texto: string) => [...texto.matchAll(/'([a-z]+\.[a-z]+)'/g)].map((m) => m[1]).sort();

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

test("el rol Administrador tiene TODOS los permisos", () => {
  const admin = ROLES_POR_DEFECTO.find((r) => r.esAdmin);
  assert.deepEqual([...(admin?.permisos ?? [])].sort(), [...CLAVES_PERMISOS].sort());
});

test("rutaInicial lleva a la primera pantalla permitida", () => {
  assert.equal(rutaInicial(["tablero.ver", "clientes.ver"]), "/dashboard");
  assert.equal(rutaInicial(["clientes.ver", "productos.ver"]), "/empresas");
  assert.equal(rutaInicial(["usuarios.gestionar"]), "/usuarios");
  assert.equal(rutaInicial([]), "/sin-permisos");
});
