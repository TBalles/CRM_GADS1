/**
 * El contexto que se le manda a Claude (F7): un texto corto, armado con filas que el servidor ya leyó con la
 * sesión de la persona (la RLS manda) y con la menor cantidad de datos personales posible.
 *
 * Funciones puras: sin red, sin base, sin SDK. Se prueban con `node --test` (contexto.check.ts).
 *
 * QUÉ NO SALE NUNCA: mails, teléfonos, CUIT, documentos, direcciones, número de comprobante, nombres de
 * quienes cargan o responden, notas de la ficha: esos CAMPOS no se piden. De los contactos va solo el nombre de pila. Los textos
 * libres (títulos y detalles de actividades, nombres de productos y canchas) pasan por `limpiarTexto`, que INTENTA tachar mails,
 * enlaces, CUIT y números largos. No es infalible (nombres propios y direcciones en prosa pasan): no se promete más que eso.
 *
 * Imports relativos con extensión: Node no lee los "paths" del tsconfig.
 */
import { formatFecha } from "../clientes.ts";
import { agruparParque, textoVidaUtil, type ItemParque } from "../parque.ts";
import { resumenCuenta, textoContacto } from "../timeline360.ts";

/* ------------------------------------------------------------------------ */
/* Limpieza de texto libre                                                   */
/* ------------------------------------------------------------------------ */

/** Mails escritos para esquivar filtros: `juan[at]club`, `juan (at) club.com`, `juan [arroba] club`. */
const EMAIL_AT = /[\w.+-]+\s*[[(]\s*(?:at|arroba)\s*[\])]\s*[\w.-]+/gi;
/** Mail con arroba, con o sin punto en el dominio (`juan@club`). */
const EMAIL = /[^\s@<>()[\]]+@[^\s@<>()[\]]+/g;
/** Usuario de red social (`@club_norte`): no es un mail pero identifica a alguien. */
const USUARIO = /(^|[\s(,;:])@\w{2,}/g;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
/**
 * Dominios sueltos y acortadores (`bit.ly/x`, `club.com.ar/pago`, `wa.me/54911…`), con su ruta si la hay. Solo con un TLD de la
 * lista: un punto cualquiera ("Sr.Pérez", "N°5.Pelota") no es un enlace.
 */
const DOMINIO =
  /\b(?:[a-z0-9-]+\.)+(?:com|net|org|edu|gov|ar|io|co|me|ly|gl|gd|app|info|biz|us|es|br|cl|uy|py|bo|pe|mx|xyz|link|site|online|page|shop)\b(?:\/\S*)?/gi;
const CUIT = /\b\d{2}[-.\s]?\d{7,8}[-.\s]?\d\b/g;
/**
 * Dos cosas con forma de número, en este orden: una fecha con separadores (que se valida aparte) y una corrida de dígitos con los
 * separadores típicos de teléfonos y documentos (`+54 9 11 4567-8901`, `30.123.456`, `11/4567/8901`).
 */
const NUMEROS = /\b\d{1,4}([/.-])\d{1,2}\1\d{1,4}\b|\+?\d[\d\s().\/-]{5,}\d/g;
const FORMA_FECHA = /^(\d{1,4})([/.-])(\d{1,2})\2(\d{1,4})$/;

/** Cuántos dígitos tiene una corrida (para decidir si es un teléfono o un documento y no una fecha o una cantidad). */
const digitos = (s: string) => s.replace(/\D/g, "").length;

/**
 * Una fecha de verdad: dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa o aaaa-mm-dd (con `/` o `.`), con día 1 a 31, mes 1 a 12 y año 1900 a 2100.
 * `11.45.6789` o `1145.67.8901` (formas de teléfono) no lo son.
 */
export function esFechaReal(s: string): boolean {
  const m = FORMA_FECHA.exec(s);
  if (!m) return false;
  const [, a, , b, c] = m;
  const entre = (v: string, min: number, max: number) => Number(v) >= min && Number(v) <= max;
  if (a.length === 4) return entre(a, 1900, 2100) && entre(b, 1, 12) && c.length <= 2 && entre(c, 1, 31);
  if (c.length === 4) return a.length <= 2 && entre(a, 1, 31) && entre(b, 1, 12) && entre(c, 1900, 2100);
  return false;
}

/**
 * Texto libre -> texto para mandar: una sola línea, con tope y SIN `<` ni `>` (un texto no puede cerrar el bloque <DATOS>).
 * Intenta tachar mails (con arroba, sin punto o escritos `[at]`), usuarios `@algo`, enlaces y dominios sueltos, CUIT y números de
 * 7 o más dígitos que no sean una fecha real. NO es infalible: no reconoce nombres propios, direcciones escritas en prosa ni un
 * mail deletreado con palabras ("juan arroba club punto com").
 */
export function limpiarTexto(texto: string | null | undefined, max = 200): string {
  if (!texto) return "";
  let t = texto
    .replace(/[<>]/g, " ")
    .replace(EMAIL_AT, "[mail omitido]")
    .replace(EMAIL, "[mail omitido]")
    .replace(USUARIO, "$1[usuario omitido]")
    .replace(URL_RE, "[enlace omitido]")
    .replace(DOMINIO, "[enlace omitido]")
    .replace(CUIT, "[CUIT omitido]")
    .replace(NUMEROS, (m) => (esFechaReal(m) || digitos(m) < 7 ? m : "[número omitido]"))
    .replace(/\s+/g, " ")
    .trim();
  if (t.length > max) t = `${t.slice(0, max - 1).trimEnd()}…`;
  return t;
}

/** Solo el nombre de pila ("Juan Pérez" -> "Juan"), limpio. Vacío si no hay. */
export function primerNombre(nombre: string | null | undefined): string {
  return limpiarTexto(nombre?.trim().split(/\s+/)[0] ?? "", 40);
}

/** Tope del texto completo que se manda (en caracteres). Lo que sobre se corta y se avisa. */
export const MAX_CONTEXTO = 6000;

function cerrar(lineas: string[]): string {
  const texto = lineas.join("\n");
  if (texto.length <= MAX_CONTEXTO) return texto;
  return `${texto.slice(0, MAX_CONTEXTO - 40).trimEnd()}\n[…contexto recortado por largo]`;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/* ------------------------------------------------------------------------ */
/* Aviso de recambio                                                         */
/* ------------------------------------------------------------------------ */

export type EntradaAviso = {
  hoy: string;
  /** "Equipo de Tuco & Nito": cómo firma quien escribe. */
  firma: string;
  /** Alerta (fila de `alertas_vida_util`): lo mínimo que hace falta. */
  alerta: {
    empresa_nombre: string | null;
    contacto_nombre: string | null;
    producto_nombre: string | null;
    cantidad: number | null;
    fecha_entrega: string | null;
    vida_util_meses: number | null;
    vence_el: string | null;
    dias_restantes: number | null;
  };
  /** Ventas de la cuenta (las más recientes), con lo comprado. */
  ventas: readonly { fecha: string; items: readonly { cantidad: number; producto: { nombre: string } | null }[] }[];
  /** Avisos ya enviados por este equipo. */
  avisos: readonly { canal: string; enviado_at: string }[];
  /** Canchas de la empresa; vacío si no hay o la base no tiene la tabla. */
  canchas: readonly CanchaIA[];
};

export type CanchaIA = { nombre: string; formato: string; cantidad: number; superficie: string | null; activa: boolean };

export function estadoVidaUtil(dias: number | null): string {
  if (dias == null) return "está llegando al final de su vida útil";
  if (dias < 0) return `ya venció hace ${plural(Math.abs(dias), "día", "días")}`;
  if (dias === 0) return "vence hoy";
  return `vence en ${plural(dias, "día", "días")}`;
}

function lineaCanchas(canchas: readonly CanchaIA[]): string | null {
  const activas = canchas.filter((c) => c.activa).slice(0, 8);
  if (!activas.length) return null;
  return activas
    .map((c) => `${c.cantidad} × ${limpiarTexto(c.formato, 20)}${c.superficie ? ` (${limpiarTexto(c.superficie, 20)})` : ""}`)
    .join(", ");
}

const NOMBRE_CANAL: Record<string, string> = { email: "mail", whatsapp: "WhatsApp" };

export function contextoAviso(e: EntradaAviso): string {
  const a = e.alerta;
  const nombre = primerNombre(a.contacto_nombre);
  const club = limpiarTexto(a.empresa_nombre, 80);
  const saludo = nombre ? `Hola ${nombre},` : club ? `Hola, equipo de ${club}:` : "Hola:";
  const unidades = a.cantidad ?? 1;
  const equipo = limpiarTexto(a.producto_nombre, 100) || "el equipo";

  const lineas = [
    `Hoy: ${formatFecha(e.hoy)}`,
    `Saludo a usar: ${saludo}`,
    `Firma a usar: ${limpiarTexto(e.firma, 60)}`,
    club ? `Cliente: ${club}` : "Cliente: persona individual (sin club cargado)",
    `Equipo entregado: ${unidades} × ${equipo}`,
    a.fecha_entrega ? `Fecha de entrega: ${formatFecha(a.fecha_entrega)}` : "Fecha de entrega: no figura",
    a.vida_util_meses ? `Vida útil estimada del catálogo: ${plural(a.vida_util_meses, "mes", "meses")}` : null,
    a.vence_el ? `Fecha en que cumple su vida útil: ${formatFecha(a.vence_el)}` : null,
    `Estado hoy: ${estadoVidaUtil(a.dias_restantes)}`,
  ];

  if (e.ventas.length) {
    const ultima = e.ventas.map((v) => v.fecha.slice(0, 10)).sort().at(-1)!;
    lineas.push(`Compras registradas con nosotros: ${e.ventas.length}${e.ventas.length >= 50 ? " o más" : ""}; la última, el ${formatFecha(ultima)}`);
    const distintos = [...new Set(e.ventas.flatMap((v) => v.items.map((i) => limpiarTexto(i.producto?.nombre, 60))).filter(Boolean))].slice(0, 6);
    if (distintos.length) lineas.push(`Lo que nos compró antes (algunos productos): ${distintos.join("; ")}`);
  } else {
    lineas.push("Compras registradas con nosotros: sin datos");
  }

  const canchas = lineaCanchas(e.canchas);
  if (canchas) lineas.push(`Canchas del cliente: ${canchas}`);

  if (e.avisos.length) {
    const orden = [...e.avisos].sort((x, y) => y.enviado_at.localeCompare(x.enviado_at)).slice(0, 3);
    lineas.push(
      `Avisos anteriores por este equipo: ${orden
        .map((v) => `${NOMBRE_CANAL[v.canal] ?? "otro canal"} el ${formatFecha(v.enviado_at.slice(0, 10))}`)
        .join("; ")}`,
    );
  } else {
    lineas.push("Avisos anteriores por este equipo: ninguno");
  }

  return cerrar(lineas.filter((l): l is string => l !== null));
}

/* ------------------------------------------------------------------------ */
/* Resumen de la cuenta                                                      */
/* ------------------------------------------------------------------------ */

/** Cuántos de cada cosa viajan como máximo. */
export const TOPES_RESUMEN = { actividades: 15, oportunidades: 10, compras: 8, avisos: 5, equipos: 12 } as const;

type Venta = {
  fecha: string;
  total: number;
  items: readonly {
    id: string;
    cantidad: number;
    fecha_entrega: string | null;
    vida_util_meses: number | null;
    producto: { nombre: string; categoria: string | null } | null;
  }[];
};
type Op = { titulo: string; monto: number | string | null; estado: string; etapa_id: string };
type Act = { ocurrido_en: string; tipo: string; titulo: string; detalle: string | null; resultado: string | null };
type Aviso = { enviado_at: string; canal: string; producto: string };

export type EntradaResumen = {
  hoy: string;
  /** Empresa o contacto. */
  tipo: "empresa" | "contacto";
  /** Nombre del club/empresa, o nombre de pila del contacto. */
  nombre: string;
  /** Solo contactos: su cargo y el nombre de su empresa. */
  cargo?: string | null;
  empresa?: string | null;
  estado: string | null;
  tipoCliente?: string | null;
  /** `null` = el rol no puede ver esa parte: no se manda y se avisa que no se incluye. */
  ventas: readonly Venta[] | null;
  oportunidades: readonly Op[] | null;
  actividades: readonly Act[] | null;
  avisos: readonly Aviso[] | null;
  etapas: readonly { id: string; nombre: string }[];
  primeraCompra: string | null;
  canchas: readonly CanchaIA[];
  truncado: boolean;
};

export function contextoResumen(e: EntradaResumen): string {
  const nombre = limpiarTexto(e.nombre, 80);
  const lineas: string[] = [`Hoy: ${formatFecha(e.hoy)}`];

  if (e.tipo === "empresa") {
    lineas.push(`Cuenta: ${nombre} (empresa o club${e.tipoCliente ? `, tipo ${limpiarTexto(e.tipoCliente, 30)}` : ""})`);
  } else {
    const donde = e.empresa ? ` de ${limpiarTexto(e.empresa, 80)}` : ", cliente individual";
    lineas.push(`Cuenta: ${nombre} (contacto${e.cargo ? `, ${limpiarTexto(e.cargo, 40)}` : ""}${donde})`);
  }
  if (e.estado) lineas.push(`Estado comercial: ${limpiarTexto(e.estado, 30)}`);

  const noIncluido = [
    e.ventas === null && "compras y equipamiento",
    e.oportunidades === null && "oportunidades",
    e.actividades === null && "actividades",
    e.avisos === null && "avisos de recambio",
  ].filter(Boolean) as string[];
  if (noIncluido.length) lineas.push(`NO se incluye (el rol no lo puede ver, es desconocido): ${noIncluido.join(", ")}`);

  const resumen = resumenCuenta({
    ventas: (e.ventas ?? []).map((v) => ({ fecha: v.fecha, total: v.total })),
    oportunidades: (e.oportunidades ?? []).map((o) => ({ estado: o.estado, monto: o.monto })),
    actividades: e.actividades ? e.actividades.map((a) => ({ ocurrido_en: a.ocurrido_en })) : null,
    hoy: e.hoy,
    primeraCompra: e.primeraCompra,
  });

  if (e.ventas) {
    lineas.push(
      resumen.cantidadCompras
        ? `Compras: ${resumen.cantidadCompras}${e.truncado ? " (las más recientes)" : ""}; primera ${resumen.primeraCompra ? formatFecha(resumen.primeraCompra) : "sin datos"}, última ${resumen.ultimaCompra ? formatFecha(resumen.ultimaCompra) : "sin datos"}; total comprado $${Math.round(resumen.totalComprado)}`
        : "Compras: todavía no compró",
    );
  }
  if (e.oportunidades) {
    lineas.push(
      `Oportunidades abiertas: ${resumen.abiertas.cantidad}${resumen.abiertas.valor > 0 ? `, por $${Math.round(resumen.abiertas.valor)} en total` : ""}`,
    );
  }
  if (e.actividades) {
    lineas.push(`Último contacto registrado: ${resumen.ultimoContacto ? `${formatFecha(resumen.ultimoContacto)} (${textoContacto(resumen.diasDesdeContacto, resumen.tonoContacto)})` : "ninguno"}`);
  }

  // Parque instalado, a partir de lo entregado en las ventas leídas.
  if (e.ventas) {
    const items: ItemParque[] = e.ventas.flatMap((v) =>
      v.items.map((i) => ({
        id: i.id,
        producto: limpiarTexto(i.producto?.nombre, 70) || "Producto sin nombre",
        categoria: i.producto?.categoria ?? null,
        cantidad: i.cantidad,
        fechaEntrega: i.fecha_entrega,
        vidaUtilMeses: i.vida_util_meses,
      })),
    );
    const grupos = agruparParque(items, e.hoy);
    if (grupos.length) {
      lineas.push("Equipamiento entregado (parque instalado):");
      let restantes: number = TOPES_RESUMEN.equipos;
      for (const g of grupos) {
        if (restantes <= 0) break;
        const filas = g.filas.slice(0, restantes);
        restantes -= filas.length;
        lineas.push(
          `- ${g.titulo}: ${filas.map((f) => `${f.cantidad} × ${f.producto} (${textoVidaUtil(f).toLowerCase()})`).join("; ")}${filas.length < g.filas.length ? "; y más" : ""}`,
        );
      }
    }
  }

  const canchas = lineaCanchas(e.canchas);
  if (canchas) lineas.push(`Canchas cargadas: ${canchas}`);

  if (e.oportunidades?.length) {
    const etapa = new Map(e.etapas.map((x) => [x.id, x.nombre]));
    lineas.push("Oportunidades (las más recientes):");
    for (const o of e.oportunidades.slice(0, TOPES_RESUMEN.oportunidades)) {
      lineas.push(
        `- ${limpiarTexto(o.titulo, 90)} | ${o.estado}${etapa.get(o.etapa_id) ? ` | etapa ${limpiarTexto(etapa.get(o.etapa_id), 40)}` : ""}${o.monto ? ` | $${Math.round(Number(o.monto))}` : ""}`,
      );
    }
  }

  if (e.actividades?.length) {
    lineas.push("Actividades recientes (de la más nueva a la más vieja):");
    for (const a of e.actividades.slice(0, TOPES_RESUMEN.actividades)) {
      const dia = a.ocurrido_en.slice(0, 10);
      const detalle = limpiarTexto(a.detalle, 160);
      const resultado = limpiarTexto(a.resultado, 80);
      lineas.push(
        `- ${formatFecha(dia)} | ${limpiarTexto(a.tipo, 30)} | ${limpiarTexto(a.titulo, 100)}${detalle ? `: ${detalle}` : ""}${resultado ? ` -> resultado: ${resultado}` : ""}`,
      );
    }
  }

  if (e.ventas?.length) {
    lineas.push("Compras recientes:");
    for (const v of e.ventas.slice(0, TOPES_RESUMEN.compras)) {
      const cosas = v.items.slice(0, 4).map((i) => `${i.cantidad} × ${limpiarTexto(i.producto?.nombre, 50) || "producto"}`);
      lineas.push(`- ${formatFecha(v.fecha)}: ${cosas.join(", ")}${v.items.length > 4 ? " y más" : ""}`);
    }
  }

  if (e.avisos?.length) {
    lineas.push("Avisos de recambio ya enviados:");
    for (const a of e.avisos.slice(0, TOPES_RESUMEN.avisos)) {
      lineas.push(`- ${formatFecha(a.enviado_at.slice(0, 10))} por ${NOMBRE_CANAL[a.canal] ?? "otro canal"}: ${limpiarTexto(a.producto, 60)}`);
    }
  }

  if (e.truncado) lineas.push("Aviso: el CRM leyó solo los registros más recientes de esta cuenta; lo anterior no figura.");
  return cerrar(lineas);
}
