import {
  calcularTotales,
  etiquetaCondicionIva,
  fechaVencimiento,
  formatCantidad,
  formatearNumero,
  formatPesos,
  importeLinea,
  leyendaIva,
  type Emisor,
  type LineaPresupuesto,
} from "@/lib/presupuesto";
import { formatFecha, nombreCompleto } from "@/lib/clientes";

/**
 * La hoja del presupuesto: ES PAPEL. Se movió tal cual desde el editor legacy (Lote D): markup, clases, fuente y estilos
 * de impresión (`.hoja-presupuesto`, `.sin-corte` en globals.css) no cambian. Sin "use client" ni hooks. No va dentro de
 * `UI_ROOT`: hereda la fuente global como siempre (en papel, Arial por globals.css).
 */

export type Empresa = { id: string; nombre: string; cuit: string | null; direccion: string | null; telefono: string | null; email: string | null };
export type Contacto = { id: string; nombre: string; apellido: string | null; cargo: string | null; email: string | null; telefono: string | null };

/**
 * Lo que dibuja la hoja: el borrador en edicion o un presupuesto guardado. El emisor y la condicion frente al IVA
 * de un presupuesto GUARDADO salen de su foto (columnas `emisor` y `condicion_iva`), no de la organizacion de hoy;
 * el logo y los datos del cliente y del contacto se leen siempre en vivo.
 */
export type Documento = {
  numero: number | null;
  emisor: Emisor;
  condicionIva: string | null;
  fecha: string;
  validezDias: number;
  condiciones: string;
  notas: string;
  lineas: LineaPresupuesto[];
};

/** El papel. Blanco y con texto oscuro en cualquier tema: es un documento, no una pantalla del CRM. */
export function Hoja({
  nombreOrganizacion,
  logoUrl,
  empresa,
  contacto,
  referencia,
  doc,
  totales,
}: {
  /** Nombre de la organizacion: solo si la foto del emisor no trae razon social. */
  nombreOrganizacion: string;
  logoUrl: string | null;
  empresa: Empresa | null;
  contacto: Contacto | null;
  referencia: string;
  doc: Documento;
  totales: ReturnType<typeof calcularTotales>;
}) {
  // Encabezado y IVA salen del documento (la foto del emisor si esta guardado), nunca de la organizacion de hoy.
  const emisor = doc.emisor;
  const nombre = emisor.razon_social ?? nombreOrganizacion;
  const condicion = etiquetaCondicionIva(doc.condicionIva);
  const vence = fechaVencimiento(doc.fecha, doc.validezDias);
  const contactoNombre = contacto ? nombreCompleto(contacto) : null;

  return (
    <article
      aria-label={`Hoja del presupuesto ${formatearNumero(doc.numero)}`}
      className="hoja-presupuesto mx-auto min-w-[40rem] max-w-[56rem] rounded-lg border border-slate-300 bg-white p-8 text-sm text-slate-900 shadow-sm"
    >
      {/* Encabezado: el logo y los datos son los del proveedor, nunca los de la plataforma */}
      <header className="flex items-start justify-between gap-6 border-b border-slate-300 pb-5">
        <div className="flex min-w-0 items-start gap-4">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- URL firmada que vence: next/image no aporta nada
            <img src={logoUrl} alt={nombre} className="max-h-20 w-auto max-w-[10rem] shrink-0 object-contain" />
          )}
          <div className="min-w-0">
            {/* Con logo, el nombre ya esta en el alt; igual se imprime en texto para que se lea en papel. */}
            <p className="break-words text-lg font-bold leading-tight">{nombre}</p>
            {emisor.cuit && <p className="text-xs text-slate-700">CUIT {emisor.cuit}</p>}
            {condicion && <p className="text-xs text-slate-700">{condicion}</p>}
            {emisor.direccion && <p className="break-words text-xs text-slate-700">{emisor.direccion}</p>}
            {(emisor.telefono || emisor.email) && (
              <p className="break-words text-xs text-slate-700">{[emisor.telefono && `Tel. ${emisor.telefono}`, emisor.email].filter(Boolean).join(" · ")}</p>
            )}
            {emisor.sitio_web && <p className="break-words text-xs text-slate-700">{emisor.sitio_web}</p>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <h2 className="text-xl font-bold uppercase tracking-wide">Presupuesto</h2>
          <p className="mt-0.5 text-base font-semibold tabular-nums" data-testid="numero-presupuesto">
            {formatearNumero(doc.numero)}
          </p>
          <p className="mt-1 text-xs text-slate-700">
            Fecha: <span className="tabular-nums">{formatFecha(doc.fecha)}</span>
          </p>
          <p className="text-xs text-slate-700">
            Válido hasta: <span className="tabular-nums">{formatFecha(vence)}</span>
          </p>
        </div>
      </header>

      {/* Cliente */}
      <section aria-label="Cliente" className="sin-corte grid grid-cols-2 gap-6 border-b border-slate-300 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Cliente</p>
          {empresa || contacto ? (
            <>
              <p className="break-words font-semibold">{empresa?.nombre ?? contactoNombre}</p>
              {empresa?.cuit && <p className="text-xs text-slate-700">CUIT {empresa.cuit}</p>}
              {empresa?.direccion && <p className="break-words text-xs text-slate-700">{empresa.direccion}</p>}
              {empresa && (empresa.telefono || empresa.email) && (
                <p className="break-words text-xs text-slate-700">{[empresa.telefono, empresa.email].filter(Boolean).join(" · ")}</p>
              )}
            </>
          ) : (
            <p className="text-slate-700">A definir</p>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Atención</p>
          {contacto && empresa ? (
            <>
              <p className="break-words font-semibold">{contactoNombre}</p>
              {contacto.cargo && <p className="text-xs text-slate-700">{contacto.cargo}</p>}
              {(contacto.email || contacto.telefono) && (
                <p className="break-words text-xs text-slate-700">{[contacto.email, contacto.telefono].filter(Boolean).join(" · ")}</p>
              )}
            </>
          ) : contacto ? (
            <>
              {contacto.cargo && <p className="text-xs text-slate-700">{contacto.cargo}</p>}
              {(contacto.email || contacto.telefono) && (
                <p className="break-words text-xs text-slate-700">{[contacto.email, contacto.telefono].filter(Boolean).join(" · ")}</p>
              )}
            </>
          ) : (
            <p className="text-slate-700">—</p>
          )}
          <p className="mt-2 text-xs text-slate-700">
            <span className="font-semibold">Referencia:</span> {referencia}
          </p>
        </div>
      </section>

      {/* Lineas */}
      <table className="mt-4 w-full border-collapse text-xs">
        <caption className="sr-only">Líneas del presupuesto</caption>
        <thead>
          <tr className="border-b-2 border-slate-900 text-left">
            <th scope="col" className="py-1.5 pr-2 font-bold">
              Descripción
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-bold">
              Cant.
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-bold">
              Precio unit.
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-bold">
              Dto.
            </th>
            <th scope="col" className="py-1.5 pl-2 text-right font-bold">
              Importe
            </th>
          </tr>
        </thead>
        <tbody>
          {doc.lineas.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-slate-700">
                Sin líneas todavía.
              </td>
            </tr>
          )}
          {doc.lineas.map((l, i) => (
            <tr key={i} className="border-b border-slate-300 align-top">
              <td className="break-words py-2 pr-2">{l.descripcion || "—"}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCantidad(l.cantidad)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatPesos(l.precio_unitario)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{l.descuento_pct ? `${formatCantidad(l.descuento_pct)} %` : "—"}</td>
              <td className="py-2 pl-2 text-right font-semibold tabular-nums">{formatPesos(importeLinea(l).netoC / 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totales */}
      <section aria-label="Totales" className="sin-corte mt-4 flex justify-end">
        <dl className="w-full max-w-xs text-sm">
          {(totales.discrimina || totales.descuento > 0) && (
            <div className="flex justify-between gap-4 py-0.5">
              <dt>Subtotal</dt>
              <dd className="tabular-nums" data-testid="subtotal">
                {formatPesos(totales.subtotal)}
              </dd>
            </div>
          )}
          {totales.descuento > 0 && (
            <div className="flex justify-between gap-4 py-0.5">
              <dt>Descuentos</dt>
              <dd className="tabular-nums">−{formatPesos(totales.descuento)}</dd>
            </div>
          )}
          {totales.discrimina && (
            <>
              <div className="flex justify-between gap-4 py-0.5">
                <dt>Neto gravado</dt>
                <dd className="tabular-nums" data-testid="neto">
                  {formatPesos(totales.neto)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-0.5">
                <dt>IVA 21 %</dt>
                <dd className="tabular-nums" data-testid="iva">
                  {formatPesos(totales.iva)}
                </dd>
              </div>
            </>
          )}
          <div className="mt-1 flex justify-between gap-4 border-t-2 border-slate-900 pt-1.5 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums" data-testid="total">
              {formatPesos(totales.total)}
            </dd>
          </div>
        </dl>
      </section>
      <p className="mt-2 text-right text-[11px] text-slate-700">{leyendaIva(doc.condicionIva)}</p>

      {/* Pie: validez, condiciones y observaciones */}
      <section aria-label="Condiciones" className="sin-corte mt-6 space-y-3 border-t border-slate-300 pt-4 text-xs">
        <p>
          <span className="font-semibold">Validez:</span> {doc.validezDias} {doc.validezDias === 1 ? "día" : "días"} desde la fecha de emisión, hasta el{" "}
          <span className="tabular-nums">{formatFecha(vence)}</span>.
        </p>
        {doc.condiciones.trim() && (
          <div>
            <p className="font-semibold">Condiciones</p>
            <p className="whitespace-pre-line break-words text-slate-800">{doc.condiciones.trim()}</p>
          </div>
        )}
        {doc.notas.trim() && (
          <div>
            <p className="font-semibold">Observaciones</p>
            <p className="whitespace-pre-line break-words text-slate-800">{doc.notas.trim()}</p>
          </div>
        )}
      </section>
    </article>
  );
}
