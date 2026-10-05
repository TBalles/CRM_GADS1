/**
 * Lógica pura del editor de presupuesto (las líneas mientras se editan), sin React ni red: la prueba `logica.check.ts`
 * con `node --test`. Las cuentas, el IVA, la numeración y las validaciones siguen en `lib/presupuesto.ts` (sin cambios).
 * Imports relativos con `.ts`: Node no resuelve el alias "@/…".
 */
import { maskFromNumber, parseMoney } from "../../../../../../lib/money.ts";
import { formatCantidad, type LineaPresupuesto } from "../../../../../../lib/presupuesto.ts";

/** Una línea mientras se edita: los números son el texto del campo (con la máscara es-AR). */
export type LineaEdit = { key: string; producto_id: string | null; descripcion: string; cantidad: string; precio: string; descuento: string };

export type ProductoCatalogo = { id: string; nombre: string; precio: number | null };

export const aLinea = (l: LineaEdit): LineaPresupuesto => ({
  producto_id: l.producto_id,
  descripcion: l.descripcion,
  cantidad: parseMoney(l.cantidad),
  precio_unitario: parseMoney(l.precio),
  descuento_pct: parseMoney(l.descuento),
});

export const deLinea = (l: LineaPresupuesto, key: string): LineaEdit => ({
  key,
  producto_id: l.producto_id,
  descripcion: l.descripcion,
  cantidad: formatCantidad(l.cantidad),
  precio: maskFromNumber(l.precio_unitario),
  descuento: l.descuento_pct ? formatCantidad(l.descuento_pct) : "",
});

/**
 * El borrador arranca con lo que la oportunidad ya sabe: su producto (con el precio de catálogo) o, si no, su valor
 * estimado. Sin ninguno de los dos, sin líneas. La línea inicial es "l0"; las que se agregan después, "n1", "n2"…
 */
export function lineasIniciales(
  oportunidad: { titulo: string; producto_id: string | null; monto: number | null },
  productos: readonly ProductoCatalogo[],
): LineaEdit[] {
  const producto = oportunidad.producto_id ? productos.find((p) => p.id === oportunidad.producto_id) : undefined;
  const precio = producto?.precio ?? oportunidad.monto;
  if (!producto && precio == null) return [];
  return [
    {
      key: "l0",
      producto_id: producto?.id ?? null,
      descripcion: producto?.nombre ?? oportunidad.titulo,
      cantidad: "1",
      precio: precio == null ? "" : maskFromNumber(precio),
      descuento: "",
    },
  ];
}

export const lineaLibre = (key: string): LineaEdit => ({ key, producto_id: null, descripcion: "", cantidad: "1", precio: "", descuento: "" });

export const lineaDeProducto = (key: string, p: ProductoCatalogo): LineaEdit => ({
  key,
  producto_id: p.id,
  descripcion: p.nombre,
  cantidad: "1",
  precio: p.precio == null ? "" : maskFromNumber(p.precio),
  descuento: "",
});

/** Elegir un producto en una línea: nombre y precio de catálogo (si tiene); "Texto libre" solo suelta el producto. */
export function cambioDeProducto(p: ProductoCatalogo | undefined): Partial<LineaEdit> {
  if (!p) return { producto_id: null };
  return { producto_id: p.id, descripcion: p.nombre, ...(p.precio == null ? {} : { precio: maskFromNumber(p.precio) }) };
}

/** Sube (−1) o baja (+1) la línea `indice`. En el borde devuelve la MISMA lista (React no redibuja). */
export function moverLinea<T>(lista: readonly T[], indice: number, delta: -1 | 1): readonly T[] {
  const destino = indice + delta;
  if (indice < 0 || indice >= lista.length || destino < 0 || destino >= lista.length) return lista;
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

/**
 * Después de mover, el foco sigue en el mismo botón de la línea movida; si quedó en el borde (ese botón se deshabilita),
 * pasa al otro ("Subir" en la primera -> "Bajar").
 */
export function botonTrasMover(indiceNuevo: number, total: number, delta: -1 | 1): "subir" | "bajar" {
  if (delta === -1) return indiceNuevo === 0 && total > 1 ? "bajar" : "subir";
  return indiceNuevo === total - 1 && total > 1 ? "subir" : "bajar";
}

/** Al quitar una línea, el foco va a la que ocupa su lugar (la siguiente), si no a la anterior; sin líneas, null. */
export function focoTrasQuitar(keys: readonly string[], key: string): string | null {
  const i = keys.indexOf(key);
  if (i < 0) return null;
  return keys[i + 1] ?? keys[i - 1] ?? null;
}
