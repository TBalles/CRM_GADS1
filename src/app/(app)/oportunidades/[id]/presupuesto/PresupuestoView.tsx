"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, FileText, History, Plus, Printer, Save, Settings, Trash2 } from "lucide-react";
import { AvisoMigracion } from "@/components/AvisoMigracion";
import { Dato, Seccion } from "@/components/cliente";
import { Campo, CampoMoney, CampoSelect, CampoTextarea, FormBanner } from "@/components/form";
import { Button, Card } from "@/components/ui/UIComponents";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { formatFecha, nombreCompleto } from "@/lib/clientes";
import { esErrorDeEsquema } from "@/lib/esquema";
import { maskFromNumber, maskMoney, parseMoney } from "@/lib/money";
import {
  calcularTotales,
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
  problemaDelDocumento,
  tituloActividad,
  validarLineas,
  validezValida,
  type Emisor,
  type LineaPresupuesto,
} from "@/lib/presupuesto";
import type { Json, Tables } from "@/lib/supabase/types";

type Presupuesto = Tables<"presupuestos">;

type Org = {
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  condicion_iva: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  sitio_web: string | null;
  presupuesto_validez_dias: number;
  presupuesto_condiciones: string | null;
};
type Empresa = { id: string; nombre: string; cuit: string | null; direccion: string | null; telefono: string | null; email: string | null };
type Contacto = { id: string; nombre: string; apellido: string | null; cargo: string | null; email: string | null; telefono: string | null };
type Producto = { id: string; nombre: string; precio: number | null };

/** Una linea mientras se edita: los numeros son el texto del campo (con la mascara es-AR). */
type LineaEdit = { key: string; producto_id: string | null; descripcion: string; cantidad: string; precio: string; descuento: string };

/**
 * Lo que dibuja la hoja: el borrador en edicion o un presupuesto guardado. El emisor y la condicion frente al IVA
 * de un presupuesto GUARDADO salen de su foto (columnas `emisor` y `condicion_iva`), no de la organizacion de hoy;
 * el logo y los datos del cliente y del contacto se leen siempre en vivo.
 */
type Documento = {
  numero: number | null;
  emisor: Emisor;
  condicionIva: string | null;
  fecha: string;
  validezDias: number;
  condiciones: string;
  notas: string;
  lineas: LineaPresupuesto[];
};

const aLinea = (l: LineaEdit): LineaPresupuesto => ({
  producto_id: l.producto_id,
  descripcion: l.descripcion,
  cantidad: parseMoney(l.cantidad),
  precio_unitario: parseMoney(l.precio),
  descuento_pct: parseMoney(l.descuento),
});

const deLinea = (l: LineaPresupuesto, key: string): LineaEdit => ({
  key,
  producto_id: l.producto_id,
  descripcion: l.descripcion,
  cantidad: formatCantidad(l.cantidad),
  precio: maskFromNumber(l.precio_unitario),
  descuento: l.descuento_pct ? formatCantidad(l.descuento_pct) : "",
});

/** El navegador sugiere el nombre del PDF a partir del titulo de la pagina: se cambia solo mientras se imprime. */
function imprimirConTitulo(titulo: string) {
  const anterior = document.title;
  document.title = titulo;
  window.addEventListener("afterprint", () => (document.title = anterior), { once: true });
  window.print();
}

/** La URL firmada del logo dura 1 h: se renueva a los 50 min, al volver a la pestaña y antes de imprimir. */
const RENOVAR_LOGO_MS = 50 * 60 * 1000;
const VIGENCIA_LOGO_S = 60 * 60;

/** Firma otra vez el logo (bucket privado). Devuelve la URL nueva, o null si no se pudo. */
async function firmarLogo(path: string): Promise<string | null> {
  const { data } = await createClient().storage.from("logos").createSignedUrl(path, VIGENCIA_LOGO_S);
  return data?.signedUrl ?? null;
}

/** Espera a que el navegador tenga la imagen (para no abrir el dialogo de impresion con el logo a medio cargar). */
function precargar(url: string): Promise<void> {
  return new Promise((resolver) => {
    const img = new Image();
    img.onload = () => resolver();
    img.onerror = () => resolver();
    img.src = url;
  });
}

export default function PresupuestoView({
  oportunidad,
  organizacion,
  logoUrl: logoUrlInicial,
  logoPath,
  empresa,
  contacto,
  productos,
  previos: previosIniciales,
  presupuestosActivos,
  tipoPropuestaId,
  hoy,
  puedeGuardar,
  puedeConfigurar,
}: {
  oportunidad: { id: string; titulo: string; empresa_id: string | null; contacto_id: string | null; producto_id: string | null; monto: number | null };
  organizacion: Org;
  /** URL firmada del logo (vence); null si la organizacion no tiene logo. */
  logoUrl: string | null;
  /** Ruta del logo en el bucket `logos`, para volver a firmarlo. */
  logoPath: string | null;
  empresa: Empresa | null;
  contacto: Contacto | null;
  productos: Producto[];
  previos: Presupuesto[];
  /** La tabla `presupuestos` (migracion 0012) existe en la base. */
  presupuestosActivos: boolean;
  /** El tipo de actividad "Envio de propuesta"; null = no existe o el rol no puede registrar actividades. */
  tipoPropuestaId: string | null;
  /** Hoy en Argentina, calculado en el servidor. */
  hoy: string;
  puedeGuardar: boolean;
  puedeConfigurar: boolean;
}) {
  const { showToast } = useToast();
  const productoPorId = new Map(productos.map((p) => [p.id, p]));

  // ── Logo: la URL firmada vence; una pestaña abierta mucho rato tiene que poder imprimirlo igual ──
  const [logoUrl, setLogoUrl] = useState(logoUrlInicial);
  useEffect(() => {
    if (!logoPath) return;
    const path = logoPath;
    let vivo = true;
    async function renovar() {
      const nueva = await firmarLogo(path);
      if (vivo && nueva) setLogoUrl(nueva);
    }
    const intervalo = window.setInterval(renovar, RENOVAR_LOGO_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") renovar();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", renovar);
    return () => {
      vivo = false;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", renovar);
    };
  }, [logoPath]);

  // ── Borrador ────────────────────────────────────────────────────────────
  const seq = useRef(0);
  // "l0" es la linea inicial; las que se agregan despues son "n1", "n2"... (nunca se repiten).
  const nuevaKey = () => `n${++seq.current}`;
  const [lineas, setLineas] = useState<LineaEdit[]>(() => {
    // Lo que la oportunidad ya sabe: su producto (con el precio de catalogo) o, si no, su valor estimado.
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
  });
  const [validez, setValidez] = useState(String(organizacion.presupuesto_validez_dias));
  const [condiciones, setCondiciones] = useState(organizacion.presupuesto_condiciones ?? "");
  const [notas, setNotas] = useState("");
  const [intento, setIntento] = useState(false);

  // ── Guardados ───────────────────────────────────────────────────────────
  const [activo, setActivo] = useState(presupuestosActivos);
  const [previos, setPrevios] = useState(previosIniciales);
  /** El presupuesto guardado que se esta viendo (recien guardado o reabierto). Null = el borrador. */
  const [abierto, setAbierto] = useState<Presupuesto | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Imprimir es asincrono (renueva el logo y registra la actividad): una ref impide que un doble clic o una
  // reentrada lo corra dos veces, y `imprimiendoUi` deshabilita el boton mientras tanto.
  const imprimiendo = useRef(false);
  const [imprimiendoUi, setImprimiendoUi] = useState(false);
  // Presupuestos cuya actividad ya se inserto en esta pestaña (aunque despues no se haya podido vincular).
  const actividadInsertada = useRef(new Set<string>());

  /** Contexto para lectores de pantalla: cada campo de una linea dice de cual es. */
  const deLaLinea = (n: number) => <span className="sr-only"> de la línea {n}</span>;

  const edicion = lineas.map(aLinea);
  const validezNum = Number(validez.trim());
  const erroresLinea = validarLineas(edicion);
  const errorDe = (i: number, campo: string) => (intento ? erroresLinea.find((e) => e.indice === i && e.campo === campo)?.mensaje : undefined);
  const errorValidez = intento && !validezValida(validezNum) ? "Tiene que ser un número entero de días, entre 1 y 365." : undefined;

  const documento: Documento = abierto
    ? {
        numero: abierto.numero,
        emisor: emisorDesdeJson(abierto.emisor),
        condicionIva: abierto.condicion_iva,
        fecha: abierto.fecha,
        validezDias: abierto.validez_dias,
        condiciones: abierto.condiciones ?? "",
        notas: abierto.notas ?? "",
        lineas: lineasDesdeJson(abierto.lineas),
      }
    : {
        numero: null,
        emisor: emisorDesdeOrganizacion(organizacion),
        condicionIva: organizacion.condicion_iva,
        fecha: hoy,
        validezDias: validezValida(validezNum) ? validezNum : organizacion.presupuesto_validez_dias,
        condiciones,
        notas,
        lineas: edicion,
      };
  // Un presupuesto guardado se recalcula con SU condicion frente al IVA (la de la foto), no la de hoy.
  const totales = calcularTotales(documento.lineas, documento.condicionIva);

  function actualizar(key: string, cambio: Partial<LineaEdit>) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...cambio } : l)));
  }
  function mover(indice: number, delta: -1 | 1) {
    setLineas((prev) => {
      const destino = indice + delta;
      if (destino < 0 || destino >= prev.length) return prev;
      const copia = [...prev];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }
  function agregarLibre() {
    setLineas((prev) => [...prev, { key: nuevaKey(), producto_id: null, descripcion: "", cantidad: "1", precio: "", descuento: "" }]);
  }
  function agregarProducto(id: string) {
    const p = productoPorId.get(id);
    if (!p) return;
    setLineas((prev) => [
      ...prev,
      { key: nuevaKey(), producto_id: p.id, descripcion: p.nombre, cantidad: "1", precio: p.precio == null ? "" : maskFromNumber(p.precio), descuento: "" },
    ]);
  }
  function elegirProducto(key: string, id: string) {
    const p = productoPorId.get(id);
    if (!p) {
      actualizar(key, { producto_id: null });
      return;
    }
    actualizar(key, { producto_id: p.id, descripcion: p.nombre, ...(p.precio == null ? {} : { precio: maskFromNumber(p.precio) }) });
  }

  /** Vuelve a un borrador editable con las lineas de un presupuesto ya emitido. */
  function usarComoBase(p: Presupuesto) {
    setLineas(lineasDesdeJson(p.lineas).map((l) => deLinea(l, nuevaKey())));
    setValidez(String(p.validez_dias));
    setCondiciones(p.condiciones ?? "");
    setNotas(p.notas ?? "");
    setAbierto(null);
    setIntento(false);
    setError(null);
  }

  async function guardar() {
    setIntento(true);
    setError(null);
    if (!validezValida(validezNum) || erroresLinea.length > 0) {
      setError("Revisá los campos marcados antes de guardar.");
      return;
    }
    const problema = problemaDelDocumento(edicion, totales.total);
    if (problema) {
      setError(problema);
      return;
    }
    if (!activo) {
      setError("Guardar y numerar presupuestos se activa al aplicar la migración 0012. Mientras tanto podés imprimirlo como borrador.");
      return;
    }

    setSaving(true);
    const { data, error: dbError } = await createClient()
      .from("presupuestos")
      .insert({
        oportunidad_id: oportunidad.id,
        // `fecha` no se manda: la pone la base (hoy en Argentina) y vuelve en la fila guardada.
        validez_dias: validezNum,
        condiciones: condiciones.trim() || null,
        notas: notas.trim() || null,
        lineas: lineasParaGuardar(edicion) as unknown as Json,
        total: totales.total,
        // Foto del emisor: reimprimir usa esto y no lo que la organizacion tenga mas adelante.
        condicion_iva: organizacion.condicion_iva,
        emisor: emisorDesdeOrganizacion(organizacion) as unknown as Json,
      })
      .select()
      .single();
    setSaving(false);

    if (dbError || !data) {
      if (esErrorDeEsquema(dbError)) {
        setActivo(false);
        setError("Guardar y numerar presupuestos se activa al aplicar la migración 0012. Mientras tanto podés imprimirlo como borrador.");
      } else if (dbError?.code === "42501") {
        setError("No tenés permiso para guardar presupuestos de esta oportunidad, o ya no está en tu cartera.");
      } else {
        setError("No se pudo guardar el presupuesto. Revisá los datos e intentá de nuevo.");
      }
      return;
    }
    setPrevios((prev) => [data, ...prev]);
    setAbierto(data);
    setIntento(false);
    showToast(`Presupuesto ${formatearNumero(data.numero)} guardado.`, "success");
  }

  /** Deja asentado en el historial que se envio la propuesta. Una sola vez por presupuesto; si falla, el PDF sale igual. */
  async function registrarActividad(p: Presupuesto): Promise<Presupuesto> {
    // Sin `oportunidades.editar` la base no deja marcar el presupuesto como registrado (el UPDATE lo rechaza): registrar
    // la actividad igual la duplicaria en cada impresion.
    if (p.actividad_id || !puedeGuardar || !tipoPropuestaId || (!oportunidad.empresa_id && !oportunidad.contacto_id)) return p;
    // Ya se inserto en esta pestaña (el vinculo fallo): no se vuelve a insertar otra actividad.
    if (actividadInsertada.current.has(p.id)) return p;
    const supabase = createClient();
    const venc = fechaVencimiento(p.fecha, p.validez_dias);
    const { data: actividad, error: errorActividad } = await supabase
      .from("bitacora_entradas")
      .insert({
        empresa_id: oportunidad.empresa_id,
        contacto_id: oportunidad.contacto_id,
        oportunidad_id: oportunidad.id,
        tipo_actividad_id: tipoPropuestaId,
        titulo: tituloActividad(p.numero, oportunidad.titulo),
        detalle: `Total ${formatPesos(Number(p.total))}. Válido hasta el ${formatFecha(venc)}.`,
        ocurrido_en: new Date().toISOString(),
      })
      .select()
      .single();
    if (errorActividad || !actividad) {
      showToast("Se imprime igual, pero no se pudo dejar la actividad en el historial.", "warning");
      return p;
    }
    actividadInsertada.current.add(p.id);
    const { data: marcado, error: errorVinculo } = await supabase
      .from("presupuestos")
      .update({ actividad_id: actividad.id })
      .eq("id", p.id)
      .select()
      .single();
    if (errorVinculo || !marcado) {
      // La actividad ya esta en el historial pero el presupuesto no quedo marcado: se dice, para que nadie la cargue de nuevo
      // a mano, y no se vuelve a insertar en esta pestaña. Otra pestaña podria repetirla: por eso se avisa.
      showToast(
        "La actividad «Envío de propuesta» quedó en el historial, pero no se pudo vincular a este presupuesto (figura «Sin registrar»). No la cargues de nuevo.",
        "warning",
        10000,
      );
      return p;
    }
    setPrevios((prev) => prev.map((x) => (x.id === marcado.id ? marcado : x)));
    setAbierto((actual) => (actual?.id === marcado.id ? marcado : actual));
    showToast("Quedó registrado en el historial como «Envío de propuesta».", "success");
    return marcado;
  }

  async function imprimir() {
    // Reentrada (doble clic, Enter repetido): la segunda llamada no hace nada. Sin esto dos llamadas veian
    // `actividad_id` todavia vacio y registraban dos veces «Envío de propuesta».
    if (imprimiendo.current) return;
    imprimiendo.current = true;
    setImprimiendoUi(true);
    try {
      // Con la pestaña abierta mucho rato la URL firmada del logo pudo vencer: se firma de nuevo y se espera la imagen.
      if (logoPath) {
        const nueva = await firmarLogo(logoPath);
        if (nueva) {
          await precargar(nueva);
          setLogoUrl(nueva);
          await new Promise<void>((listo) => requestAnimationFrame(() => requestAnimationFrame(() => listo())));
        }
      }
      if (abierto) await registrarActividad(abierto);
      imprimirConTitulo(`Presupuesto ${formatearNumero(documento.numero)} - ${empresa?.nombre ?? oportunidad.titulo}`);
    } finally {
      imprimiendo.current = false;
      setImprimiendoUi(false);
    }
  }

  const sinDatosDeEmpresa =
    !logoUrl &&
    !organizacion.razon_social &&
    !organizacion.cuit &&
    !organizacion.direccion &&
    !organizacion.telefono &&
    !organizacion.email &&
    !organizacion.sitio_web;

  return (
    <div className="flex w-full flex-col gap-4">
      {/* ── Todo lo de este bloque queda fuera del papel ───────────────── */}
      <nav aria-label="Ruta" className="no-print">
        <Link
          href={`/oportunidades/${oportunidad.id}`}
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Volver a la oportunidad
        </Link>
      </nav>

      <header className="no-print flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
            <span className="h-px w-6 bg-brand" aria-hidden="true" />
            Presupuesto
          </p>
          <h1 className="break-words font-display text-[2rem] leading-tight tracking-[-0.01em]">{oportunidad.titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {abierto
              ? `Estás viendo el presupuesto ${formatearNumero(abierto.numero)}, emitido el ${formatFecha(abierto.fecha)}. Un presupuesto emitido no se modifica.`
              : "Armá las líneas, revisá la hoja y guardala para numerarla. Después imprimila o guardala como PDF."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {abierto && (
            <>
              <Button variant="outline" className="gap-1.5" onClick={() => usarComoBase(abierto)}>
                <Copy aria-hidden="true" className="h-4 w-4" /> Usar como base de uno nuevo
              </Button>
              <Button variant="outline" className="gap-1.5" onClick={() => setAbierto(null)}>
                <FileText aria-hidden="true" className="h-4 w-4" /> Volver al borrador
              </Button>
            </>
          )}
          {!abierto && puedeGuardar && (
            <Button className="gap-1.5" onClick={guardar} disabled={saving}>
              <Save aria-hidden="true" className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar presupuesto"}
            </Button>
          )}
          <Button variant={abierto ? "default" : "outline"} className="gap-1.5" onClick={imprimir} disabled={imprimiendoUi} aria-busy={imprimiendoUi}>
            <Printer aria-hidden="true" className="h-4 w-4" /> Imprimir / Guardar PDF
          </Button>
        </div>
      </header>

      {sinDatosDeEmpresa && puedeConfigurar && (
        <p role="status" className="no-print flex items-start gap-2 rounded-lg border border-border bg-secondary p-3 text-sm">
          <Settings aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            <strong>Tu encabezado está vacío.</strong> Cargá la razón social, el CUIT, los datos de contacto y el logo en{" "}
            <Link
              href="/configuracion"
              className="rounded-sm font-semibold text-brand underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Configuración
            </Link>{" "}
            para que salgan en cada presupuesto.
          </span>
        </p>
      )}

      <div className="no-print">
        <AvisoMigracion visible={!activo && puedeConfigurar} migracion="0012" que="el guardado de presupuestos, con su número y su lista" />
      </div>

      {error && (
        <div className="no-print">
          <FormBanner message={error} />
        </div>
      )}

      {/* ── Editor ─────────────────────────────────────────────────────── */}
      {!abierto && (
        <Card className="no-print p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Líneas</h2>
            <p className="text-xs text-muted-foreground">
              {organizacion.condicion_iva === "responsable_inscripto"
                ? "Cargá los precios sin IVA: el IVA 21 % se suma abajo."
                : "Los precios se imprimen tal cual los cargues."}
            </p>
          </div>

          {lineas.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Todavía no hay líneas. Agregá un producto del catálogo o una línea libre.
            </p>
          )}

          <ol className="space-y-3">
            {lineas.map((l, i) => {
              const importe = importeLinea(aLinea(l)).netoC / 100;
              return (
                <li key={l.key} className="rounded-lg border border-border p-3">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                    <CampoSelect
                      id={`linea-${l.key}-producto`}
                      label={<>Producto{deLaLinea(i + 1)}</>}
                      placeholder="Texto libre"
                      searchable
                      value={l.producto_id ?? ""}
                      onChange={(v) => elegirProducto(l.key, v)}
                      options={[{ value: "", label: "Texto libre" }, ...productos.map((p) => ({ value: p.id, label: p.nombre }))]}
                    />
                    <Campo
                      id={`linea-${l.key}-descripcion`}
                      label={<>Descripción{deLaLinea(i + 1)}</>}
                      required
                      placeholder="Arco de fútbol 5/7, reforzado"
                      value={l.descripcion}
                      onChange={(v) => actualizar(l.key, { descripcion: v })}
                      error={errorDe(i, "descripcion")}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-[6rem_minmax(0,1fr)_6rem_minmax(0,1fr)_auto] lg:items-end">
                    <Campo
                      id={`linea-${l.key}-cantidad`}
                      label={<>Cantidad{deLaLinea(i + 1)}</>}
                      required
                      inputMode="decimal"
                      value={l.cantidad}
                      onChange={(v) => actualizar(l.key, { cantidad: maskMoney(v) })}
                      error={errorDe(i, "cantidad")}
                    />
                    <CampoMoney
                      id={`linea-${l.key}-precio`}
                      label={<>Precio unitario{deLaLinea(i + 1)}</>}
                      value={l.precio}
                      onChange={(v) => actualizar(l.key, { precio: v })}
                      error={errorDe(i, "precio_unitario")}
                    />
                    <Campo
                      id={`linea-${l.key}-descuento`}
                      label={<>Dto. %{deLaLinea(i + 1)}</>}
                      inputMode="decimal"
                      placeholder="0"
                      value={l.descuento}
                      onChange={(v) => actualizar(l.key, { descuento: maskMoney(v) })}
                      error={errorDe(i, "descuento_pct")}
                    />
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Importe{deLaLinea(i + 1)}</p>
                      <p className="flex h-10 items-center font-mono text-sm font-semibold tabular-nums" data-testid={`importe-${i}`}>
                        {formatPesos(importe)}
                      </p>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1 lg:col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Subir la línea ${i + 1}`}
                        title="Subir"
                        disabled={i === 0}
                        onClick={() => mover(i, -1)}
                      >
                        <ArrowUp aria-hidden="true" className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Bajar la línea ${i + 1}`}
                        title="Bajar"
                        disabled={i === lineas.length - 1}
                        onClick={() => mover(i, 1)}
                      >
                        <ArrowDown aria-hidden="true" className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Quitar la línea ${i + 1}`}
                        title="Quitar"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setLineas((prev) => prev.filter((x) => x.key !== l.key))}
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,18rem)_auto] sm:items-end sm:justify-start">
            <CampoSelect
              id="agregar-producto"
              label="Agregar del catálogo"
              placeholder="Elegí un producto…"
              searchable
              value=""
              onChange={agregarProducto}
              options={productos.map((p) => ({ value: p.id, label: p.nombre }))}
            />
            <Button type="button" variant="outline" className="gap-1.5" onClick={agregarLibre}>
              <Plus aria-hidden="true" className="h-4 w-4" /> Agregar línea libre
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-[10rem_minmax(0,1fr)]">
            <Campo
              id="validez"
              label="Validez (días)"
              required
              inputMode="numeric"
              value={validez}
              onChange={setValidez}
              error={errorValidez}
            />
            <CampoTextarea
              id="condiciones"
              label="Condiciones"
              rows={3}
              maxLength={2000}
              placeholder="Forma de pago, plazo de entrega, garantía…"
              value={condiciones}
              onChange={setCondiciones}
            />
            <CampoTextarea id="notas" label="Observaciones" className="md:col-span-2" rows={2} maxLength={2000} value={notas} onChange={setNotas} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            La validez y las condiciones arrancan con lo que cargaste en Configuración; acá las cambiás solo para este presupuesto.
            {!abierto && " Sin guardar, se imprime como «Borrador»: sin número y sin dejar rastro en el historial."}
          </p>
        </Card>
      )}

      {/* ── La hoja: es lo unico que se imprime ────────────────────────── */}
      <div className="hoja-scroll overflow-x-auto">
        <Hoja
          nombreOrganizacion={organizacion.nombre}
          logoUrl={logoUrl}
          empresa={empresa}
          contacto={contacto}
          referencia={oportunidad.titulo}
          doc={documento}
          totales={totales}
        />
      </div>

      {/* ── Presupuestos anteriores ────────────────────────────────────── */}
      {activo && (
        <div className="no-print">
          <Seccion icon={History} titulo="Presupuestos de esta oportunidad" cantidad={previos.length}>
            {previos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no guardaste ninguno. Al guardar, el presupuesto recibe su número.</p>
            ) : (
              <ul className="divide-y divide-border">
                {previos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {formatearNumero(p.numero)}
                        {abierto?.id === p.id && <span className="ml-2 text-xs font-medium text-muted-foreground">(en pantalla)</span>}
                      </p>
                      <dl className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <Dato label="Fecha">
                          <span className="tabular-nums">{formatFecha(p.fecha)}</span>
                        </Dato>
                        <Dato label="Total">
                          <span className="font-mono tabular-nums">{formatPesos(Number(p.total))}</span>
                        </Dato>
                        <Dato label="Historial">{p.actividad_id ? "Registrado" : "Sin registrar"}</Dato>
                      </dl>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setAbierto(p)}>
                      Ver / reimprimir<span className="sr-only"> el presupuesto {formatearNumero(p.numero)}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </div>
      )}
    </div>
  );
}

/** El papel. Blanco y con texto oscuro en cualquier tema: es un documento, no una pantalla del CRM. */
function Hoja({
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
