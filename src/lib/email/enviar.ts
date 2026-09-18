import "server-only";
import nodemailer from "nodemailer";
import { APP_NAME } from "@/lib/brand";
import { getRemitente } from "@/lib/contacto";
import { renderEmail, type ContenidoEmail } from "./layout";
import { LOGO_CID, LOGO_PNG_BASE64 } from "./logo";

/**
 * UNICO punto de salida de mails de la app: alertas, activacion de cuentas y
 * recuperacion de contraseña. Todo pasa por el SMTP propio (la casilla de la
 * marca) y nada por el mailer de Supabase, que en el plan gratuito manda
 * poquisimos mails por hora y con su propio diseño.
 *
 * Devuelve null si salio, o un mensaje para mostrarle al usuario. El detalle
 * tecnico va al log del servidor (Vercel → Logs), no a la pantalla.
 */
export type ResultadoMail = { ok: true } | { ok: false; error: string; sinSmtp?: boolean };

export async function enviarMail({
  para,
  asunto,
  contenido,
}: {
  para: string;
  asunto: string;
  contenido: ContenidoEmail;
}): Promise<ResultadoMail> {
  const r = getRemitente();
  if (!r) {
    return {
      ok: false,
      sinSmtp: true,
      error: "El envío de mails no está configurado (faltan SMTP_USER y SMTP_PASS).",
    };
  }

  const { html, text } = renderEmail(contenido);
  const transport = nodemailer.createTransport({
    host: r.host,
    port: r.port,
    // 465 es TLS directo; 587 arranca en claro y sube con STARTTLS.
    secure: r.port === 465,
    auth: { user: r.user, pass: r.pass },
  });

  try {
    await transport.sendMail({
      from: { name: APP_NAME, address: r.from },
      // Si el destinatario responde, que le llegue a la casilla de contacto.
      // Solo si esta configurada DE VERDAD: getContacto() devuelve un
      // placeholder cuando falta, y las respuestas se irian a una casilla que
      // no existe. Sin replyTo, la respuesta va al remitente, que es real.
      replyTo: process.env.CONTACTO_EMAIL || undefined,
      to: para,
      subject: asunto,
      html,
      text,
      attachments: [
        {
          filename: "logo.png",
          content: Buffer.from(LOGO_PNG_BASE64, "base64"),
          cid: LOGO_CID,
          contentType: "image/png",
        },
      ],
    });
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string }).code;
    console.error("[mail] fallo el envio SMTP:", code, e);
    return {
      ok: false,
      // EAUTH es el tipico de Gmail: se uso la contraseña de la cuenta en vez de
      // una contraseña de aplicacion, o se revoco la de aplicacion.
      error:
        code === "EAUTH"
          ? "La casilla rechazó el usuario o la contraseña de aplicación. Revisá SMTP_USER y SMTP_PASS."
          : "El servidor de mail rechazó el envío. Probá de nuevo en un rato.",
    };
  }
}
