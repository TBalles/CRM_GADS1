/**
 * Self-check de las cuentas y reglas del presupuesto imprimible (F6). Correr con:
 *   node --test src/lib/presupuesto.check.ts
 *
 * Los numeros esperados estan calculados a mano, no con el codigo que se prueba.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  aCentavos,
  calcularTotales,
  discriminaIva,
  emisorDesdeJson,
  emisorDesdeOrganizacion,
  etiquetaCondicionIva,
  fechaVencimiento,
  formatCantidad,
  formatearNumero,
  formatPesos,
  importeLinea,
  leyendaIva,
  lineasDesdeJson,
  lineasParaGuardar,
  MAX_TOTAL,
  problemaDelDocumento,
  sumarDias,
  tituloActividad,
  validarLineas,
  validezValida,
  type LineaPresupuesto,
} from "./presupuesto.ts";

const linea = (p: Partial<LineaPresupuesto> = {}): LineaPresupuesto => ({
  producto_id: null,
  descripcion: "Arco de fútbol 5/7",
  cantidad: 1,
  precio_unitario: 0,
  descuento_pct: 0,
  ...p,
});

test("redondeo a centavos: medio hacia arriba, sin los errores binarios de los flotantes", () => {
  assert.equal(aCentavos(1.005), 101); // Math.round(1.005 * 100) daria 100
  assert.equal(aCentavos(0.1 + 0.2), 30);
  assert.equal(aCentavos(1234.567), 123457);
  assert.equal(aCentavos(0), 0);
  assert.equal(aCentavos(Number.NaN), 0);
  assert.equal(aCentavos(Number.POSITIVE_INFINITY), 0);
});

test("importe de una linea: cantidad x precio menos el descuento de esa linea", () => {
  // 3 x 1.000 = 3.000; 10 % = 300; neto 2.700 (en centavos)
  assert.deepEqual(importeLinea({ cantidad: 3, precio_unitario: 1000, descuento_pct: 10 }), {
    brutoC: 300000,
    descuentoC: 30000,
    netoC: 270000,
  });
  // 2,5 unidades a $19,99 = 49,975 -> 49,98 (medio hacia arriba); 0 % no descuenta
  assert.deepEqual(importeLinea({ cantidad: 2.5, precio_unitario: 19.99, descuento_pct: 0 }), {
    brutoC: 4998,
    descuentoC: 0,
    netoC: 4998,
  });
  // 3 x $0,10 = 0,30 exacto (los flotantes darian 0,30000000000000004)
  assert.equal(importeLinea({ cantidad: 3, precio_unitario: 0.1, descuento_pct: 0 }).brutoC, 30);
  // un descuento de 33,33 % sobre $100,00 = $33,33
  assert.equal(importeLinea({ cantidad: 1, precio_unitario: 100, descuento_pct: 33.33 }).descuentoC, 3333);
});

test("Responsable Inscripto: precios netos, IVA 21 % sobre el neto y total con IVA", () => {
  const t = calcularTotales(
    [
      linea({ cantidad: 2, precio_unitario: 450000 }), // 900.000
      linea({ cantidad: 3, precio_unitario: 1000, descuento_pct: 10 }), // 3.000 - 300
    ],
    "responsable_inscripto",
  );
  assert.equal(t.subtotal, 903000);
  assert.equal(t.descuento, 300);
  assert.equal(t.neto, 902700);
  assert.equal(t.discrimina, true);
  assert.equal(t.iva, 189567); // 902.700 x 0,21 = 189.567
  assert.equal(t.total, 1092267);
});

test("el IVA se redondea al centavo sobre el neto, no linea por linea", () => {
  // 3 lineas de $0,10: neto $0,30 -> IVA 0,063 = $0,06; total $0,36
  const t = calcularTotales([linea({ precio_unitario: 0.1 }), linea({ precio_unitario: 0.1 }), linea({ precio_unitario: 0.1 })], "responsable_inscripto");
  assert.equal(t.neto, 0.3);
  assert.equal(t.iva, 0.06);
  assert.equal(t.total, 0.36);
  // $0,50 -> IVA 0,105 -> $0,11 (medio hacia arriba)
  const m = calcularTotales([linea({ precio_unitario: 0.5 })], "responsable_inscripto");
  assert.equal(m.iva, 0.11);
  assert.equal(m.total, 0.61);
});

test("Monotributo, Exento o sin condicion: no se discrimina IVA y el total es el neto", () => {
  for (const cond of ["monotributo", "exento", null, undefined, ""]) {
    const t = calcularTotales([linea({ cantidad: 2, precio_unitario: 1500 })], cond);
    assert.equal(t.discrimina, false, String(cond));
    assert.equal(t.iva, 0);
    assert.equal(t.total, 3000);
    assert.equal(t.neto, 3000);
  }
});

test("discriminaIva y la leyenda dependen de la condicion del proveedor", () => {
  assert.equal(discriminaIva("responsable_inscripto"), true);
  assert.equal(discriminaIva("monotributo"), false);
  assert.equal(discriminaIva("exento"), false);
  assert.equal(discriminaIva(null), false);
  assert.match(leyendaIva("responsable_inscripto"), /netos de IVA/);
  assert.match(leyendaIva("monotributo"), /Monotributista/);
  assert.match(leyendaIva("exento"), /exento de IVA/);
  assert.equal(leyendaIva(null), "Precios en pesos argentinos. IVA según condición.");
});

test("la condicion del proveedor se escribe en el encabezado; sin condicion no se inventa una", () => {
  assert.equal(etiquetaCondicionIva("responsable_inscripto"), "IVA Responsable Inscripto");
  assert.equal(etiquetaCondicionIva("monotributo"), "Monotributo");
  assert.equal(etiquetaCondicionIva("exento"), "IVA Exento");
  assert.equal(etiquetaCondicionIva(null), null);
  assert.equal(etiquetaCondicionIva("consumidor_final"), null);
});

test("un presupuesto sin lineas suma cero y no rompe", () => {
  const t = calcularTotales([], "responsable_inscripto");
  assert.deepEqual([t.subtotal, t.descuento, t.neto, t.iva, t.total], [0, 0, 0, 0, 0]);
});

test("descuento del 100 % deja la linea en cero", () => {
  const t = calcularTotales([linea({ cantidad: 4, precio_unitario: 250, descuento_pct: 100 })], "responsable_inscripto");
  assert.equal(t.subtotal, 1000);
  assert.equal(t.descuento, 1000);
  assert.equal(t.total, 0);
});

test("formato del dinero: es-AR con centavos, y la cantidad sin ceros de mas", () => {
  assert.equal(formatPesos(1234.5), "$1.234,50");
  assert.equal(formatPesos(0), "$0,00");
  assert.equal(formatPesos(1092267), "$1.092.267,00");
  assert.equal(formatPesos(null), "—");
  assert.equal(formatCantidad(2), "2");
  assert.equal(formatCantidad(2.5), "2,5");
  assert.equal(formatCantidad(1000), "1.000");
});

test("numero del presupuesto: N° con seis cifras; sin numero es un borrador", () => {
  assert.equal(formatearNumero(1), "N° 000001");
  assert.equal(formatearNumero(42), "N° 000042");
  assert.equal(formatearNumero(1234567), "N° 1234567"); // pasa de seis cifras: no se corta
  assert.equal(formatearNumero(null), "Borrador");
  assert.equal(formatearNumero(undefined), "Borrador");
  assert.equal(formatearNumero(0), "Borrador");
  assert.equal(formatearNumero(2.5), "Borrador");
});

test("validez: aritmetica de fechas sin zona horaria (meses, anios y bisiestos)", () => {
  assert.equal(sumarDias("2026-10-04", 15), "2026-10-19");
  assert.equal(sumarDias("2026-10-20", 15), "2026-11-04"); // cruza de mes
  assert.equal(sumarDias("2026-12-20", 15), "2027-01-04"); // cruza de anio
  assert.equal(sumarDias("2028-02-20", 10), "2028-03-01"); // 2028 es bisiesto
  assert.equal(sumarDias("2027-02-20", 10), "2027-03-02"); // 2027 no
  assert.equal(sumarDias("2026-10-04", 0), "2026-10-04");
  assert.equal(fechaVencimiento("2026-10-04", 30), "2026-11-03");
  // entrada invalida: se devuelve tal cual en vez de inventar una fecha
  assert.equal(sumarDias("2026-02-31", 5), "2026-02-31");
  assert.equal(sumarDias("2026-10-04", 1.5), "2026-10-04");
});

test("la validez es un entero de 1 a 365, como el CHECK de la base", () => {
  assert.equal(validezValida(15), true);
  assert.equal(validezValida(1), true);
  assert.equal(validezValida(365), true);
  assert.equal(validezValida(0), false);
  assert.equal(validezValida(366), false);
  assert.equal(validezValida(7.5), false);
  assert.equal(validezValida(Number.NaN), false);
});

test("validar lineas: descripcion, cantidad, precio y descuento, con el indice de la linea", () => {
  assert.deepEqual(validarLineas([linea({ precio_unitario: 10 })]), []);
  const errores = validarLineas([
    linea({ precio_unitario: 10 }),
    linea({ descripcion: "  ", cantidad: 0, precio_unitario: -1, descuento_pct: 101 }),
  ]);
  assert.deepEqual(
    errores.map((e) => [e.indice, e.campo]),
    [
      [1, "descripcion"],
      [1, "cantidad"],
      [1, "precio_unitario"],
      [1, "descuento_pct"],
    ],
  );
  assert.equal(validarLineas([linea({ cantidad: Number.NaN })]).length, 1);
  assert.equal(validarLineas([linea({ descuento_pct: 100 })]).length, 0);
});

test("problema del documento: sin lineas o con un total que no entra en la columna", () => {
  assert.equal(problemaDelDocumento([], 0), "Agregá al menos una línea.");
  assert.equal(problemaDelDocumento([linea()], 100), null);
  assert.match(problemaDelDocumento([linea()], MAX_TOTAL + 1) ?? "", /demasiado grande/);
  assert.match(problemaDelDocumento(Array.from({ length: 201 }, () => linea()), 1) ?? "", /hasta 200/);
});

test("leer el jsonb de la base: descarta lo que no es una linea y sanea los numeros", () => {
  assert.deepEqual(lineasDesdeJson(null), []);
  assert.deepEqual(lineasDesdeJson({ a: 1 }), []);
  const l = lineasDesdeJson([
    { producto_id: "p1", descripcion: "Red", cantidad: 2, precio_unitario: 65000, descuento_pct: 5 },
    { descripcion: "Texto libre", cantidad: "3", precio_unitario: "10.5" },
    "basura",
    null,
    [],
    { descripcion: 7, cantidad: "x", precio_unitario: null },
  ]);
  assert.equal(l.length, 3);
  assert.deepEqual(l[0], { producto_id: "p1", descripcion: "Red", cantidad: 2, precio_unitario: 65000, descuento_pct: 5 });
  assert.deepEqual(l[1], { producto_id: null, descripcion: "Texto libre", cantidad: 3, precio_unitario: 10.5, descuento_pct: 0 });
  assert.deepEqual(l[2], { producto_id: null, descripcion: "", cantidad: 1, precio_unitario: 0, descuento_pct: 0 });
});

test("lo que se guarda: campos conocidos, descripcion recortada y precio al centavo", () => {
  const [g] = lineasParaGuardar([linea({ descripcion: "  Red  ", precio_unitario: 10.005, producto_id: "p1" })]);
  assert.deepEqual(g, { producto_id: "p1", descripcion: "Red", cantidad: 1, precio_unitario: 10.01, descuento_pct: 0 });
});

test("la foto del emisor: recorta, descarta lo vacio y usa el nombre si no hay razon social", () => {
  const org = { nombre: "Org", razon_social: "  Equipos SRL ", cuit: "30-1", direccion: "", telefono: null, email: " v@x.com ", sitio_web: "   " };
  assert.deepEqual(emisorDesdeOrganizacion(org), {
    razon_social: "Equipos SRL",
    cuit: "30-1",
    direccion: null,
    telefono: null,
    email: "v@x.com",
    sitio_web: null,
  });
  assert.equal(emisorDesdeOrganizacion({ ...org, razon_social: null }).razon_social, "Org");
  // ida y vuelta por el jsonb: lo guardado se lee igual
  assert.deepEqual(emisorDesdeJson(JSON.parse(JSON.stringify(emisorDesdeOrganizacion(org)))), emisorDesdeOrganizacion(org));
});

test("leer el emisor del jsonb: vacio, roto o con tipos raros no rompe", () => {
  const vacio = { razon_social: null, cuit: null, direccion: null, telefono: null, email: null, sitio_web: null };
  assert.deepEqual(emisorDesdeJson({}), vacio);
  assert.deepEqual(emisorDesdeJson(null), vacio);
  assert.deepEqual(emisorDesdeJson([1, 2]), vacio);
  assert.deepEqual(emisorDesdeJson({ cuit: 30123, razon_social: " X ", logo_path: "no-va" }), { ...vacio, razon_social: "X" });
});

test("el titulo de la actividad lleva el numero y la oportunidad", () => {
  assert.equal(tituloActividad(7, "Redes del club"), "Envío de presupuesto N° 000007: Redes del club");
  assert.ok(tituloActividad(7, "x".repeat(500)).length <= 200);
});
