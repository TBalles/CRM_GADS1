/**
 * Presupuesto imprimible (F6): las cuentas y las reglas, puras y sin dependencias de React ni de la
 * base. Se prueban con `node --test src/lib/presupuesto.check.ts`.
 *
 * Todo el dinero se calcula en CENTAVOS ENTEROS y recien al final vuelve a pesos: sumar flotantes
 * (0,1 + 0,2) o redondear 1,005 con `toFixed` da centavos de mas o de menos en un documento que se
 * imprime y se firma.
 *
 * Reglas (las mismas que `docs/reglas-de-negocio.md`):
 *  - Importe de una linea = cantidad x precio unitario (redondeado a centavos) - descuento % de esa linea.
 *    Cada paso redondea al centavo "medio hacia arriba".
 *  - Si el proveedor es **Responsable Inscripto** los precios son NETOS: se discrimina IVA 21 % sobre el
 *    neto y el total lo incluye. Con cualquier otra condicion (Monotributo, Exento o sin cargar) no se
 *    discrimina nada: el total es el neto y una leyenda lo aclara.
 *  - El numero es correlativo por organizacion y se imprime `N° 000042`.
 */
import { maskFromNumber } from "./money.ts";
import { esFechaValida } from "./oportunidades.ts";

/**
 * Foto del emisor al emitir (`presupuestos.emisor`, junto con `condicion_iva`): razon social, CUIT, direccion,
 * telefono, mail y web. NO incluye el logo (se lee de la organizacion y puede cambiar). Reimprimir un presupuesto
 * emitido usa esta foto, asi un cambio posterior de condicion frente al IVA o de domicilio no altera lo ya emitido.
 */
export type Emisor = {
  razon_social: string | null;
  cuit: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  sitio_web: string | null;
};

const textoONull = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** Arma la foto desde los datos vivos de la organizacion. Sin razon social se usa el nombre de la organizacion. */
export function emisorDesdeOrganizacion(org: {
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  sitio_web: string | null;
}): Emisor {
  return {
    razon_social: textoONull(org.razon_social) ?? textoONull(org.nombre),
    cuit: textoONull(org.cuit),
    direccion: textoONull(org.direccion),
    telefono: textoONull(org.telefono),
    email: textoONull(org.email),
    sitio_web: textoONull(org.sitio_web),
  };
}

/** Lee `presupuestos.emisor` (jsonb: puede venir vacio o roto): solo los campos conocidos y como texto. */
export function emisorDesdeJson(json: unknown): Emisor {
  const o = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  return {
    razon_social: textoONull(o.razon_social),
    cuit: textoONull(o.cuit),
    direccion: textoONull(o.direccion),
    telefono: textoONull(o.telefono),
    email: textoONull(o.email),
    sitio_web: textoONull(o.sitio_web),
  };
}

/** Una linea del presupuesto, tal como se guarda en `presupuestos.lineas` (jsonb). */
export type LineaPresupuesto = {
  producto_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento_pct: number;
};

export type CondicionIva = "responsable_inscripto" | "monotributo" | "exento";

/** Alicuota general. Las reducidas (10,5 %) no se manejan: el rubro vende todo al 21 %. */
export const IVA_PORCENTAJE = 21;

/** Topes razonables (y que entren en `numeric(14,2)` de `presupuestos.total`). */
export const MAX_LINEAS = 200;
const MAX_CANTIDAD = 1_000_000;
const MAX_PRECIO = 1_000_000_000;
export const MAX_TOTAL = 99_999_999_999.99;

/** Redondeo al centavo "medio hacia arriba" sin los errores binarios de `Math.round(x * 100)` (1,005 -> 1,01). */
export function aCentavos(pesos: number): number {
  if (!Number.isFinite(pesos)) return 0;
  return Math.round(Number((pesos * 100).toPrecision(12)));
}

const aPesos = (centavos: number) => centavos / 100;

export type ImporteLinea = { brutoC: number; descuentoC: number; netoC: number };

/** Importe de una linea, en centavos. */
export function importeLinea(l: Pick<LineaPresupuesto, "cantidad" | "precio_unitario" | "descuento_pct">): ImporteLinea {
  const precioC = aCentavos(l.precio_unitario);
  const brutoC = Math.round(Number((l.cantidad * precioC).toPrecision(12)));
  const descuentoC = Math.round(Number(((brutoC * l.descuento_pct) / 100).toPrecision(12)));
  return { brutoC, descuentoC, netoC: brutoC - descuentoC };
}

/** `true` solo para el Responsable Inscripto: es el unico que discrimina IVA en su presupuesto. */
export function discriminaIva(condicion: string | null | undefined): boolean {
  return condicion === "responsable_inscripto";
}

export type TotalesPresupuesto = {
  /** Suma de cantidad x precio, antes de descuentos. */
  subtotal: number;
  /** Suma de los descuentos de las lineas (positivo). */
  descuento: number;
  /** Subtotal menos descuentos. Sin IVA. */
  neto: number;
  discrimina: boolean;
  /** 0 cuando no se discrimina. */
  iva: number;
  /** Lo que paga el cliente: neto + IVA si se discrimina, el neto si no. */
  total: number;
};

export function calcularTotales(
  lineas: Pick<LineaPresupuesto, "cantidad" | "precio_unitario" | "descuento_pct">[],
  condicionIva: string | null | undefined,
): TotalesPresupuesto {
  let brutoC = 0;
  let descuentoC = 0;
  for (const l of lineas) {
    const i = importeLinea(l);
    brutoC += i.brutoC;
    descuentoC += i.descuentoC;
  }
  const netoC = brutoC - descuentoC;
  const discrimina = discriminaIva(condicionIva);
  const ivaC = discrimina ? Math.round((netoC * IVA_PORCENTAJE) / 100) : 0;
  return {
    subtotal: aPesos(brutoC),
    descuento: aPesos(descuentoC),
    neto: aPesos(netoC),
    discrimina,
    iva: aPesos(ivaC),
    total: aPesos(netoC + ivaC),
  };
}

/** Como se escribe la condicion del proveedor en el encabezado. Sin condicion cargada, `null`. */
export function etiquetaCondicionIva(condicion: string | null | undefined): string | null {
  switch (condicion) {
    case "responsable_inscripto":
      return "IVA Responsable Inscripto";
    case "monotributo":
      return "Monotributo";
    case "exento":
      return "IVA Exento";
    default:
      return null;
  }
}

/** Leyenda de IVA que va debajo de los totales. */
export function leyendaIva(condicion: string | null | undefined): string {
  switch (condicion) {
    case "responsable_inscripto":
      return `Precios en pesos argentinos, netos de IVA. Se discrimina IVA ${IVA_PORCENTAJE} %.`;
    case "monotributo":
      return "Precios en pesos argentinos. Emisor Monotributista: no se discrimina IVA.";
    case "exento":
      return "Precios en pesos argentinos. Emisor exento de IVA.";
    default:
      return "Precios en pesos argentinos. IVA según condición.";
  }
}

/** `$1.234,56` (siempre con centavos: en un presupuesto no se redondea a pesos). */
export function formatPesos(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${maskFromNumber(n)}`;
}

/** Cantidad sin ceros de mas: `2`, `2,5`. Hasta 3 decimales. */
export function formatCantidad(n: number): string {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n);
}

/** `42` -> `N° 000042`. Sin numero (borrador o base sin la 0012) -> `Borrador`. */
export function formatearNumero(numero: number | null | undefined): string {
  if (numero == null || !Number.isInteger(numero) || numero < 1) return "Borrador";
  return `N° ${String(numero).padStart(6, "0")}`;
}

/** Suma `dias` a una fecha `aaaa-mm-dd` sin pasar por la zona horaria (la aritmetica es en UTC puro). */
export function sumarDias(ymd: string, dias: number): string {
  if (!esFechaValida(ymd) || !Number.isInteger(dias)) return ymd;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Ultimo dia de validez: la fecha de emision cuenta como el dia 0 ("15 dias" desde el 01/10 vence el 16/10). */
export function fechaVencimiento(fecha: string, validezDias: number): string {
  return sumarDias(fecha, validezDias);
}

/** Entero de dias de validez (1 a 365, igual que el CHECK de la base). */
export function validezValida(dias: number): boolean {
  return Number.isInteger(dias) && dias >= 1 && dias <= 365;
}

export type ErrorLinea = { indice: number; campo: "descripcion" | "cantidad" | "precio_unitario" | "descuento_pct"; mensaje: string };

/** Valida las lineas ANTES de guardar. Devuelve un error por campo, con el indice de la linea. */
export function validarLineas(lineas: LineaPresupuesto[]): ErrorLinea[] {
  const errores: ErrorLinea[] = [];
  lineas.forEach((l, indice) => {
    if (!l.descripcion.trim()) errores.push({ indice, campo: "descripcion", mensaje: "Escribí qué se presupuesta." });
    if (!(l.cantidad > 0) || l.cantidad > MAX_CANTIDAD) {
      errores.push({ indice, campo: "cantidad", mensaje: "La cantidad tiene que ser mayor que 0." });
    }
    if (!(l.precio_unitario >= 0) || l.precio_unitario > MAX_PRECIO) {
      errores.push({ indice, campo: "precio_unitario", mensaje: "El precio no puede ser negativo." });
    }
    if (!(l.descuento_pct >= 0 && l.descuento_pct <= 100)) {
      errores.push({ indice, campo: "descuento_pct", mensaje: "El descuento va de 0 a 100 %." });
    }
  });
  return errores;
}

/** Mensaje general si el documento no se puede guardar, o `null`. */
export function problemaDelDocumento(lineas: LineaPresupuesto[], total: number): string | null {
  if (lineas.length === 0) return "Agregá al menos una línea.";
  if (lineas.length > MAX_LINEAS) return `El presupuesto admite hasta ${MAX_LINEAS} líneas.`;
  if (total > MAX_TOTAL) return "El total es demasiado grande para guardarlo.";
  return null;
}

const numero = (v: unknown, porDefecto: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : porDefecto;
};

/**
 * Lee `presupuestos.lineas` (jsonb: puede venir roto si alguien escribio a mano) a lineas validas.
 * Lo que no es un objeto se descarta; los numeros ilegibles quedan en 0 (cantidad en 1).
 */
export function lineasDesdeJson(json: unknown): LineaPresupuesto[] {
  if (!Array.isArray(json)) return [];
  const salida: LineaPresupuesto[] = [];
  for (const crudo of json) {
    if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) continue;
    const o = crudo as Record<string, unknown>;
    salida.push({
      producto_id: typeof o.producto_id === "string" && o.producto_id ? o.producto_id : null,
      descripcion: typeof o.descripcion === "string" ? o.descripcion : "",
      cantidad: numero(o.cantidad, 1),
      precio_unitario: numero(o.precio_unitario, 0),
      descuento_pct: numero(o.descuento_pct, 0),
    });
  }
  return salida;
}

/** Lo que se manda a la columna jsonb: solo los campos conocidos, descripcion sin espacios de mas. */
export function lineasParaGuardar(lineas: LineaPresupuesto[]): LineaPresupuesto[] {
  return lineas.map((l) => ({
    producto_id: l.producto_id,
    descripcion: l.descripcion.trim(),
    cantidad: l.cantidad,
    precio_unitario: aPesos(aCentavos(l.precio_unitario)),
    descuento_pct: l.descuento_pct,
  }));
}

/** Titulo de la actividad que se registra al imprimir un presupuesto guardado. */
export function tituloActividad(numero: number, oportunidad: string): string {
  return `Envío de presupuesto ${formatearNumero(numero)}: ${oportunidad}`.slice(0, 200);
}
