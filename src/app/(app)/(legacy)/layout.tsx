/**
 * Pantallas todavía no migradas a CRM 2.0. Dentro del shell nuevo, su contenido conserva la geometría que le daba el
 * `<main>` del shell anterior: padding 12 (mobile) / 32 (desde md) y ancho máximo de 1280 centrado.
 *
 * Impresión (verificado en el DOM): el div de afuera es el hijo directo de `[data-app-main]`, así que es el que alcanza
 * la regla `[data-app-main] > div { max-width: none }` de globals.css (no tiene max-width: no cambia nada). El padding,
 * que antes estaba en el `<main>` (y globals.css lo ponía en 0 al imprimir), ahora está acá: lo saca `print:p-0`. El
 * `max-w-7xl` de adentro NO lo alcanza esa regla, pero 1280 px es más ancho que el área imprimible de una A4, así que no
 * limita nada en papel.
 *
 * Migrar una pantalla = moverla a `(crm2)`, donde no se impone nada (design-system/crm-2/README.md).
 */
export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 md:p-8 print:p-0">
      <div className="mx-auto w-full max-w-7xl">{children}</div>
    </div>
  );
}
