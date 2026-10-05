/**
 * Auto-chequeo de Configuración: node --test "src/app/(app)/(crm2)/configuracion/logica.check.ts"
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { hayCambios, hrefSeccion, moverEnCatalogo, seccionDe, valoresDe } from "./logica.ts";

test("seccionDe: ?s= válido, y todo lo demás cae en Datos de la empresa", () => {
  assert.equal(seccionDe("etapas"), "etapas");
  assert.equal(seccionDe("motivos"), "motivos");
  assert.equal(seccionDe(undefined), "empresa");
  assert.equal(seccionDe(null), "empresa");
  assert.equal(seccionDe(""), "empresa");
  assert.equal(seccionDe("Etapas"), "empresa");
  assert.equal(seccionDe("usuarios"), "empresa");
  assert.equal(seccionDe(["etapas", "tipos"]), "empresa");
});

test("hrefSeccion: la primera sin parámetro, el resto con ?s=, y vuelven a leerse igual", () => {
  assert.equal(hrefSeccion("empresa"), "/configuracion");
  assert.equal(hrefSeccion("origenes"), "/configuracion?s=origenes");
  for (const s of ["empresa", "etapas", "tipos", "origenes", "motivos"] as const) {
    assert.equal(seccionDe(new URL(hrefSeccion(s), "http://x").searchParams.get("s")), s);
  }
});

test("moverEnCatalogo: cruza dos filas y solo escribe las que cambian", () => {
  const l = [
    { id: "a", orden: 1 },
    { id: "b", orden: 2 },
    { id: "c", orden: 3 },
  ];
  const r = moverEnCatalogo(l, "c", -1)!;
  assert.deepEqual(r.nueva.map((x) => x.id), ["a", "c", "b"]);
  assert.deepEqual(r.cambios.map((c) => [c.item.id, c.orden]), [["c", 2], ["b", 3]]);
  assert.equal(moverEnCatalogo(l, "a", -1), null);
  assert.equal(moverEnCatalogo(l, "c", 1), null);
  assert.equal(moverEnCatalogo(l, "z", 1), null);
});

test("moverEnCatalogo: con huecos en el orden renumera 1..N (como el legacy)", () => {
  const l = [
    { id: "a", orden: 1 },
    { id: "b", orden: 5 },
    { id: "c", orden: 9 },
  ];
  const r = moverEnCatalogo(l, "a", 1)!;
  assert.deepEqual(r.cambios.map((c) => [c.item.id, c.orden]), [["b", 1], ["a", 2], ["c", 3]]);
});

test("valoresDe / hayCambios: nulos como vacío, bordes ignorados, cualquier campo cuenta", () => {
  const org = {
    razon_social: null,
    cuit: "30-00000000-0",
    condicion_iva: "monotributo",
    direccion: null,
    telefono: null,
    email: "a@b.com",
    sitio_web: null,
    presupuesto_validez_dias: 15,
    presupuesto_condiciones: null,
  };
  const g = valoresDe(org);
  assert.equal(g.razonSocial, "");
  assert.equal(g.validez, "15");
  assert.equal(hayCambios({ ...g }, g), false);
  assert.equal(hayCambios({ ...g, email: " a@b.com " }, g), false);
  assert.equal(hayCambios({ ...g, validez: "16" }, g), true);
  assert.equal(hayCambios({ ...g, condicionIva: "" }, g), true);
  assert.equal(hayCambios({ ...g, condiciones: "Contado" }, g), true);
});
