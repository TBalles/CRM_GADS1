"use server";

import { createClient } from "@/lib/supabase/server";
import { getRemitente } from "@/lib/contacto";
import { asunto, cuerpo, cuerpoWhatsapp, desdeFila } from "./plantillas";

/**
 * Envio de una alerta de recambio.
 *
 * Hay DOS caminos y los dos son validos:
 *
 * 1. Con `RESEND_API_KEY` + `ALERTAS_FROM_EMAIL` cargadas, el mail sale del
 *    servidor y el usuario no ve un cliente de correo.
 * 2. Sin esas variables, el navegador abre el cliente de correo del usuario
 *    con el mensaje ya escrito, y esta accion solo deja registrado el envio.
 *
 * SEGURIDAD — lo que esta accion NO acepta del cliente:
 *
 * Una Server Action es un endpoint HTTP publico. Si recibiera destinatario,
 * asunto y cuerpo desde el navegador, cualquier cuenta logueada podria usarla
 * para mandar lo que quisiera, a quien quisiera, desde el dominio verificado de
 * la empresa: un relay abierto que quema la reputacion de envio. Por eso solo
 * recibe el `ventaItemId`, y el destinatario y el texto se DERIVAN aca, en el
 * servidor, de la fila real de la base. El cliente no puede elegir a quien
 * escribirle ni que decirle.
 *
 * Se usa `fetch` contra la API de Resend en lugar de su SDK: es un POST con
 * un JSON, una dependencia menos que mantener.
 */

export type ResultadoEnvio =
  | { ok: true; modo: "enviado" }
  | { ok: true; modo: "mailto" }
  | { ok: false; error: string };

/**
 * Sesion + fila de la alerta, o el motivo por el que no se puede seguir.
 *
 * Leer de la vista (y no de las tablas) garantiza que el item SIGUE siendo una
 * alerta vigente: no se puede disparar un aviso sobre un equipo que no vencio.
 */
async function cargarAlerta(ventaItemId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // `ok` es un discriminante EXPLICITO. Sin el, TS normaliza los literales de
  // retorno agregando `error?: undefined` a la rama exitosa, y un chequeo con
  // `"error" in x` deja de achicar el tipo en ninguna de las dos ramas.
  if (!user) return { ok: false, error: "Sesión vencida. Volvé a ingresar." } as const;

  const { data: alerta } = await supabase
    .from("alertas_vida_util")
    .select("*")
    .eq("venta_item_id", ventaItemId)
    .maybeSingle();

  if (!alerta) return { ok: false, error: "Esta alerta ya no está vigente." } as const;

  return { ok: true, supabase, user, alerta } as const;
}

/**
 * Deja asentado el envio. Devuelve el error en vez de tragarlo: la
 * deduplicacion de alertas depende ENTERAMENTE de esta tabla, y un registro
 * perdido hace que el proximo usuario vuelva a avisarle al mismo cliente.
 */
async function registrarEnvio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fila: {
    venta_item_id: string;
    canal: "email" | "whatsapp";
    destinatario: string;
    mensaje: string;
    enviado_por: string;
  },
) {
  const { error } = await supabase.from("alertas_enviadas").insert(fila);
  return error;
}

export async function enviarAlertaEmail({
  ventaItemId,
}: {
  ventaItemId: string;
}): Promise<ResultadoEnvio> {
  const cargada = await cargarAlerta(ventaItemId);
  if (!cargada.ok) return { ok: false, error: cargada.error };
  const { supabase, user, alerta } = cargada;

  // Se prefiere el mail de la persona; el del club es el respaldo.
  const destinatario = alerta.contacto_email ?? alerta.empresa_email;
  if (!destinatario) {
    return { ok: false, error: "Este cliente no tiene un email cargado." };
  }

  const datos = desdeFila(alerta);
  const mensaje = cuerpo(datos);
  const { apiKey, from } = getRemitente();
  const enviaServidor = Boolean(apiKey && from);

  if (enviaServidor) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [destinatario], subject: asunto(datos), text: mensaje }),
    });

    if (!res.ok) {
      return { ok: false, error: "El proveedor de mail rechazó el envío." };
    }
  }

  const errorRegistro = await registrarEnvio(supabase, {
    venta_item_id: ventaItemId,
    canal: "email",
    destinatario,
    mensaje,
    enviado_por: user.id,
  });

  if (errorRegistro) {
    // El mail YA salió (o ya se abrió el cliente de correo) y eso no se puede
    // deshacer. Lo que hay que evitar es que alguien lo mande de nuevo creyendo
    // que no se avisó: el mensaje lo dice explícitamente.
    return {
      ok: false,
      error: enviaServidor
        ? "El mail se envió, pero no quedó registrado. No lo vuelvas a mandar."
        : "No se pudo registrar el envío. Si mandaste el mail, no lo repitas.",
    };
  }

  return { ok: true, modo: enviaServidor ? "enviado" : "mailto" };
}

/** Deja asentado un envío de WhatsApp, que siempre lo dispara el navegador. */
export async function registrarEnvioWhatsapp({
  ventaItemId,
}: {
  ventaItemId: string;
}): Promise<ResultadoEnvio> {
  const cargada = await cargarAlerta(ventaItemId);
  if (!cargada.ok) return { ok: false, error: cargada.error };
  const { supabase, user, alerta } = cargada;

  const telefono = alerta.contacto_telefono ?? alerta.empresa_telefono;
  if (!telefono) {
    return { ok: false, error: "Este cliente no tiene un teléfono cargado." };
  }

  const errorRegistro = await registrarEnvio(supabase, {
    venta_item_id: ventaItemId,
    canal: "whatsapp",
    destinatario: telefono,
    mensaje: cuerpoWhatsapp(desdeFila(alerta)),
    enviado_por: user.id,
  });

  if (errorRegistro) {
    return { ok: false, error: "No se pudo registrar el envío. Si mandaste el mensaje, no lo repitas." };
  }

  return { ok: true, modo: "enviado" };
}
