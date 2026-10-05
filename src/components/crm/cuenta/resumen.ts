import type { Stat } from "../StatStrip";
import { formatFecha } from "@/lib/clientes";
import { TOPES } from "@/lib/cuenta360";
import { formatMoney } from "@/lib/money";
import { textoContacto, type ResumenCuenta } from "@/lib/timeline360";

/**
 * "Resumen de la cuenta" como cifras para `StatStrip`: las mismas que mostraba la tarjeta legacy, calculadas por
 * `resumenCuenta` con las filas que ya se trajeron. Lo que el rol no puede ver no se afirma (se omite, no se muestra 0).
 */
export function statsCuenta(
  r: ResumenCuenta,
  mostrar: { ventas: boolean; oportunidades: boolean; contacto: boolean },
  truncado: { ventas: boolean; oportunidades: boolean },
): Stat[] {
  const pesos = (n: number) => formatMoney(n).replace(/^\$/, "");
  const stats: Stat[] = [];
  if (mostrar.ventas) {
    stats.push(
      r.cantidadCompras > 0
        ? {
            label: "Total comprado",
            value: pesos(r.totalComprado),
            unit: "$",
            unitPosition: "before",
            detail: `${truncado.ventas ? "sumando solo las últimas " : "en "}${r.cantidadCompras} ${r.cantidadCompras === 1 ? "compra" : "compras"}`,
          }
        : { label: "Total comprado", value: "Sin compras", text: true },
      // Con una sola fecha de compra, "Primera" y "Última" dirían lo mismo: una sola cifra.
      ...(r.primeraCompra && r.primeraCompra === r.ultimaCompra
        ? [{ label: "Compró el", value: formatFecha(r.primeraCompra), text: true }]
        : [
            r.primeraCompra
              ? { label: "Primera compra", value: formatFecha(r.primeraCompra), text: true }
              : { label: "Primera compra", value: "Todavía no compró", text: true },
            { label: "Última compra", value: r.ultimaCompra ? formatFecha(r.ultimaCompra) : undefined, text: true },
          ]),
    );
  }
  if (mostrar.oportunidades) {
    stats.push(
      r.abiertas.cantidad > 0
        ? {
            label: "Oportunidades abiertas",
            value: `${r.abiertas.cantidad}${truncado.oportunidades ? "+" : ""}`,
            detail: [
              r.abiertas.valor > 0 ? `${formatMoney(r.abiertas.valor)} en juego` : "",
              truncado.oportunidades ? `entre las ${TOPES.oportunidades} más recientes` : "",
            ]
              .filter(Boolean)
              .join(" · ") || undefined,
          }
        : { label: "Oportunidades abiertas", value: "Ninguna abierta", text: true },
    );
  }
  if (mostrar.contacto) {
    const alerta = r.tonoContacto === "atencion" || r.tonoContacto === "frio";
    stats.push({
      label: "Último contacto",
      value: textoContacto(r.diasDesdeContacto, r.tonoContacto),
      text: true,
      warning: alerta,
      detail: r.ultimoContacto ? `el ${formatFecha(r.ultimoContacto)}` : undefined,
    });
  }
  return stats;
}
