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

export type Remitente = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

/**
 * Casilla que envia las alertas, por SMTP. Devuelve null si falta algo: la
 * seccion de alertas cae entonces a `mailto:` y abre el cliente de correo del
 * usuario, asi que funciona igual sin credenciales.
 *
 * SMTP y no la API de un proveedor: con un Gmail es la UNICA opcion (los
 * proveedores tipo Resend exigen un dominio propio verificado, y gmail.com no
 * es de nadie de nosotros), y el dia que haya dominio sirve igual — Resend,
 * Postmark y SendGrid tambien exponen SMTP. Se cambian las variables, no el
 * codigo.
 *
 * Con Gmail, SMTP_PASS es una CONTRASEÑA DE APLICACION (requiere verificacion
 * en dos pasos), nunca la contraseña de la cuenta. Ver el README.
 */
export function getRemitente(): Remitente | null {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  return {
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    user,
    // Gmail ignora un "from" que no sea la propia casilla (o un alias
    // verificado) y lo reescribe; por defecto se usa la casilla misma.
    pass: pass.replace(/\s/g, ""), // Google muestra la clave en 4 grupos con espacios
    from: process.env.ALERTAS_FROM_EMAIL ?? user,
  };
}

/**
 * El equipo, para la seccion "Nosotros" de la landing.
 *
 * COMPLETAR: son placeholders a proposito. Tienen que verse como placeholders
 * para que nadie deploye la landing con nombres inventados de gente real.
 */
export const EQUIPO = [
  "Rombolá, Facundo",
  "Ballesteros, Tomás",
  "Devalle, Felipe",
  "Ortiz, Enzo",
  "Munar, Matias",
] as const;

export const CARRERA = "Ingeniería en Informática — 4.º año";
export const UNIVERSIDAD = "Universidad Nacional de La Matanza (UNLaM)";
