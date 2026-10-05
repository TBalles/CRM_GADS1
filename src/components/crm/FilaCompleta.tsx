"use client";

import * as React from "react";

/**
 * Una fila de `DataTable` que ocupa TODAS las columnas visibles: el vacío o el error (`TableMessage`) y el detalle de una
 * fila desplegable (Ventas). Las columnas que el contenedor esconde (`hideBelow`, `display: none`) no cuentan en la
 * grilla de la tabla, así que un `colSpan` fijo con el total de columnas crea columnas fantasma que se comen el ancho (en
 * el celular la primera columna quedaba de 50 px y la regla de la cabecera, cortada). El servidor la dibuja con
 * `colSpan` (el total); en el navegador se ajusta a las cabeceras visibles antes de pintar y cada vez que la tabla cambia
 * de ancho (cruza un corte). Se escribe en el DOM: React no vuelve a tocar el atributo mientras la prop no cambie.
 */
export function FilaCompleta({
  id,
  colSpan,
  className,
  children,
}: {
  id?: string;
  /** El total de columnas (lo que dibuja el servidor). */
  colSpan: number;
  className?: string;
  children: React.ReactNode;
}) {
  const celda = React.useRef<HTMLTableCellElement>(null);
  React.useLayoutEffect(() => {
    const td = celda.current;
    const tabla = td?.closest("table");
    const cabeceras = tabla?.tHead?.rows[0]?.cells;
    if (!td || !tabla || !cabeceras) return;
    const medir = () => {
      td.colSpan = Math.max(1, [...cabeceras].filter((c) => getComputedStyle(c).display !== "none").length);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(tabla);
    return () => ro.disconnect();
  }, []);
  return (
    <tr id={id}>
      <td ref={celda} colSpan={colSpan} className={className}>
        {children}
      </td>
    </tr>
  );
}
