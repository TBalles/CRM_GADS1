// Imports relativos: se prueba con `node --test` (ver layout.check.ts).
import { APP_NAME } from "../brand.ts";
import type { ContenidoEmail } from "./layout.ts";

/**
 * Contenido de los mails de cuenta. Solo texto: el diseño lo pone
 * renderEmail() en layout.ts.
 */

/** Nombre de pila para el saludo: "Hola Juan Pérez," suena a carta de banco. */
function nombreDePila(nombre: string | null | undefined): string | null {
  const limpio = nombre?.trim();
  return limpio ? limpio.split(/\s+/)[0] : null;
}

function saludo(nombre: string | null | undefined): string {
  const pila = nombreDePila(nombre);
  return pila ? `Hola ${pila},` : "Hola,";
}

const NOTA_LINK = (link: string) =>
  `¿El botón no funciona? Copiá y pegá este link en tu navegador: ${link}`;

/** Invitación a una cuenta nueva: el usuario define su contraseña con el link. */
export function mailActivacion({
  nombre,
  organizacion,
  link,
  reenvio = false,
}: {
  nombre: string | null;
  organizacion: string | null;
  link: string;
  reenvio?: boolean;
}): { asunto: string; contenido: ContenidoEmail } {
  const donde = organizacion ? `el CRM de ${organizacion}` : APP_NAME;
  return {
    asunto: reenvio
      ? `Activá tu cuenta de ${APP_NAME} (nuevo link)`
      : `Te invitaron a ${APP_NAME}: activá tu cuenta`,
    contenido: {
      preheader: `Definí tu contraseña para entrar a ${donde}.`,
      encabezado: reenvio ? "Tu cuenta te espera" : "Bienvenido",
      bajada: organizacion ? `${organizacion} · ${APP_NAME}` : APP_NAME,
      icono: "✓",
      titulo: "Activación de cuenta",
      saludo: saludo(nombre),
      parrafos: [
        reenvio
          ? `Intentaste ingresar a ${donde}, pero tu cuenta todavía no está activada. Te mandamos un link nuevo.`
          : `Te crearon una cuenta para usar ${donde}.`,
        "Para terminar de configurarla, tocá el botón y elegí tu contraseña. Después vas a poder ingresar con tu email y esa contraseña.",
      ],
      boton: { texto: "Activar mi cuenta", url: link },
      nota: NOTA_LINK(link),
      cierre: "¡Te esperamos!",
      firma: `Equipo de ${APP_NAME}`,
      aviso:
        "El link es personal y vence en poco tiempo. Si venció, intentá ingresar y te mandamos uno nuevo.",
    },
  };
}

/** Recuperación de contraseña de una cuenta ya activada. */
export function mailRecuperacion({
  nombre,
  link,
}: {
  nombre: string | null;
  link: string;
}): { asunto: string; contenido: ContenidoEmail } {
  return {
    asunto: `Restablecé tu contraseña de ${APP_NAME}`,
    contenido: {
      preheader: "Pediste cambiar tu contraseña. El link vence en poco tiempo.",
      encabezado: "Recuperar acceso",
      bajada: APP_NAME,
      icono: "↺",
      titulo: "Restablecer contraseña",
      saludo: saludo(nombre),
      parrafos: [
        "Recibimos un pedido para restablecer la contraseña de tu cuenta.",
        "Tocá el botón para elegir una nueva. Si no fuiste vos, ignorá este mail: tu contraseña actual sigue funcionando.",
      ],
      boton: { texto: "Elegir nueva contraseña", url: link },
      nota: NOTA_LINK(link),
      firma: `Equipo de ${APP_NAME}`,
      aviso: "Nunca te vamos a pedir tu contraseña por mail.",
    },
  };
}
