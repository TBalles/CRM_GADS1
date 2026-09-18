// Import relativo y con extension, a diferencia del resto del proyecto que usa
// "@/...". Motivo: este modulo se ejecuta tal cual con `node --test` desde
// plantillas.check.ts, y Node no lee los "paths" del tsconfig — un alias lo
// rompe con ERR_MODULE_NOT_FOUND. El precio de poder probarlo sin bundler.
import { APP_NAME } from "../../../lib/brand.ts";
import type { ContenidoEmail } from "../../../lib/email/layout.ts";

/**
 * Armado de los mensajes prearmados de recambio.
 *
 * Son funciones puras a proposito: reciben los datos de la alerta y devuelven
 * texto. Nada de estado, nada de red. Asi se pueden probar sin levantar nada
 * (ver plantillas.check.ts) y el mismo texto sirve para el mail y para
 * WhatsApp sin duplicar la redaccion.
 */

export type DatosAlerta = {
  empresaNombre: string;
  contactoNombre: string | null;
  productoNombre: string;
  cantidad: number;
  fechaEntrega: string | null;
  venceEl: string | null;
  diasRestantes: number | null;
};

/**
 * Lo minimo de una fila de `alertas_vida_util` que hace falta para armar el
 * mensaje. Es un tipo ESTRUCTURAL, no `Tables<"alertas_vida_util">`, a
 * proposito: importar el tipo generado traeria el alias "@/..." y este modulo
 * dejaria de poder correrse con `node --test`.
 */
export type FilaAlerta = {
  empresa_nombre: string | null;
  contacto_nombre: string | null;
  producto_nombre: string | null;
  cantidad: number | null;
  fecha_entrega: string | null;
  vence_el: string | null;
  dias_restantes: number | null;
};

/**
 * La vista devuelve todo nullable. Esta es la UNICA normalizacion: la usan el
 * servidor (para enviar y registrar) y el cliente (para el mailto y wa.me), asi
 * que el texto que ve el usuario y el que queda registrado son el mismo.
 */
export function desdeFila(a: FilaAlerta): DatosAlerta {
  return {
    empresaNombre: a.empresa_nombre ?? "el cliente",
    contactoNombre: a.contacto_nombre,
    productoNombre: a.producto_nombre ?? "el equipo",
    cantidad: a.cantidad ?? 1,
    fechaEntrega: a.fecha_entrega,
    venceEl: a.vence_el,
    diasRestantes: a.dias_restantes,
  };
}

/** dd/mm/aaaa desde un `date` de Postgres, sin pasar por Date (ni por zonas). */
export function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/**
 * El saludo apunta a la persona si la hay, y al club si no.
 * Se usa solo el nombre de pila: "Hola Juan Pérez," suena a carta de banco.
 */
export function saludo({ contactoNombre, empresaNombre }: DatosAlerta): string {
  const nombre = contactoNombre?.trim().split(/\s+/)[0];
  return nombre ? `Hola ${nombre},` : `Hola, equipo de ${empresaNombre}:`;
}

/**
 * La frase cambia segun si el equipo YA vencio o esta por vencer. Escribirle
 * "esta por cumplir su vida util" a alguien cuyo equipo vencio hace ocho meses
 * suena a que no miramos el dato antes de mandar.
 *
 * El verbo concuerda con la cantidad: "la unidad superó", "las 2 unidades
 * superaron". Un mail a un cliente con la concordancia rota se ve automatico.
 */
export function estadoEnPalabras({ venceEl, diasRestantes, cantidad }: DatosAlerta): string {
  const plural = cantidad !== 1;
  const v = (singular: string, pluralForma: string) => (plural ? pluralForma : singular);

  if (diasRestantes == null || venceEl == null) {
    return `${v("está", "están")} llegando al final de su vida útil`;
  }
  if (diasRestantes < 0) {
    const dias = Math.abs(diasRestantes);
    const hace =
      dias >= 60 ? `${Math.round(dias / 30)} meses` : `${dias} ${dias === 1 ? "día" : "días"}`;
    return `${v("superó", "superaron")} su vida útil estimada hace ${hace}`;
  }
  if (diasRestantes === 0) return `${v("cumple", "cumplen")} hoy su vida útil estimada`;
  return `${v("cumple", "cumplen")} su vida útil estimada en ${diasRestantes} ${
    diasRestantes === 1 ? "día" : "días"
  }`;
}

export function asunto(datos: DatosAlerta): string {
  return `${datos.productoNombre} — recambio sugerido | ${APP_NAME}`;
}

export function cuerpo(datos: DatosAlerta): string {
  const { productoNombre, cantidad, fechaEntrega, empresaNombre } = datos;
  const unidades = cantidad === 1 ? "la unidad" : `las ${cantidad} unidades`;

  return [
    saludo(datos),
    "",
    `Les escribimos de ${APP_NAME}. Según nuestro registro, ${unidades} de ${productoNombre} que entregamos a ${empresaNombre} el ${formatFecha(fechaEntrega)} ${estadoEnPalabras(datos)}.`,
    "",
    "Si quieren, coordinamos una revisión sin cargo para ver en qué estado está y, si hace falta, les pasamos presupuesto de recambio con la disponibilidad actual.",
    "",
    "¿Les sirve que los llamemos esta semana?",
    "",
    "Saludos,",
    `Equipo de ${APP_NAME}`,
  ].join("\n");
}

/** Versión corta para WhatsApp: el texto del mail queda larguísimo en el chat. */
export function cuerpoWhatsapp(datos: DatosAlerta): string {
  const { productoNombre, cantidad, fechaEntrega } = datos;
  const unidades = cantidad === 1 ? "la unidad" : `las ${cantidad} unidades`;

  return [
    saludo(datos),
    "",
    `Te escribimos de ${APP_NAME}. ${unidades.charAt(0).toUpperCase() + unidades.slice(1)} de ${productoNombre} que entregamos el ${formatFecha(fechaEntrega)} ${estadoEnPalabras(datos)}.`,
    "",
    `¿Coordinamos una revisión para ver si conviene ${cantidad === 1 ? "recambiarla" : "recambiarlas"}?`,
  ].join("\n");
}

/** "Vencido hace 12 días" / "Vence en 9 días", para la caja de detalle del mail. */
export function estadoCorto({ diasRestantes }: DatosAlerta): string {
  if (diasRestantes == null) return "Por vencer";
  if (diasRestantes < 0) {
    const d = Math.abs(diasRestantes);
    return `Vencido hace ${d} ${d === 1 ? "día" : "días"}`;
  }
  if (diasRestantes === 0) return "Vence hoy";
  return `Vence en ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"}`;
}

/**
 * Version HTML del mail de alerta, para renderEmail(). Mismo contenido que
 * `cuerpo()` (que sigue siendo el texto del mailto), organizado en bloques:
 * saludo, contexto, caja con el equipo y el estado, y el pedido.
 */
export function contenidoAlerta(
  datos: DatosAlerta,
  contacto?: { texto: string; url: string },
): ContenidoEmail {
  const { productoNombre, cantidad, fechaEntrega, empresaNombre, diasRestantes } = datos;
  const vencido = diasRestantes != null && diasRestantes < 0;
  const unidades = cantidad === 1 ? "La unidad" : `Las ${cantidad} unidades`;

  return {
    preheader: `${productoNombre}: ${estadoCorto(datos).toLowerCase()}. Te proponemos una revisión.`,
    encabezado: vencido ? "Es momento de recambiar" : "Se acerca el recambio",
    bajada: `${empresaNombre} · ${APP_NAME}`,
    icono: "↻",
    titulo: "Recambio sugerido",
    saludo: saludo(datos),
    parrafos: [
      `${unidades} de ${productoNombre} que les entregamos el ${formatFecha(fechaEntrega)} ${estadoEnPalabras(datos)}.`,
      `Si quieren, coordinamos una revisión sin cargo para ver en qué estado ${
        cantidad === 1 ? "está" : "están"
      } y, si hace falta, les pasamos presupuesto de recambio con la disponibilidad actual.`,
    ],
    detalle: [
      { etiqueta: "Equipo", valor: productoNombre },
      { etiqueta: "Cantidad", valor: String(cantidad) },
      { etiqueta: "Entregado", valor: formatFecha(fechaEntrega) },
      { etiqueta: "Estado", valor: estadoCorto(datos) },
    ],
    boton: contacto,
    cierre: "¿Les sirve que los llamemos esta semana? Pueden responder directamente este mail.",
    firma: `Equipo de ${APP_NAME}`,
  };
}

/** wa.me no acepta espacios, guiones ni `+` en el número. */
export function linkWhatsapp(telefono: string, mensaje: string): string {
  return `https://wa.me/${telefono.replace(/\D/g, "")}?text=${encodeURIComponent(mensaje)}`;
}

export function linkMailto(destinatario: string, asuntoTexto: string, mensaje: string): string {
  const params = new URLSearchParams({ subject: asuntoTexto, body: mensaje });
  // URLSearchParams codifica el espacio como "+", que en el cuerpo de un
  // mailto se ve literalmente como un signo más. %20 es lo correcto acá.
  return `mailto:${destinatario}?${params.toString().replace(/\+/g, "%20")}`;
}
