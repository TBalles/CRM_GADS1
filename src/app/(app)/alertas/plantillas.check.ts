/**
 * Auto-chequeo de las plantillas de alerta.
 *
 *   node --test "src/app/(app)/alertas/plantillas.check.ts"
 *
 * Sin framework: Node 24 saca los tipos solo y `node:test` ya viene incluido.
 * Lo que se prueba es lo unico que tiene logica de verdad — el formateo de
 * fechas, el saludo y la frase de estado — no la redaccion.
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import {
  cuerpo,
  cuerpoWhatsapp,
  estadoEnPalabras,
  formatFecha,
  linkMailto,
  linkWhatsapp,
  saludo,
  type DatosAlerta,
} from "./plantillas.ts";

const base: DatosAlerta = {
  empresaNombre: "Club Atlético Ramos",
  contactoNombre: "Juan Pérez",
  productoNombre: "Red de arco 7.32 × 2.44",
  cantidad: 2,
  fechaEntrega: "2024-03-15",
  venceEl: "2026-03-15",
  diasRestantes: 30,
};

test("formatFecha pasa de ISO a dd/mm/aaaa sin tocar zonas horarias", () => {
  assert.equal(formatFecha("2024-03-15"), "15/03/2024");
  // Un timestamp completo se recorta a la fecha, no se reinterpreta.
  assert.equal(formatFecha("2024-03-15T23:30:00Z"), "15/03/2024");
  assert.equal(formatFecha(null), "—");
});

test("el saludo usa solo el nombre de pila", () => {
  assert.equal(saludo(base), "Hola Juan,");
});

test("sin contacto, el saludo apunta al club", () => {
  assert.equal(
    saludo({ ...base, contactoNombre: null }),
    "Hola, equipo de Club Atlético Ramos:",
  );
  // Un contacto en blanco tiene que caer en la misma rama que uno ausente.
  assert.equal(
    saludo({ ...base, contactoNombre: "   " }),
    "Hola, equipo de Club Atlético Ramos:",
  );
});

test("la frase de estado distingue vencido de por vencer", () => {
  const una = { ...base, cantidad: 1 };
  assert.equal(estadoEnPalabras(una), "cumple su vida útil estimada en 30 días");
  assert.equal(
    estadoEnPalabras({ ...una, diasRestantes: 1 }),
    "cumple su vida útil estimada en 1 día",
  );
  assert.equal(estadoEnPalabras({ ...una, diasRestantes: 0 }), "cumple hoy su vida útil estimada");
  assert.equal(
    estadoEnPalabras({ ...una, diasRestantes: -5 }),
    "superó su vida útil estimada hace 5 días",
  );
  // Pasados dos meses se cuenta en meses: "hace 240 días" no lo lee nadie.
  assert.equal(
    estadoEnPalabras({ ...una, diasRestantes: -240 }),
    "superó su vida útil estimada hace 8 meses",
  );
});

test("el verbo concuerda en plural (el bug del primer mail de prueba)", () => {
  // "las 2 unidades ... superó" salió así en el mail real.
  assert.equal(
    estadoEnPalabras({ ...base, diasRestantes: -12 }),
    "superaron su vida útil estimada hace 12 días",
  );
  assert.equal(estadoEnPalabras(base), "cumplen su vida útil estimada en 30 días");
  assert.equal(estadoEnPalabras({ ...base, diasRestantes: 0 }), "cumplen hoy su vida útil estimada");
  assert.match(cuerpoWhatsapp(base), /recambiarlas\?/);
  assert.match(cuerpoWhatsapp({ ...base, cantidad: 1 }), /recambiarla\?/);
});

test("sin fecha de vencimiento la frase no inventa un plazo", () => {
  const sinDatos = { ...base, venceEl: null, diasRestantes: null };
  assert.equal(estadoEnPalabras(sinDatos), "están llegando al final de su vida útil");
  assert.equal(
    estadoEnPalabras({ ...sinDatos, cantidad: 1 }),
    "está llegando al final de su vida útil",
  );
});

test("el cuerpo concuerda en número con la cantidad", () => {
  assert.match(cuerpo(base), /las 2 unidades de Red de arco/);
  assert.match(cuerpo({ ...base, cantidad: 1 }), /la unidad de Red de arco/);
});

test("el mensaje de WhatsApp es más corto que el mail", () => {
  assert.ok(cuerpoWhatsapp(base).length < cuerpo(base).length);
});

test("linkWhatsapp deja solo dígitos en el número", () => {
  assert.match(linkWhatsapp("+54 9 11 5555-5555", "hola"), /^https:\/\/wa\.me\/5491155555555\?/);
});

test("linkMailto codifica los espacios como %20, no como +", () => {
  const link = linkMailto("a@b.com", "Asunto con espacios", "cuerpo con espacios");
  assert.ok(!link.includes("+"), `no debería haber "+" en: ${link}`);
  assert.match(link, /Asunto%20con%20espacios/);
});
