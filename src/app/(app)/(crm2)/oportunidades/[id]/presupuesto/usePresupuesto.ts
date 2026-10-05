"use client";

import { useEffect, useRef, useState } from "react";
import { useCrmToast } from "@/components/crm/Toast";
import { createClient } from "@/lib/supabase/client";
import { formatFecha } from "@/lib/clientes";
import { esErrorDeEsquema } from "@/lib/esquema";
import { sinTrabarse } from "@/lib/guardar";
import {
  calcularTotales,
  emisorDesdeJson,
  emisorDesdeOrganizacion,
  fechaVencimiento,
  formatearNumero,
  formatPesos,
  lineasDesdeJson,
  lineasParaGuardar,
  problemaDelDocumento,
  tituloActividad,
  validarLineas,
  validezValida,
} from "@/lib/presupuesto";
import type { Json, Tables } from "@/lib/supabase/types";
import type { Contacto, Documento, Empresa } from "./Hoja";
import {
  aLinea,
  cambioDeProducto,
  deLinea,
  lineaDeProducto,
  lineaLibre,
  lineasIniciales,
  moverLinea,
  type LineaEdit,
  type ProductoCatalogo,
} from "./logica";

export type Presupuesto = Tables<"presupuestos">;

export type Org = {
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

export type PresupuestoProps = {
  oportunidad: { id: string; titulo: string; empresa_id: string | null; contacto_id: string | null; producto_id: string | null; monto: number | null };
  organizacion: Org;
  /** URL firmada del logo (vence); null si la organizacion no tiene logo. */
  logoUrl: string | null;
  /** Ruta del logo en el bucket `logos`, para volver a firmarlo. */
  logoPath: string | null;
  empresa: Empresa | null;
  contacto: Contacto | null;
  productos: ProductoCatalogo[];
  previos: Presupuesto[];
  /** La tabla `presupuestos` (migracion 0012) existe en la base. */
  presupuestosActivos: boolean;
  /** El tipo de actividad "Envio de propuesta"; null = no existe o el rol no puede registrar actividades. */
  tipoPropuestaId: string | null;
  /** Hoy en Argentina, calculado en el servidor. */
  hoy: string;
  puedeGuardar: boolean;
  puedeConfigurar: boolean;
};

const SIN_MIGRACION = "Guardar y numerar presupuestos se activa al aplicar la migración 0012. Mientras tanto podés imprimirlo como borrador.";

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

/**
 * Estado y acciones del editor de presupuesto: los mismos que el editor legacy (Lote D lo movió fuera de la vista sin
 * cambiar datos, validaciones, numeración, guardado, impresión ni avisos). Única diferencia: el guardado corre con
 * `sinTrabarse`, así una llamada que TIRA (red caída) apaga "Guardando…" y muestra el error en vez de trabar la pantalla.
 * Las funciones que agregan líneas devuelven la `key` nueva y `guardar` si terminó bien: la vista mueve el foco con eso.
 */
export function usePresupuesto({
  oportunidad,
  organizacion,
  logoUrl: logoUrlInicial,
  logoPath,
  empresa,
  productos,
  previos: previosIniciales,
  presupuestosActivos,
  tipoPropuestaId,
  hoy,
  puedeGuardar,
}: PresupuestoProps) {
  const { showToast } = useCrmToast();
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
  const [lineas, setLineas] = useState<LineaEdit[]>(() => lineasIniciales(oportunidad, productos));
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
    setLineas((prev) => moverLinea(prev, indice, delta) as LineaEdit[]);
  }
  function quitar(key: string) {
    setLineas((prev) => prev.filter((x) => x.key !== key));
  }
  function agregarLibre(): string {
    const key = nuevaKey();
    setLineas((prev) => [...prev, lineaLibre(key)]);
    return key;
  }
  function agregarProducto(id: string): string | null {
    const p = productoPorId.get(id);
    if (!p) return null;
    const key = nuevaKey();
    setLineas((prev) => [...prev, lineaDeProducto(key, p)]);
    return key;
  }
  function elegirProducto(key: string, id: string) {
    actualizar(key, cambioDeProducto(productoPorId.get(id)));
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

  /** Devuelve true si quedó guardado (la vista mueve el foco a "Imprimir"). */
  async function guardar(): Promise<boolean> {
    setIntento(true);
    setError(null);
    if (!validezValida(validezNum) || erroresLinea.length > 0) {
      setError("Revisá los campos marcados antes de guardar.");
      return false;
    }
    const problema = problemaDelDocumento(edicion, totales.total);
    if (problema) {
      setError(problema);
      return false;
    }
    if (!activo) {
      setError(SIN_MIGRACION);
      return false;
    }

    setSaving(true);
    let guardado = false;
    await sinTrabarse(
      async () => {
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
            setError(SIN_MIGRACION);
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
        guardado = true;
      },
      (mensaje) => {
        setSaving(false);
        setError(mensaje);
      },
    );
    return guardado;
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

  return {
    logoUrl,
    lineas,
    validez,
    setValidez,
    condiciones,
    setCondiciones,
    notas,
    setNotas,
    activo,
    previos,
    abierto,
    setAbierto,
    saving,
    error,
    imprimiendoUi,
    documento,
    totales,
    errorDe,
    errorValidez,
    actualizar,
    mover,
    quitar,
    agregarLibre,
    agregarProducto,
    elegirProducto,
    usarComoBase,
    guardar,
    imprimir,
    sinDatosDeEmpresa,
  };
}
