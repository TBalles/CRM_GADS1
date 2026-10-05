/**
 * Auto-chequeo de la lógica de Ventas: node --test "src/app/(app)/(crm2)/ventas/logica.check.ts"
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { agruparItems, errorDeLineas, espejarEntregas, hoyLocal, textoItems, totalItems } from "./logica.ts";

test("agruparItems junta los ítems por venta y conserva el orden", () => {
  const m = agruparItems([
    { venta_id: "a", n: 1 },
    { venta_id: "b", n: 2 },
    { venta_id: "a", n: 3 },
  ]);
  assert.deepEqual(m.get("a")?.map((i) => i.n), [1, 3]);
  assert.deepEqual(m.get("b")?.map((i) => i.n), [2]);
  assert.equal(m.get("c"), undefined);
});

test("totalItems: precio × cantidad; sin precio cuenta 0", () => {
  assert.equal(totalItems([]), 0);
  assert.equal(totalItems([{ cantidad: 2, precio_unitario: 1500 }, { cantidad: 3, precio_unitario: null }]), 3000);
});

test("textoItems en singular y plural", () => {
  assert.equal(textoItems(1), "1 ítem");
  assert.equal(textoItems(0), "0 ítems");
  assert.equal(textoItems(4), "4 ítems");
});

test("espejarEntregas mueve solo las entregas que seguían a la fecha de la venta", () => {
  const out = espejarEntregas(
    [
      { k: 1, fechaEntrega: "2026-10-04" },
      { k: 2, fechaEntrega: "2026-09-01" },
    ],
    "2026-10-04",
    "2026-10-10",
  );
  assert.deepEqual(out.map((l) => l.fechaEntrega), ["2026-10-10", "2026-09-01"]);
});

test("errorDeLineas: mensajes y orden de siempre; ignora líneas sin producto", () => {
  assert.equal(errorDeLineas([{ productoId: "", cantidad: "1" }]), "Agregá al menos un producto.");
  assert.equal(errorDeLineas([{ productoId: "p", cantidad: "0" }]), "Las cantidades tienen que ser números enteros mayores a 0.");
  assert.equal(errorDeLineas([{ productoId: "p", cantidad: "1,5" }]), "Las cantidades tienen que ser números enteros mayores a 0.");
  assert.equal(errorDeLineas([{ productoId: "p", cantidad: "2" }, { productoId: "", cantidad: "x" }]), null);
});

test("hoyLocal da la fecha local, no la de UTC", () => {
  const d = new Date(2026, 9, 4, 23, 30);
  assert.equal(hoyLocal(d), "2026-10-04");
});
