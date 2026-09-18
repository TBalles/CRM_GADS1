// Import relativo y con extension, a diferencia del resto del proyecto que usa
// "@/...". Motivo: este modulo se ejecuta tal cual con `node --test` desde
// plantillas.check.ts, y Node no lee los "paths" del tsconfig — un alias lo
// rompe con ERR_MODULE_NOT_FOUND. El precio de poder probarlo sin bundler.
import { APP_NAME } from "../../../lib/brand.ts";

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
 */
export function estadoEnPalabras({ venceEl, diasRestantes }: DatosAlerta): string {
  if (diasRestantes == null || venceEl == null) return "está llegando al final de su vida útil";
  if (diasRestantes < 0) {
    const dias = Math.abs(diasRestantes);
    return dias >= 60
      ? `superó su vida útil estimada hace ${Math.round(dias / 30)} meses`
      : `superó su vida útil estimada hace ${dias} ${dias === 1 ? "día" : "días"}`;
  }
  if (diasRestantes === 0) return "cumple hoy su vida útil estimada";
  return `cumple su vida útil estimada en ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"}`;
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
    "¿Coordinamos una revisión para ver si conviene recambiarlas?",
  ].join("\n");
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
