/**
 * Datos de contacto y del equipo, leidos de variables de entorno.
 *
 * Todo lo que es "dato de la empresa" (mail, WhatsApp, direccion) sale de
 * `.env.local` en desarrollo y de las Environment Variables de Vercel en
 * produccion, para que cambiarlo NO sea un deploy de codigo.
 *
 * Se lee sin el prefijo NEXT_PUBLIC_ a proposito: la landing es un Server
 * Component, asi que estos valores se resuelven en el servidor y viajan ya
 * renderizados. Si algun dia hace falta leerlos desde un Client Component,
 * hay que pasarlos por props, no agregarle el prefijo.
 *
 * Los defaults son placeholders visibles: si falta la variable, en pantalla se
 * ve que falta en vez de quedar un hueco silencioso.
 */

export type Contacto = {
  email: string;
  whatsapp: string;
  /** Solo digitos, como lo pide wa.me. */
  whatsappLink: string;
  telefonoVisible: string;
  direccion: string;
  ciudad: string;
  instagram: string | null;
  linkedin: string | null;
};

/** wa.me no acepta espacios, guiones ni el `+`. */
function soloDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

export function getContacto(): Contacto {
  const whatsapp = process.env.CONTACTO_WHATSAPP ?? "+54 9 11 0000-0000";

  return {
    email: process.env.CONTACTO_EMAIL ?? "contacto@tucoynito.com.ar",
    whatsapp,
    whatsappLink: soloDigitos(whatsapp),
    telefonoVisible: process.env.CONTACTO_TELEFONO ?? whatsapp,
    direccion: process.env.CONTACTO_DIRECCION ?? "Florencio Varela 1903",
    ciudad: process.env.CONTACTO_CIUDAD ?? "San Justo, Buenos Aires",
    instagram: process.env.CONTACTO_INSTAGRAM ?? null,
    linkedin: process.env.CONTACTO_LINKEDIN ?? null,
  };
}

/**
 * Remitente de las alertas. Si no hay API key configurada, la seccion de
 * alertas cae a `mailto:` y abre el cliente de correo del usuario: sigue
 * funcionando sin credenciales, que es lo que hace falta para demostrarlo.
 */
export function getRemitente() {
  return {
    apiKey: process.env.RESEND_API_KEY ?? null,
    from: process.env.ALERTAS_FROM_EMAIL ?? null,
  };
}

/**
 * El equipo, para la seccion "Nosotros" de la landing.
 *
 * COMPLETAR: son placeholders a proposito. Tienen que verse como placeholders
 * para que nadie deploye la landing con nombres inventados de gente real.
 */
export const EQUIPO = [
  "Integrante 1",
  "Integrante 2",
  "Integrante 3",
  "Integrante 4",
  "Integrante 5",
] as const;

export const CARRERA = "Ingeniería en Informática — 4.º año";
export const UNIVERSIDAD = "Universidad Nacional de La Matanza (UNLaM)";
