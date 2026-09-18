// Imports relativos y con extension (no "@/..."): este modulo se prueba con
// `node --test` (layout.check.ts) y Node no resuelve los alias del tsconfig.
import { APP_NAME } from "../brand.ts";
import { LOGO_ALTO, LOGO_ANCHO, LOGO_CID } from "./logo.ts";

/**
 * Plantilla unica de todos los mails de la app: activacion de cuenta,
 * recuperacion de contraseña y alertas de recambio.
 *
 * Funcion pura: recibe CONTENIDO y devuelve { html, text }. El diseño vive
 * solo aca, asi que los tres mails se ven iguales y un cambio de estilo es un
 * cambio en un lugar.
 *
 * Reglas de HTML para mail, que no son las de la web:
 * - Maquetado con <table> y estilos INLINE: Gmail y Outlook ignoran <style>
 *   en buena parte de los casos y no soportan flex ni grid.
 * - Sin imagenes externas: el logo va embebido por CID (ver logo.ts).
 * - Fondo claro. Los mails oscuros los invierte el modo oscuro de Gmail de
 *   formas impredecibles; uno claro lo oscurece prolijo.
 * - Siempre con version en texto plano: algunos clientes y filtros de spam la
 *   miran, y un mail solo-HTML suma puntos de spam.
 *
 * TODO lo que viene de afuera (nombres de clientes, productos, links) pasa por
 * `esc()`. Un cliente llamado "Pérez & Hijos" o "<b>" no puede romper el HTML
 * ni inyectar marcado.
 */

const C = {
  marca: "#0d6d4d",
  marcaOscura: "#0a5a3f",
  marcaSuave: "#e3f3ec",
  fondo: "#f3f5f4",
  card: "#ffffff",
  texto: "#1f2a26",
  textoSuave: "#5b6b65",
  borde: "#e4e9e7",
  cajaGris: "#f5f7f6",
  peligro: "#b42318",
  peligroSuave: "#fdecea",
} as const;

const FUENTE =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export type Tono = "marca" | "peligro";

export type ContenidoEmail = {
  /** Texto que muestran las bandejas al lado del asunto. */
  preheader: string;
  /** Titulo de la franja de arriba. */
  encabezado: string;
  /** Linea chica debajo del titulo de la franja. */
  bajada?: string;
  /** Glifo del circulo sobre el titulo de la card (✓, !, etc.). */
  icono: string;
  tono?: Tono;
  titulo: string;
  saludo: string;
  parrafos: string[];
  /** Filas etiqueta/valor en una caja destacada (ej. el equipo que vencio). */
  detalle?: { etiqueta: string; valor: string }[];
  boton?: { texto: string; url: string };
  /** Caja gris debajo del boton (ej. el link en texto, por si el boton no anda). */
  nota?: string;
  cierre?: string;
  firma: string;
  /** Aviso en rojo debajo de la card. */
  aviso?: string;
};

/** Escapa texto para meterlo en HTML (contenido y atributos). */
export function esc(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Solo se aceptan links http(s) y mailto en el boton: un `javascript:` en un
 * href es una inyeccion aunque el texto este escapado.
 */
export function urlSegura(url: string): string {
  return /^(https?:|mailto:)/i.test(url.trim()) ? url.trim() : "#";
}

export function renderEmail(c: ContenidoEmail): { html: string; text: string } {
  const peligro = c.tono === "peligro";
  const acento = peligro ? C.peligro : C.marca;
  const acentoSuave = peligro ? C.peligroSuave : C.marcaSuave;

  const parrafosHtml = c.parrafos
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font:14px/1.6 ${FUENTE};color:${C.texto};">${esc(p)}</p>`,
    )
    .join("");

  const detalleHtml = c.detalle?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;border:1px solid ${C.borde};border-radius:12px;border-collapse:separate;">
        ${c.detalle
          .map(
            (d, i) => `<tr>
            <td style="padding:11px 16px;${i ? `border-top:1px solid ${C.borde};` : ""}font:12px/1.4 ${FUENTE};color:${C.textoSuave};text-transform:uppercase;letter-spacing:.06em;font-weight:600;">${esc(d.etiqueta)}</td>
            <td align="right" style="padding:11px 16px;${i ? `border-top:1px solid ${C.borde};` : ""}font:14px/1.4 ${FUENTE};color:${C.texto};font-weight:600;">${esc(d.valor)}</td>
          </tr>`,
          )
          .join("")}
      </table>`
    : "";

  const botonHtml = c.boton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:10px auto 22px;">
        <tr><td align="center" bgcolor="${C.marca}" style="border-radius:10px;">
          <a href="${esc(urlSegura(c.boton.url))}" target="_blank" style="display:inline-block;padding:13px 34px;font:bold 15px/1.2 ${FUENTE};color:#ffffff;text-decoration:none;border-radius:10px;">${esc(c.boton.texto)}</a>
        </td></tr>
      </table>`
    : "";

  const notaHtml = c.nota
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr><td style="background:${C.cajaGris};border-radius:10px;padding:14px 16px;font:12px/1.5 ${FUENTE};color:${C.textoSuave};text-align:center;word-break:break-all;">${esc(c.nota)}</td></tr>
      </table>`
    : "";

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(c.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${C.fondo};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fondo};">
  <tr>
    <td align="center" bgcolor="${C.marca}" style="background:${C.marca};background-image:linear-gradient(160deg,${C.marca},${C.marcaOscura});padding:36px 20px 76px;">
      <img src="cid:${LOGO_CID}" width="${LOGO_ANCHO}" height="${LOGO_ALTO}" alt="${esc(APP_NAME)}" style="display:block;margin:0 auto 16px;border:0;">
      <div style="font:bold 24px/1.25 ${FUENTE};color:#ffffff;">${esc(c.encabezado)}</div>
      ${c.bajada ? `<div style="margin-top:6px;font:13px/1.4 ${FUENTE};color:#cfe8dd;">${esc(c.bajada)}</div>` : ""}
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:0 16px;">
      <!-- margin-top negativo: la card se monta sobre la franja. Outlook lo
           ignora y la deja apenas debajo, que tambien se ve bien. -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin-top:-48px;background:${C.card};border-radius:16px;box-shadow:0 6px 24px rgba(16,40,32,.08);">
        <tr>
          <td style="padding:32px 32px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 14px;">
              <tr><td align="center" width="56" height="56" style="width:56px;height:56px;border-radius:28px;background:${acentoSuave};font:bold 26px/56px ${FUENTE};color:${acento};text-align:center;">${esc(c.icono)}</td></tr>
            </table>
            <div style="margin:0 0 20px;font:bold 20px/1.3 ${FUENTE};color:${acento};text-align:center;">${esc(c.titulo)}</div>
            <p style="margin:0 0 14px;font:14px/1.6 ${FUENTE};color:${C.texto};">${esc(c.saludo)}</p>
            ${parrafosHtml}
            ${detalleHtml}
            ${botonHtml}
            ${notaHtml}
            ${c.cierre ? `<p style="margin:0 0 18px;font:14px/1.6 ${FUENTE};color:${C.texto};">${esc(c.cierre)}</p>` : ""}
            <p style="margin:0;font:14px/1.6 ${FUENTE};color:${C.texto};">Saludos,<br><strong>${esc(c.firma)}</strong></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:28px 20px 36px;">
      ${c.aviso ? `<p style="margin:0 0 14px;font:italic 12px/1.5 ${FUENTE};color:${C.peligro};">${esc(c.aviso)}</p>` : ""}
      <p style="margin:0;font:11px/1.6 ${FUENTE};color:#8a9892;">${esc(APP_NAME)} · CRM para equipamiento deportivo</p>
    </td>
  </tr>
</table>
</body>
</html>`;

  // Version en texto plano: mismo contenido, sin diseño.
  const text = [
    c.titulo.toUpperCase(),
    "",
    c.saludo,
    "",
    ...c.parrafos.flatMap((p) => [p, ""]),
    ...(c.detalle?.length ? [...c.detalle.map((d) => `${d.etiqueta}: ${d.valor}`), ""] : []),
    ...(c.boton ? [`${c.boton.texto}: ${c.boton.url}`, ""] : []),
    ...(c.cierre ? [c.cierre, ""] : []),
    "Saludos,",
    c.firma,
    ...(c.aviso ? ["", c.aviso] : []),
  ].join("\n");

  return { html, text };
}
