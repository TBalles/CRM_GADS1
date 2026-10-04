"use server";

import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/sesion";
import { APP_NAME } from "@/lib/brand";
import { esUuid } from "@/lib/clientes";
import { leerCuenta360 } from "@/lib/cuenta360";
import { hoyAR } from "@/lib/oportunidades";
import type { Permiso } from "@/lib/permisos";
import { iaDisponible } from "@/lib/ia/config";
import { contextoAviso, contextoResumen, primerNombre, type CanchaIA } from "@/lib/ia/contexto";
import { generarBorrador } from "@/lib/ia/generar";
import { MAX_LLAMADAS, VENTANA_MS, crearLimitador } from "@/lib/ia/limite";
import { PEDIDO_AVISO, PEDIDO_RESUMEN, SISTEMA_AVISO, SISTEMA_RESUMEN, armarPedido } from "@/lib/ia/prompts";

/**
 * IA asistida (F7): dos acciones que REDACTAN un borrador. Ninguna guarda ni envía nada.
 *
 * Por qué son Server Actions (el CRUD del proyecto va por el cliente del navegador, ver docs/arquitectura.md):
 * llamar a Claude exige `ANTHROPIC_API_KEY`, un secreto que nunca puede llegar al navegador. Es el mismo
 * criterio por el que ya lo son el envío de mails y la clave de servicio.
 *
 * Cada acción, en este orden:
 *   1. verifica la sesión, que la IA esté activada y el permiso del rol;
 *   2. valida la forma de lo que llega (solo ids: el contexto NUNCA lo manda el navegador);
 *   3. descuenta del límite por persona;
 *   4. vuelve a LEER los datos con el cliente de sesión (la RLS limita lo que ve esa persona);
 *   5. arma el contexto mínimo (`contexto.ts`), llama a Claude y devuelve el texto.
 */

export type ResultadoBorrador = { ok: true; texto: string } | { ok: false; error: string };

const falla = (error: string): ResultadoBorrador => ({ ok: false, error });

/**
 * 10 borradores cada 10 minutos por persona, en memoria: es de mejor esfuerzo y por instancia del servidor
 * (ver el aviso en `limite.ts`).
 */
const limitador = crearLimitador(MAX_LLAMADAS, VENTANA_MS);

async function preparar(permiso: Permiso) {
  const sesion = await getSesion();
  if (!sesion) return { ok: false, error: "Sesión vencida. Volvé a ingresar." } as const;
  if (!iaDisponible()) return { ok: false, error: "La IA no está activada en este servidor." } as const;
  if (!sesion.puedeOperar || !sesion.puede(permiso)) {
    return { ok: false, error: "Tu rol no tiene permiso para usar esta función." } as const;
  }
  return { ok: true, sesion } as const;
}

function cupo(userId: string): string | null {
  const r = limitador.intentar(userId);
  if (r.ok) return null;
  const min = Math.ceil(r.reintentarEnSeg / 60);
  return `Pediste muchos borradores seguidos. Probá de nuevo en ${min} ${min === 1 ? "minuto" : "minutos"}.`;
}

/** Lecturas opcionales (canchas, avisos previos): si fallan, el borrador sale sin ese dato. */
const opcional = <T,>(r: { data: T[] | null; error: unknown }): T[] => (r.error ? [] : (r.data ?? []));

/* ------------------------------------------------------------------------ */
/* Aviso de recambio                                                         */
/* ------------------------------------------------------------------------ */

export async function redactarAvisoRecambio(input: { ventaItemId: unknown }): Promise<ResultadoBorrador> {
  const previo = await preparar("alertas.enviar");
  if (!previo.ok) return falla(previo.error);
  const { sesion } = previo;

  if (typeof input?.ventaItemId !== "string" || !esUuid(input.ventaItemId)) return falla("Esta alerta ya no está vigente.");
  const ventaItemId = input.ventaItemId;

  const sinCupo = cupo(sesion.user.id);
  if (sinCupo) return falla(sinCupo);

  const supabase = await createClient();
  // La vista garantiza que el equipo SIGUE siendo una alerta vigente, igual que el envío.
  const { data: alerta } = await supabase.from("alertas_vida_util").select("*").eq("venta_item_id", ventaItemId).maybeSingle();
  if (!alerta) return falla("Esta alerta ya no está vigente.");

  const dueno = alerta.empresa_id ? (["empresa_id", alerta.empresa_id] as const) : alerta.contacto_id ? (["contacto_id", alerta.contacto_id] as const) : null;
  const [ventas, avisos, canchas] = await Promise.all([
    dueno
      ? supabase
          .from("ventas")
          .select("fecha, items:venta_items(cantidad, producto:productos(nombre))")
          .eq(dueno[0], dueno[1])
          .order("fecha", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("alertas_enviadas").select("canal, enviado_at").eq("venta_item_id", ventaItemId).order("enviado_at", { ascending: false }).limit(5),
    // La tabla es de la migración 0011: sin ella, o sin empresa, el borrador sale sin canchas.
    alerta.empresa_id
      ? supabase.from("canchas").select("nombre, formato, cantidad, superficie, activa").eq("empresa_id", alerta.empresa_id).limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const contexto = contextoAviso({
    hoy: hoyAR(),
    firma: `Equipo de ${APP_NAME}`,
    alerta,
    ventas: opcional(ventas),
    avisos: opcional(avisos),
    canchas: opcional(canchas) as CanchaIA[],
  });

  const res = await generarBorrador({ sistema: SISTEMA_AVISO, usuario: armarPedido(contexto, PEDIDO_AVISO) });
  return res.ok ? { ok: true, texto: res.texto } : falla(res.motivo);
}

/* ------------------------------------------------------------------------ */
/* Resumen de la cuenta (ficha 360)                                          */
/* ------------------------------------------------------------------------ */

export async function resumirCuenta(input: { tipo: unknown; id: unknown }): Promise<ResultadoBorrador> {
  const previo = await preparar("clientes.ver");
  if (!previo.ok) return falla(previo.error);
  const { sesion } = previo;

  const tipo = input?.tipo;
  if ((tipo !== "empresa" && tipo !== "contacto") || typeof input.id !== "string" || !esUuid(input.id)) {
    return falla("No encontramos esa cuenta.");
  }
  const id = input.id;

  const sinCupo = cupo(sesion.user.id);
  if (sinCupo) return falla(sinCupo);

  const supabase = await createClient();
  const permisos = {
    oportunidades: sesion.puede("oportunidades.ver"),
    ventas: sesion.puede("ventas.ver"),
    actividades: sesion.puede("bitacora.ver"),
    // Igual que la historia de la ficha: los avisos cuelgan de las ventas.
    avisos: sesion.puede("alertas.ver") && sesion.puede("ventas.ver"),
  };

  // La misma lectura acotada que alimenta la ficha 360, con la sesión de la persona: lo que su rol o su
  // cartera no ven, no llega a la IA.
  let cuenta: Awaited<ReturnType<typeof leerCuenta360>>;
  let cabecera: { nombre: string; cargo?: string | null; empresa?: string | null; estado: string | null; tipoCliente?: string | null };
  let canchas: CanchaIA[] = [];
  try {
    if (tipo === "empresa") {
      const { data: empresa } = await supabase.from("empresas").select("nombre, estado, tipo_cliente").eq("id", id).maybeSingle();
      if (!empresa) return falla("No encontramos esa cuenta.");
      cabecera = { nombre: empresa.nombre, estado: empresa.estado, tipoCliente: empresa.tipo_cliente };
      const [c, canchasRes] = await Promise.all([
        leerCuenta360(supabase, "empresa_id", id, permisos),
        supabase.from("canchas").select("nombre, formato, cantidad, superficie, activa").eq("empresa_id", id).limit(20),
      ]);
      cuenta = c;
      canchas = opcional(canchasRes);
    } else {
      const { data: contacto } = await supabase.from("contactos").select("nombre, cargo, estado, empresa_id").eq("id", id).maybeSingle();
      if (!contacto) return falla("No encontramos esa cuenta.");
      // La empresa del contacto puede ser de otra cartera: si la RLS no la muestra, no figura.
      const empresa = contacto.empresa_id
        ? (await supabase.from("empresas").select("nombre").eq("id", contacto.empresa_id).maybeSingle()).data
        : null;
      cabecera = { nombre: primerNombre(contacto.nombre), cargo: contacto.cargo, empresa: empresa?.nombre ?? null, estado: contacto.estado };
      cuenta = await leerCuenta360(supabase, "contacto_id", id, permisos);
    }
  } catch {
    // Sin detalle: el mensaje de la base no es para la pantalla.
    return falla("No pudimos leer los datos de la cuenta. Probá de nuevo.");
  }

  const contexto = contextoResumen({
    hoy: hoyAR(),
    tipo,
    ...cabecera,
    ventas: permisos.ventas ? cuenta.ventas : null,
    oportunidades: permisos.oportunidades ? cuenta.oportunidades : null,
    actividades: permisos.actividades ? cuenta.actividades : null,
    avisos: permisos.avisos ? cuenta.avisos : null,
    etapas: cuenta.etapas,
    primeraCompra: cuenta.primeraCompra,
    canchas,
    truncado: Object.values(cuenta.truncado).some(Boolean),
  });

  const res = await generarBorrador({ sistema: SISTEMA_RESUMEN, usuario: armarPedido(contexto, PEDIDO_RESUMEN) });
  return res.ok ? { ok: true, texto: res.texto } : falla(res.motivo);
}
