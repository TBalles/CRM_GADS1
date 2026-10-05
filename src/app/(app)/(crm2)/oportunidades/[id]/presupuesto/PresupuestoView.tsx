"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, FileText, Plus, Printer, Save, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/crm/Button";
import { CellDate, CellNumber, DataTable, TBody, THead, TableMessage, Td, Th, Tr } from "@/components/crm/DataTable";
import { EmptyState, InlineBanner } from "@/components/crm/Feedback";
import { Field, FieldError, Input, Label, Textarea } from "@/components/crm/Field";
import { MoneyInput } from "@/components/crm/MoneyInput";
import { DetailHeader, SectionBar } from "@/components/crm/PageBar";
import { Select } from "@/components/crm/Select";
import { Tooltip } from "@/components/crm/Tooltip";
import { FOCUS, TYPE, UI_ROOT, cn } from "@/components/crm/cx";
import { formatFecha } from "@/lib/clientes";
import { maskMoney } from "@/lib/money";
import { formatearNumero, formatPesos, importeLinea, type TotalesPresupuesto } from "@/lib/presupuesto";
import { Hoja } from "./Hoja";
import { aLinea, botonTrasMover, focoTrasQuitar, type LineaEdit } from "./logica";
import { usePresupuesto, type PresupuestoProps } from "./usePresupuesto";

/**
 * Editor de presupuesto (Lote D, CRM 2.0; MASTER.md §10.20). Mismos datos, validaciones, numeración, cuentas, guardado,
 * impresión, avisos y nombres que el editor legacy (el estado vive en `usePresupuesto`). Cambia la experiencia:
 *
 * - Desde 1280: vista dividida. A la izquierda el editor (grilla densa de líneas, totales, validez y condiciones) y la
 *   lista de guardados, con scroll propio; a la derecha la hoja, escalada para entrar entera en su columna.
 * - Debajo de 1280: una columna — editor, hoja y guardados (el orden de siempre).
 * - LA HOJA ES PAPEL: `Hoja` es la del legacy sin tocar y queda FUERA de `UI_ROOT` (hereda la fuente global como antes).
 *   La escala de pantalla es un `transform` en un envoltorio; en `@media print` todo envoltorio vuelve a bloque, sin
 *   escala, sin padding ni scroll, así el papel sale igual que antes (`.no-print`, `.hoja-presupuesto`, `[data-app-*]`).
 */
export default function PresupuestoView(props: PresupuestoProps) {
  const { oportunidad, organizacion, productos, empresa, contacto, puedeGuardar, puedeConfigurar } = props;
  const p = usePresupuesto(props);
  const { abierto, lineas } = p;

  // Foco después de agregar, quitar o mover una línea (o de guardar): el id del elemento a enfocar en el próximo pintado.
  const foco = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!foco.current) return;
    const el = document.getElementById(foco.current);
    foco.current = null;
    el?.focus();
  });

  const opcionesCatalogo = productos.map((x) => ({ value: x.id, label: x.nombre }));
  const opcionesLinea = [{ value: "", label: "Texto libre" }, ...opcionesCatalogo];

  function agregarLibre() {
    foco.current = `linea-${p.agregarLibre()}-producto`;
  }
  function agregarProducto(id: string) {
    const key = p.agregarProducto(id);
    if (key) foco.current = `linea-${key}-producto`;
  }
  function quitar(key: string) {
    const siguiente = focoTrasQuitar(
      lineas.map((l) => l.key),
      key,
    );
    foco.current = siguiente ? `linea-${siguiente}-producto` : "agregar-linea";
    p.quitar(key);
  }
  function mover(indice: number, delta: -1 | 1) {
    const l = lineas[indice];
    foco.current = `linea-${l.key}-${botonTrasMover(indice + delta, lineas.length, delta)}`;
    p.mover(indice, delta);
  }
  async function guardar() {
    if (await p.guardar()) foco.current = "imprimir-presupuesto";
  }
  // El botón que se apretó desaparece al pasar del guardado al borrador: el foco va a "Agregar del catálogo".
  function alBorrador(cambio: () => void) {
    foco.current = "agregar-producto";
    cambio();
  }

  const header = (
    <DetailHeader
      title={oportunidad.titulo}
      meta={
        <>
          <Link
            href={`/oportunidades/${oportunidad.id}`}
            className={cn(FOCUS, "inline-flex items-center gap-1.5 rounded-(--crm-radius-sm) font-medium text-(--crm-accent-text) hover:underline")}
          >
            <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
            Volver a la oportunidad
          </Link>
          <span>
            {abierto
              ? `Estás viendo el presupuesto ${formatearNumero(abierto.numero)}, emitido el ${formatFecha(abierto.fecha)}. Un presupuesto emitido no se modifica.`
              : "Armá las líneas, revisá la hoja y guardala para numerarla. Después imprimila o guardala como PDF."}
          </span>
        </>
      }
      actions={
        <>
          {abierto && (
            <>
              <Button variant="ghost" icon={FileText} onClick={() => alBorrador(() => p.setAbierto(null))}>
                Volver al borrador
              </Button>
              <Button icon={Copy} onClick={() => alBorrador(() => p.usarComoBase(abierto))}>
                Usar como base de uno nuevo
              </Button>
            </>
          )}
          <Button
            id="imprimir-presupuesto"
            variant={abierto || !puedeGuardar ? "primary" : "secondary"}
            icon={Printer}
            loading={p.imprimiendoUi}
            onClick={p.imprimir}
          >
            Imprimir / Guardar PDF
          </Button>
          {!abierto && puedeGuardar && (
            <Button variant="primary" icon={Save} loading={p.saving} onClick={guardar}>
              {p.saving ? "Guardando…" : "Guardar presupuesto"}
            </Button>
          )}
        </>
      }
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-(--crm-canvas) print:block print:h-auto print:bg-transparent">
      <div className={cn(UI_ROOT, "no-print")}>{header}</div>

      {/* Debajo de 1280 todo scrollea junto y la columna izquierda es `contents` (editor, hoja y guardados, por `order`);
          desde 1280, dos columnas con scroll propio. */}
      {/* Fondo opaco en los contenedores con scroll y la columna de la hoja como contexto de apilamiento propio (`isolate`):
          sin eso Chrome dibujaba la hoja sin escala (1024) con otro suavizado de texto que el legacy (gris en vez de LCD),
          por las textareas del editor que se pintan antes. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-(--crm-canvas) xl:grid xl:grid-cols-2 xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden print:block print:overflow-visible print:bg-transparent">
        <div className={cn(UI_ROOT, "no-print contents xl:flex xl:min-h-0 xl:flex-col xl:overflow-y-auto")}>
          <div className="order-1 flex min-w-0 flex-col gap-4 px-4 pt-4 xl:px-6">
            <Avisos
              sinDatosDeEmpresa={p.sinDatosDeEmpresa && puedeConfigurar}
              sinMigracion={!p.activo && puedeConfigurar}
              error={p.error}
            />
            {!abierto && (
              <Editor
                lineas={lineas}
                opcionesLinea={opcionesLinea}
                opcionesCatalogo={opcionesCatalogo}
                discriminaIva={organizacion.condicion_iva === "responsable_inscripto"}
                totales={p.totales}
                errorDe={p.errorDe}
                onActualizar={p.actualizar}
                onElegirProducto={p.elegirProducto}
                onMover={mover}
                onQuitar={quitar}
                onAgregarLibre={agregarLibre}
                onAgregarProducto={agregarProducto}
              />
            )}
            {!abierto && (
              <section aria-label="Validez y condiciones" className="@container flex flex-col gap-3">
                <div className="grid gap-4 @[30rem]:grid-cols-[11rem_minmax(0,1fr)]">
                  <Field id="validez" label="Validez (días)" required error={p.errorValidez}>
                    {(c) => <Input {...c} inputMode="numeric" className="tabular-nums" value={p.validez} onChange={(e) => p.setValidez(e.target.value)} />}
                  </Field>
                  <Field id="condiciones" label="Condiciones">
                    {(c) => (
                      <Textarea
                        {...c}
                        rows={3}
                        maxLength={2000}
                        placeholder="Forma de pago, plazo de entrega, garantía…"
                        value={p.condiciones}
                        onChange={(e) => p.setCondiciones(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field id="notas" label="Observaciones" className="@[30rem]:col-span-2">
                    {(c) => <Textarea {...c} rows={2} maxLength={2000} value={p.notas} onChange={(e) => p.setNotas(e.target.value)} />}
                  </Field>
                </div>
                <p className={cn(TYPE.meta, "max-w-prose text-(--crm-text-2)")}>
                  La validez y las condiciones arrancan con lo que cargaste en Configuración; acá las cambiás solo para este presupuesto.
                  {" Sin guardar, se imprime como «Borrador»: sin número y sin dejar rastro en el historial."}
                </p>
              </section>
            )}
          </div>

          {p.activo && (
            <div className="order-3 min-w-0 px-4 pb-6 pt-2 xl:px-6">
              <Guardados previos={p.previos} abiertoId={abierto?.id ?? null} onVer={p.setAbierto} />
            </div>
          )}
        </div>

        {/* ── La hoja: es lo único que se imprime ── */}
        <div
          data-hoja-columna
          className="isolate order-2 min-w-0 bg-(--crm-canvas) px-4 py-4 xl:overflow-y-auto xl:border-l xl:border-(--crm-border) xl:px-6 print:overflow-visible print:border-0 print:bg-transparent print:p-0"
        >
          <HojaEscalada>
            <Hoja
              nombreOrganizacion={organizacion.nombre}
              logoUrl={p.logoUrl}
              empresa={empresa}
              contacto={contacto}
              referencia={oportunidad.titulo}
              doc={p.documento}
              totales={p.totales}
            />
          </HojaEscalada>
        </div>
      </div>
    </div>
  );
}

/** Avisos de la pantalla (no se imprimen): encabezado vacío, migración 0012 sin aplicar y el error del guardado. */
function Avisos({ sinDatosDeEmpresa, sinMigracion, error }: { sinDatosDeEmpresa: boolean; sinMigracion: boolean; error: string | null }) {
  if (!sinDatosDeEmpresa && !sinMigracion && !error) return null;
  return (
    <div className="flex flex-col gap-2">
      {sinDatosDeEmpresa && (
        <InlineBanner tone="info" title="Tu encabezado está vacío.">
          Cargá la razón social, el CUIT, los datos de contacto y el logo en{" "}
          <Link href="/configuracion" className={cn(FOCUS, "rounded-(--crm-radius-sm) font-medium text-(--crm-accent-text) underline underline-offset-4")}>
            Configuración
          </Link>{" "}
          para que salgan en cada presupuesto.
        </InlineBanner>
      )}
      {sinMigracion && (
        <InlineBanner tone="info" title="Se activa al aplicar la migración 0012.">
          Hasta entonces el guardado de presupuestos, con su número y su lista no aparece. Los pasos están en la guía de despliegue.
        </InlineBanner>
      )}
      {error && <InlineBanner tone="danger">{error}</InlineBanner>}
    </div>
  );
}

/** "$" en gris al lado de la cifra (MASTER §4); el texto sigue siendo "$1.234,56" (E2E lee `importe-N`). */
function Pesos({ n }: { n: number }) {
  const texto = formatPesos(n);
  if (!texto.startsWith("$")) return <>{texto}</>;
  return (
    <>
      <span className={TYPE.unit}>$</span>
      {texto.slice(1)}
    </>
  );
}

/*
 * Grilla de líneas (ARIA table). Un mismo template por ancho del CONTENEDOR para la cabecera y las filas:
 * - ≥ 54rem: una fila — Producto · Descripción · Cantidad · Precio unitario · Dto. % · Importe · acciones.
 * - 30–54rem (la columna del editor a 1280/1440, 768): dos renglones — Producto · Descripción · acciones / Cantidad ·
 *   Precio · Dto. · Importe — bajo una cabecera de dos renglones con la misma ubicación.
 * - < 30rem (celular): un formulario corto por línea, con los labels a la vista; la cabecera queda para lectores.
 */
const FILA =
  "grid grid-cols-2 gap-x-2 gap-y-2 @[30rem]:grid-cols-[4.5rem_8rem_4.5rem_minmax(0,1fr)_5.5rem] @[30rem]:gap-y-1.5 @[54rem]:grid-cols-[11rem_minmax(0,1fr)_4.5rem_8rem_4.5rem_7.5rem_5.5rem]";
const CELDA = {
  producto: "col-span-2 @[30rem]:col-start-1 @[30rem]:row-start-1 @[54rem]:col-span-1",
  descripcion: "col-span-2 @[30rem]:col-start-3 @[30rem]:row-start-1 @[54rem]:col-start-2 @[54rem]:col-span-1",
  cantidad: "@[30rem]:col-start-1 @[30rem]:row-start-2 @[54rem]:col-start-3 @[54rem]:row-start-1",
  precio: "@[30rem]:col-start-2 @[30rem]:row-start-2 @[54rem]:col-start-4 @[54rem]:row-start-1",
  descuento: "@[30rem]:col-start-3 @[30rem]:row-start-2 @[54rem]:col-start-5 @[54rem]:row-start-1",
  // En dos renglones el importe ocupa también la columna de las acciones (libre en el segundo renglón): entra la cifra entera.
  importe: "@[30rem]:col-span-2 @[30rem]:col-start-4 @[30rem]:row-start-2 @[54rem]:col-span-1 @[54rem]:col-start-6 @[54rem]:row-start-1",
  acciones: "col-span-2 @[30rem]:col-span-1 @[30rem]:col-start-5 @[30rem]:row-start-1 @[54rem]:col-start-7",
} as const;
/** Los labels de cada campo: a la vista en el celular; con la cabecera de la grilla, solo para lectores de pantalla. */
const OCULTO = "@[30rem]:sr-only";
/** En la grilla los controles son los compactos de 28 (MASTER §5: filas); en el celular, los de 32 con texto de 16. */
const DENSO = "@[30rem]:h-7";

function Editor({
  lineas,
  opcionesLinea,
  opcionesCatalogo,
  discriminaIva,
  totales,
  errorDe,
  onActualizar,
  onElegirProducto,
  onMover,
  onQuitar,
  onAgregarLibre,
  onAgregarProducto,
}: {
  lineas: LineaEdit[];
  opcionesLinea: { value: string; label: string }[];
  opcionesCatalogo: { value: string; label: string }[];
  discriminaIva: boolean;
  totales: TotalesPresupuesto;
  errorDe: (i: number, campo: string) => string | undefined;
  onActualizar: (key: string, cambio: Partial<LineaEdit>) => void;
  onElegirProducto: (key: string, id: string) => void;
  onMover: (indice: number, delta: -1 | 1) => void;
  onQuitar: (key: string) => void;
  onAgregarLibre: () => void;
  onAgregarProducto: (id: string) => void;
}) {
  const asterisco = (
    <span aria-hidden="true" className="ml-0.5 text-(--crm-danger)">
      *
    </span>
  );
  return (
    <section aria-labelledby="lineas-titulo" className="@container flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="lineas-titulo" className="text-[14px] font-semibold leading-5">
          Líneas
        </h2>
        <p className={cn(TYPE.meta, "text-(--crm-text-2)")}>
          {discriminaIva ? "Cargá los precios sin IVA: el IVA 21 % se suma abajo." : "Los precios se imprimen tal cual los cargues."}
        </p>
      </div>

      <div className="rounded-(--crm-radius) border border-(--crm-border) bg-(--crm-panel)">
        <div role="table" aria-labelledby="lineas-titulo" className={TYPE.table}>
          <div role="rowgroup" className="sr-only @[30rem]:not-sr-only">
            <div role="row" className={cn(FILA, TYPE.th, "border-b border-(--crm-border-strong) px-3 py-2 @[54rem]:py-0 @[54rem]:h-8 @[54rem]:items-center")}>
              <span role="columnheader" className={CELDA.producto}>
                Producto
              </span>
              <span role="columnheader" className={CELDA.descripcion}>
                Descripción{asterisco}
              </span>
              <span role="columnheader" className={CELDA.cantidad}>
                Cantidad{asterisco}
              </span>
              <span role="columnheader" className={CELDA.precio}>
                Precio unitario
              </span>
              <span role="columnheader" className={CELDA.descuento}>
                Dto. %
              </span>
              <span role="columnheader" className={cn(CELDA.importe, "text-right")}>
                Importe
              </span>
              <span role="columnheader" className={CELDA.acciones}>
                <span className="sr-only">Acciones</span>
              </span>
            </div>
          </div>
          <div role="rowgroup">
            {lineas.length === 0 ? (
              <div role="row">
                <div role="cell" aria-colspan={7} className={cn(TYPE.ui, "px-3 py-6 text-(--crm-text-2)")}>
                  Todavía no hay líneas. Agregá un producto del catálogo o una línea libre.
                </div>
              </div>
            ) : (
              lineas.map((l, i) => (
                <FilaLinea
                  key={l.key}
                  linea={l}
                  indice={i}
                  total={lineas.length}
                  opciones={opcionesLinea}
                  errorDe={errorDe}
                  onActualizar={onActualizar}
                  onElegirProducto={onElegirProducto}
                  onMover={onMover}
                  onQuitar={onQuitar}
                />
              ))
            )}
          </div>
        </div>

        {/* Pie de la grilla: agregar (a la izquierda) y los totales del borrador, con las mismas cuentas que la hoja. */}
        <div className="flex flex-col gap-4 border-t border-(--crm-border) px-3 py-3 @[36rem]:flex-row @[36rem]:items-start @[36rem]:justify-between">
          <div className="flex flex-wrap items-end gap-2">
            <Field id="agregar-producto" label="Agregar del catálogo" className="w-64 max-w-full">
              {(c, labelId) => (
                <Select
                  id={c.id}
                  aria-labelledby={labelId}
                  searchable
                  placeholder="Elegí un producto…"
                  value=""
                  onChange={onAgregarProducto}
                  options={opcionesCatalogo}
                />
              )}
            </Field>
            <Button id="agregar-linea" icon={Plus} onClick={onAgregarLibre}>
              Agregar línea libre
            </Button>
          </div>
          <Totales totales={totales} />
        </div>
      </div>
    </section>
  );
}

/** Totales del borrador: las mismas filas y condiciones que la hoja (Subtotal y Descuentos si corresponden, IVA si discrimina). */
function Totales({ totales }: { totales: TotalesPresupuesto }) {
  const fila = "flex items-baseline justify-between gap-4";
  const cifra = cn(TYPE.mono, "whitespace-nowrap");
  return (
    <dl className={cn(TYPE.table, "flex w-full flex-col gap-1 @[36rem]:max-w-72")}>
      {(totales.discrimina || totales.descuento > 0) && (
        <div className={fila}>
          <dt className="text-(--crm-text-2)">Subtotal</dt>
          <dd className={cifra}>
            <Pesos n={totales.subtotal} />
          </dd>
        </div>
      )}
      {totales.descuento > 0 && (
        <div className={fila}>
          <dt className="text-(--crm-text-2)">Descuentos</dt>
          <dd className={cifra}>
            −<Pesos n={totales.descuento} />
          </dd>
        </div>
      )}
      {totales.discrimina && (
        <>
          <div className={fila}>
            <dt className="text-(--crm-text-2)">Neto gravado</dt>
            <dd className={cifra}>
              <Pesos n={totales.neto} />
            </dd>
          </div>
          <div className={fila}>
            <dt className="text-(--crm-text-2)">IVA 21 %</dt>
            <dd className={cifra}>
              <Pesos n={totales.iva} />
            </dd>
          </div>
        </>
      )}
      <div className={cn(fila, "mt-1 border-t border-(--crm-border-strong) pt-1.5 text-[14px] font-semibold")}>
        <dt>Total</dt>
        <dd className={cifra}>
          <Pesos n={totales.total} />
        </dd>
      </div>
    </dl>
  );
}

function FilaLinea({
  linea: l,
  indice: i,
  total,
  opciones,
  errorDe,
  onActualizar,
  onElegirProducto,
  onMover,
  onQuitar,
}: {
  linea: LineaEdit;
  indice: number;
  total: number;
  opciones: { value: string; label: string }[];
  errorDe: (i: number, campo: string) => string | undefined;
  onActualizar: (key: string, cambio: Partial<LineaEdit>) => void;
  onElegirProducto: (key: string, id: string) => void;
  onMover: (indice: number, delta: -1 | 1) => void;
  onQuitar: (key: string) => void;
}) {
  const id = (campo: string) => `linea-${l.key}-${campo}`;
  const n = i + 1;
  // Contexto para lectores de pantalla: cada campo de una linea dice de cual es (como siempre).
  const deLaLinea = <span className="sr-only"> de la línea {n}</span>;
  const err = {
    descripcion: errorDe(i, "descripcion"),
    cantidad: errorDe(i, "cantidad"),
    precio: errorDe(i, "precio_unitario"),
    descuento: errorDe(i, "descuento_pct"),
  };
  const hayErrores = Object.values(err).some(Boolean);
  const control = (campo: keyof typeof err) => ({
    id: id(campo),
    "aria-invalid": err[campo] ? true : undefined,
    "aria-describedby": err[campo] ? `${id(campo)}-error` : undefined,
  });
  const importe = importeLinea(aLinea(l)).netoC / 100;

  return (
    <div role="row" className={cn(FILA, "border-b border-(--crm-border) px-3 py-2 last:border-b-0 @[30rem]:items-start @[30rem]:py-1.5")}>
      <div role="cell" className={cn("flex min-w-0 flex-col gap-1", CELDA.producto)}>
        <Label id={`${id("producto")}-label`} htmlFor={id("producto")} className={OCULTO}>
          Producto{deLaLinea}
        </Label>
        <Select
          id={id("producto")}
          aria-labelledby={`${id("producto")}-label`}
          searchable
          className={DENSO}
          placeholder="Texto libre"
          value={l.producto_id ?? ""}
          onChange={(v) => onElegirProducto(l.key, v)}
          options={opciones}
        />
      </div>
      <div role="cell" className={cn("flex min-w-0 flex-col gap-1", CELDA.descripcion)}>
        <Label htmlFor={id("descripcion")} required className={OCULTO}>
          Descripción{deLaLinea}
        </Label>
        <Input
          {...control("descripcion")}
          required
          className={DENSO}
          placeholder="Arco de fútbol 5/7, reforzado"
          value={l.descripcion}
          onChange={(e) => onActualizar(l.key, { descripcion: e.target.value })}
        />
      </div>
      <div role="cell" className={cn("flex min-w-0 flex-col gap-1", CELDA.cantidad)}>
        <Label htmlFor={id("cantidad")} required className={OCULTO}>
          Cantidad{deLaLinea}
        </Label>
        <Input
          {...control("cantidad")}
          required
          inputMode="decimal"
          className={cn("tabular-nums", DENSO)}
          value={l.cantidad}
          onChange={(e) => onActualizar(l.key, { cantidad: maskMoney(e.target.value) })}
        />
      </div>
      <div role="cell" className={cn("flex min-w-0 flex-col gap-1", CELDA.precio)}>
        <Label htmlFor={id("precio")} className={OCULTO}>
          Precio unitario{deLaLinea}
        </Label>
        <MoneyInput {...control("precio")} className={DENSO} value={l.precio} onChange={(v) => onActualizar(l.key, { precio: v })} />
      </div>
      <div role="cell" className={cn("flex min-w-0 flex-col gap-1", CELDA.descuento)}>
        <Label htmlFor={id("descuento")} className={OCULTO}>
          Dto. %{deLaLinea}
        </Label>
        <Input
          {...control("descuento")}
          inputMode="decimal"
          placeholder="0"
          className={cn("tabular-nums", DENSO)}
          value={l.descuento}
          onChange={(e) => onActualizar(l.key, { descuento: maskMoney(e.target.value) })}
        />
      </div>
      {/* La cifra va a la derecha desde 30rem; el label (oculto ahí) queda a la izquierda: alineado al final, su `sr-only`
          anidado se salía del ancho de la página. */}
      <div role="cell" className={cn("flex min-w-0 flex-col gap-1", CELDA.importe)}>
        <span className={cn("text-[13px] font-medium leading-[18px]", OCULTO)}>Importe{deLaLinea}</span>
        <span
          data-testid={`importe-${i}`}
          className={cn(TYPE.mono, "flex h-8 items-center whitespace-nowrap text-[14px] font-medium @[30rem]:h-7 @[30rem]:justify-end")}
        >
          <Pesos n={importe} />
        </span>
      </div>
      {/* Los errores de la línea, juntos a todo el ancho de la fila (debajo de sus dos renglones): en una columna de 72 px
          "La cantidad tiene que ser mayor que 0." quedaba en cinco renglones. Cada uno conserva su id (`aria-describedby`
          del campo, que además queda en rojo). */}
      {hayErrores && (
        <div className="col-span-full flex flex-col gap-0.5">
          {(Object.keys(err) as (keyof typeof err)[]).map((c) => (
            <FieldError key={c} id={id(c)} error={err[c]} />
          ))}
        </div>
      )}
      <div role="cell" className={cn("flex items-center justify-end gap-0.5 @[30rem]:h-7", CELDA.acciones)}>
        <Tooltip content="Subir">
          <IconButton id={id("subir")} label={`Subir la línea ${n}`} icon={ArrowUp} size="sm" disabled={i === 0} onClick={() => onMover(i, -1)} />
        </Tooltip>
        <Tooltip content="Bajar">
          <IconButton id={id("bajar")} label={`Bajar la línea ${n}`} icon={ArrowDown} size="sm" disabled={i === total - 1} onClick={() => onMover(i, 1)} />
        </Tooltip>
        <Tooltip content="Quitar">
          <IconButton
            id={id("quitar")}
            label={`Quitar la línea ${n}`}
            icon={Trash2}
            size="sm"
            className="hover:text-(--crm-danger)"
            onClick={() => onQuitar(l.key)}
          />
        </Tooltip>
      </div>
    </div>
  );
}

/** "Presupuestos de esta oportunidad": los guardados, el más nuevo arriba; el que está en la hoja, marcado. */
function Guardados({
  previos,
  abiertoId,
  onVer,
}: {
  previos: ReturnType<typeof usePresupuesto>["previos"];
  abiertoId: string | null;
  onVer: (p: ReturnType<typeof usePresupuesto>["previos"][number]) => void;
}) {
  return (
    <div className="flex flex-col">
      <SectionBar title="Presupuestos de esta oportunidad" count={previos.length} />
      <DataTable label="Presupuestos de esta oportunidad">
        <THead>
          <Th width={144}>Número</Th>
          <Th width={112} hideBelow="sm">
            Fecha
          </Th>
          <Th align="right" hideBelow="sm">
            Total
          </Th>
          <Th width={120} hideBelow="lg">
            Historial
          </Th>
          <Th width={148}>
            <span className="sr-only">Acciones</span>
          </Th>
        </THead>
        <TBody>
          {previos.length === 0 ? (
            <TableMessage colSpan={5}>
              <EmptyState compact title="Todavía no guardaste ninguno." description="Al guardar, el presupuesto recibe su número." />
            </TableMessage>
          ) : (
            previos.map((x) => {
              const enPantalla = abiertoId === x.id;
              const historial = x.actividad_id ? "Registrado" : "Sin registrar";
              return (
                <Tr key={x.id} selected={enPantalla}>
                  <Td className="py-1.5">
                    <span className="flex flex-col">
                      <span className={cn(TYPE.mono, "font-medium")}>{formatearNumero(x.numero)}</span>
                      {/* Debajo del número: "(en pantalla)" y lo que no entra como columna (sin perder datos). */}
                      <span className={cn(TYPE.meta, "flex flex-wrap gap-x-2 text-(--crm-text-2)")}>
                        {enPantalla && <span>(en pantalla)</span>}
                        <span className="@[30rem]:hidden">{formatFecha(x.fecha)}</span>
                        <span className={cn(TYPE.mono, "@[30rem]:hidden")}>{formatPesos(Number(x.total))}</span>
                        <span className="@[60rem]:hidden">{historial}</span>
                      </span>
                    </span>
                  </Td>
                  <Td hideBelow="sm">
                    <CellDate dateTime={x.fecha}>{formatFecha(x.fecha)}</CellDate>
                  </Td>
                  <Td align="right" hideBelow="sm">
                    <CellNumber unit="$" unitPosition="before">
                      {formatPesos(Number(x.total)).replace(/^\$/, "")}
                    </CellNumber>
                  </Td>
                  <Td hideBelow="lg">{historial}</Td>
                  <Td align="right">
                    <Button size="sm" className="relative" onClick={() => onVer(x)}>
                      Ver / reimprimir<span className="sr-only"> el presupuesto {formatearNumero(x.numero)}</span>
                    </Button>
                  </Td>
                </Tr>
              );
            })
          )}
        </TBody>
      </DataTable>
    </div>
  );
}

/**
 * La hoja a escala de su columna, en pantalla: se dibuja a su ancho natural (56rem, el máximo de la hoja de siempre) y un
 * `transform` la achica para que entre entera (nunca la agranda). El marco toma el alto ya escalado (el `transform` no
 * cambia el layout). Se mide en el navegador: hasta medir, la hoja no se ve (sin salto). En papel nada de esto existe:
 * `print:` devuelve ancho, alto, escala y overflow a los de siempre.
 */
function HojaEscalada({ children }: { children: React.ReactNode }) {
  const marco = React.useRef<HTMLDivElement>(null);
  const hoja = React.useRef<HTMLDivElement>(null);
  const [medida, setMedida] = React.useState<{ escala: number; ancho: number; alto: number } | null>(null);

  React.useLayoutEffect(() => {
    const m = marco.current;
    const h = hoja.current;
    if (!m || !h) return;
    const medir = () => {
      const escala = Math.min(1, m.clientWidth / h.offsetWidth);
      const nueva = { escala, ancho: h.offsetWidth * escala, alto: h.offsetHeight * escala };
      setMedida((v) => (v && v.escala === nueva.escala && v.alto === nueva.alto ? v : nueva));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(m);
    ro.observe(h);
    return () => ro.disconnect();
  }, []);

  const vars = medida
    ? ({ "--hoja-escala": medida.escala, "--hoja-ancho": `${medida.ancho}px`, "--hoja-alto": `${medida.alto}px` } as React.CSSProperties)
    : undefined;

  return (
    <div ref={marco} className="w-full">
      <div
        data-hoja-marco
        style={vars}
        className="mx-auto h-(--hoja-alto) w-(--hoja-ancho) max-w-full overflow-hidden print:h-auto print:w-auto print:max-w-none print:overflow-visible"
      >
        <div
          ref={hoja}
          data-hoja-escala
          className={cn(
            "hoja-scroll w-[56rem] origin-top-left [transform:scale(var(--hoja-escala,1))] print:w-auto print:[transform:none]",
            !medida && "invisible",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
