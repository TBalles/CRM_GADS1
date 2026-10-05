/**
 * Vocabulario y reglas puras de las oportunidades: estados, que etapas sirven
 * para cada accion, validaciones del formulario de cierre, la linea de tiempo
 * unificada y la traduccion de los errores de la base a palabras.
 *
 * Las reglas de verdad viven en la base (trigger `oportunidades_reglas`, CHECK,
 * RLS); esto solo las pone en palabras y evita pedirle a la base algo que sabemos
 * que va a rechazar.
 *
 * Imports relativos con extension o ninguno: este modulo se prueba con
 * `node --test` (oportunidades.check.ts).
 */
import { formatFecha } from "./clientes.ts";
import { formatMoney } from "./money.ts";

/** Los tres estados del CHECK `oportunidades_estado_check`. El estado SALE del tipo de la etapa. */
export const ESTADOS_OPORTUNIDAD = [
  { value: "abierta", label: "Abierta", tono: "azul" },
  { value: "ganada", label: "Ganada", tono: "verde" },
  { value: "perdida", label: "Perdida", tono: "rojo" },
] as const;

export type EstadoOportunidad = (typeof ESTADOS_OPORTUNIDAD)[number]["value"];

export function estadoOportunidadInfo(valor: string) {
  return ESTADOS_OPORTUNIDAD.find((e) => e.value === valor) ?? { value: valor, label: valor, tono: "gris" as const };
}

/**
 * Si el nombre de la etapa repite lo que ya dice el estado: una etapa de cierre que se llama como el estado ("Perdida"
 * con estado perdida). Ahí la pantalla muestra solo el estado; si la etapa de cierre tiene otro nombre ("Entregado"),
 * se muestran los dos (dicen cosas distintas). Sin distinguir mayúsculas ni acentos.
 */
export function etapaRepiteEstado(etapa: { nombre: string; tipo: string } | null | undefined, estado: string): boolean {
  if (!etapa || etapa.tipo === "abierta" || estado === "abierta") return false;
  const plano = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return plano(etapa.nombre) === plano(estadoOportunidadInfo(estado).label);
}

/** El título del aviso de una oportunidad cerrada: "Perdida el 04/10/2026." (E2E lo busca así) o "Ganada." sin fecha. */
export function textoCerrada(estado: string, fechaCierre: string | null): string {
  return `${estadoOportunidadInfo(estado).label}${fechaCierre ? ` el ${formatFecha(fechaCierre)}` : ""}.`;
}

export function etiquetaTipoOportunidad(valor: string): string {
  return valor === "licitacion" ? "Licitación" : "Directa";
}

export type EtapaBasica = { id: string; nombre: string; tipo: string; orden: number };

function porOrden<T extends { orden: number; nombre: string }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
}

/** Las columnas del tablero: etapas abiertas, en el orden configurado. */
export function etapasAbiertas<T extends EtapaBasica>(etapas: readonly T[]): T[] {
  return porOrden(etapas.filter((e) => e.tipo === "abierta"));
}

/** Etapas a las que se puede cerrar: las de tipo ganada o perdida. Si hay varias, la persona elige. */
export function etapasDeCierre<T extends EtapaBasica>(etapas: readonly T[], tipo: "ganada" | "perdida"): T[] {
  return porOrden(etapas.filter((e) => e.tipo === tipo));
}

/**
 * "etapa" = mover entre abiertas; "ganada"/"perdida" = cerrar; "reabrir" = volver a una abierta;
 * "resultado" = cambiar una cerrada al resultado contrario (ganada a perdida o al revés) sin reabrirla.
 */
export type ModoCambio = "etapa" | "ganada" | "perdida" | "reabrir" | "resultado";

/** El tipo de cierre contrario: una ganada pasa a perdida y una perdida a ganada. */
export function resultadoContrario(estado: string): "ganada" | "perdida" {
  return estado === "ganada" ? "perdida" : "ganada";
}

/**
 * Etapas validas como destino de cada modo. En "etapa" se excluye la actual: moverla a donde ya esta no hace nada.
 * En "resultado" son las del cierre contrario al `estado` actual.
 */
export function etapasParaModo<T extends EtapaBasica>(
  etapas: readonly T[],
  modo: ModoCambio,
  etapaActualId?: string,
  estado?: string,
): T[] {
  if (modo === "ganada" || modo === "perdida") return etapasDeCierre(etapas, modo);
  if (modo === "resultado") return estado ? etapasDeCierre(etapas, resultadoContrario(estado)) : [];
  const abiertas = etapasAbiertas(etapas);
  return modo === "etapa" ? abiertas.filter((e) => e.id !== etapaActualId) : abiertas;
}

/**
 * Que acciones de cambio se ofrecen. Abierta: mover o cerrar (con `oportunidades.editar`).
 * Cerrada: reabrir o cambiar el resultado, y solo con `oportunidades.reabrir` (la base pide
 * ese permiso para las dos). Esto evita ofrecer un boton que va a fallar.
 */
export function accionesDisponibles(
  estado: string,
  permisos: { puedeEditar: boolean; puedeReabrir: boolean },
): ModoCambio[] {
  if (!permisos.puedeEditar) return [];
  if (estado === "abierta") return ["etapa", "ganada", "perdida"];
  return permisos.puedeReabrir ? ["reabrir", "resultado"] : [];
}

/** Nombre de cada acción de cambio en menús y botones (contrato de E2E: "Cambiar etapa", "Marcar perdida"). */
export const ETIQUETA_CAMBIO: Record<ModoCambio, string> = {
  etapa: "Cambiar etapa",
  ganada: "Marcar ganada",
  perdida: "Marcar perdida",
  reabrir: "Reabrir",
  resultado: "Cambiar resultado",
};

/** Título (nombre accesible del diálogo: "Cambiar de etapa", "Marcar como perdida"), botón y bajada de cada acción. */
export const COPY_CAMBIO: Record<ModoCambio, { titulo: string; confirmar: string; bajada: string }> = {
  etapa: { titulo: "Cambiar de etapa", confirmar: "Mover", bajada: "Queda en el historial con tu usuario y la fecha." },
  ganada: {
    titulo: "Marcar como ganada",
    confirmar: "Marcar ganada",
    bajada: "La oportunidad se cierra con la fecha que indiques. Cualquier cambio posterior queda auditado.",
  },
  perdida: {
    titulo: "Marcar como perdida",
    confirmar: "Marcar perdida",
    bajada: "Una oportunidad no se borra: se cierra con su motivo para aprender de la pérdida.",
  },
  reabrir: { titulo: "Reabrir oportunidad", confirmar: "Reabrir", bajada: "Vuelve al embudo y pierde su fecha de cierre. Contá por qué se reabre." },
  resultado: {
    titulo: "Cambiar resultado",
    confirmar: "Cambiar resultado",
    bajada: "Pasa de ganada a perdida (o al revés) sin reabrirla, con su propia fecha de cierre. Queda en el historial y en la auditoría.",
  },
};

/** La etapa que el diálogo propone: al mover, la siguiente en el embudo (o la primera); al cerrar y reabrir, la primera. */
export function etapaSugerida<T extends EtapaBasica>(destinos: readonly T[], modo: ModoCambio, ordenActual = 0): T | undefined {
  return modo === "etapa" ? (destinos.find((e) => e.orden > ordenActual) ?? destinos[0]) : destinos[0];
}

/** El aviso de éxito de cada acción (E2E busca "pasó a «…»" y "quedó perdida"). */
export function textoCambioHecho(modo: ModoCambio, titulo: string, nombreEtapa: string, aPerdida: boolean): string {
  switch (modo) {
    case "ganada":
      return `«${titulo}» quedó ganada.`;
    case "perdida":
      return `«${titulo}» quedó perdida. El motivo queda registrado.`;
    case "resultado":
      return `«${titulo}» ahora figura como ${aPerdida ? "perdida" : "ganada"}.`;
    case "reabrir":
      return `«${titulo}» se reabrió en «${nombreEtapa}».`;
    default:
      return `«${titulo}» pasó a «${nombreEtapa}».`;
  }
}

export type PasoEmbudo = { id: string; nombre: string; color: string | null; paso: "hecho" | "actual" | "pendiente" };

/**
 * El progreso de una oportunidad por el embudo (stepper de la ficha, solo lectura): las etapas abiertas en orden y, al
 * final, el cierre. Abierta: las anteriores a la actual quedan hechas y el cierre pendiente. Cerrada: no se afirma por
 * qué etapas pasó (eso está en el historial): las abiertas quedan sin marcar y el cierre es la etapa actual (con su
 * nombre). Una etapa actual que ya no existe no marca nada.
 */
export function pasosEmbudo<T extends EtapaBasica & { color?: string | null }>(
  etapas: readonly T[],
  etapaActualId: string,
  estado: string,
): { abiertas: PasoEmbudo[]; cierre: PasoEmbudo } {
  const abiertas = etapasAbiertas(etapas);
  const actual = etapas.find((e) => e.id === etapaActualId);
  const cerrada = estado !== "abierta";
  const orden = !cerrada && actual?.tipo === "abierta" ? actual.orden : null;
  return {
    abiertas: abiertas.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      color: e.color ?? null,
      paso: orden === null ? "pendiente" : e.id === etapaActualId ? "actual" : e.orden < orden ? "hecho" : "pendiente",
    })),
    cierre:
      cerrada && actual
        ? { id: actual.id, nombre: actual.nombre, color: actual.color ?? null, paso: "actual" }
        : { id: "cierre", nombre: "Cierre", color: null, paso: "pendiente" },
  };
}

/** Hoy en horario argentino (`aaaa-mm-dd`), igual que las fechas de las fichas. */
export function hoyAR(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(ahora);
}

/** `aaaa-mm-dd` que existe de verdad en el calendario (rechaza 2026-02-31) y es razonable. */
export function esFechaValida(ymd: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return false;
  const f = new Date(Date.UTC(y, mo - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === mo - 1 && f.getUTCDate() === d;
}

/** Probabilidad opcional, entera de 0 a 100 (CHECK `oportunidades_probabilidad_check`). Acepta "60" y "60%". */
export function validarProbabilidad(texto: string): { valor: number | null; error?: string } {
  const t = texto.trim().replace(/%$/, "").trim();
  if (!t) return { valor: null };
  if (!/^\d{1,3}$/.test(t) || Number(t) > 100) {
    return { valor: null, error: "La probabilidad es un número entero de 0 a 100." };
  }
  return { valor: Number(t) };
}

/** Fecha estimada de cierre: opcional; si viene, tiene que existir. Puede ser futura (es una estimacion). */
export function validarFechaEstimada(ymd: string): string | undefined {
  if (!ymd) return undefined;
  return esFechaValida(ymd) ? undefined : "Indicá una fecha válida.";
}

export type CampoCambio = "etapa" | "motivo" | "fecha" | "observacion";

/** `aaaa-mm-dd` -> `dd/mm/aaaa` para los mensajes de este modulo. */
function fechaLarga(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Validacion del formulario de cambio de etapa / cierre / reapertura / cambio de resultado.
 *  - perdida (o cambio de resultado hacia perdida): motivo obligatorio (la base lo exige tambien);
 *  - ganada, perdida y cambio de resultado: fecha real de cierre que exista y no sea futura;
 *  - cambio de resultado: la fecha tiene que ser DISTINTA a la del cierre actual, salvo que sea hoy.
 *    Si no, el trigger `oportunidad_reglas` entiende "no mandaron fecha nueva" y la reemplaza en
 *    silencio por la de hoy (0007: la fecha de un cierre anterior no cuenta);
 *  - reabrir y cambiar el resultado: la observacion es obligatoria (queda en el historial como la razon).
 */
export function validarCambio(input: {
  modo: ModoCambio;
  etapaId: string;
  motivoId: string;
  fecha: string;
  observacion: string;
  hoy: string;
  /** Solo "resultado": el tipo de la etapa elegida (`perdida` pide motivo). */
  destinoTipo?: string;
  /** Solo "resultado": la fecha real de cierre que tiene hoy la oportunidad. */
  fechaActual?: string | null;
}): Partial<Record<CampoCambio, string>> {
  const errores: Partial<Record<CampoCambio, string>> = {};
  const cierra = input.modo === "ganada" || input.modo === "perdida" || input.modo === "resultado";
  const aPerdida = input.modo === "perdida" || (input.modo === "resultado" && input.destinoTipo === "perdida");
  if (!input.etapaId) errores.etapa = "Elegí la etapa.";
  if (aPerdida && !input.motivoId) errores.motivo = "Elegí el motivo de pérdida.";
  if (cierra) {
    if (!esFechaValida(input.fecha)) errores.fecha = "Indicá la fecha de cierre.";
    else if (input.fecha > input.hoy) errores.fecha = "La fecha de cierre no puede ser futura.";
    else if (input.modo === "resultado" && input.fechaActual && input.fecha === input.fechaActual && input.fecha !== input.hoy) {
      errores.fecha = `Es la fecha del cierre anterior (${fechaLarga(input.fechaActual)}) y el sistema la reemplazaría por la de hoy. Elegí otra fecha o poné la de hoy.`;
    }
  }
  if ((input.modo === "reabrir" || input.modo === "resultado") && !input.observacion.trim()) {
    errores.observacion =
      input.modo === "reabrir" ? "Contá por qué se reabre: queda en el historial." : "Contá por qué cambia el resultado: queda en el historial.";
  }
  return errores;
}

/**
 * Error de PostgREST/Postgres al mover, cerrar, reabrir, reasignar o guardar una
 * oportunidad -> mensaje para la persona. Los textos de la base ya estan en
 * castellano (triggers de la 0007); aca se traducen a la accion que la persona
 * intento y se evita mostrar nombres de restricciones.
 */
export function mensajeErrorOportunidad(
  error: { code?: string; message?: string } | null | undefined,
  generico: string,
): string {
  if (!error) return generico;
  const msg = error.message ?? "";
  const code = error.code;
  if (!code && /failed to fetch|network|load failed/i.test(msg)) {
    return "No hay conexión con el servidor. Revisá tu internet y probá de nuevo.";
  }
  if (code === "42501") {
    if (/reabrir/i.test(msg)) {
      return "La oportunidad está cerrada y tu rol no puede reabrirla ni cambiar su resultado. Pedile a quien administra el CRM que lo haga.";
    }
    if (/asignar|responsable/i.test(msg)) {
      return "No tenés permiso para asignar o reasignar el responsable. Dejá el que estaba y probá de nuevo.";
    }
    if (/no existe la oportunidad/i.test(msg)) {
      return "No encontramos la oportunidad o ya no está en tu cartera. Recargá la página.";
    }
    return "Tu rol no puede hacer este cambio, o la oportunidad ya no es tuya. Pedile acceso a quien administra el CRM.";
  }
  if (code === "23514") {
    if (/motivo de p[ée]rdida/i.test(msg) || /estado_coherente/i.test(msg)) {
      return "Para marcarla como perdida hay que indicar el motivo de pérdida.";
    }
    // 0011: reglas de las licitaciones (trigger `oportunidades_licitacion_regla`).
    if (/antes de su apertura/i.test(msg)) {
      const fecha = /(\d{2}\/\d{2}\/\d{4})/.exec(msg)?.[1];
      return `No se puede marcar ganada antes de la apertura${fecha ? ` (${fecha})` : ""}.`;
    }
    if (/licitaci[oó]n necesita sus datos/i.test(msg)) {
      return "Cargá los datos de la licitación (al menos la fecha de apertura) antes de marcarla ganada.";
    }
    // 0009: antes de la regla general de la fecha, que comparte el texto "fecha real de cierre".
    if (/no puede ser futura/i.test(msg)) return "La fecha de cierre no puede ser futura.";
    if (/empresa o de un contacto/i.test(msg)) return "Elegí una empresa o un contacto: toda oportunidad es de alguien.";
    if (/fecha real de cierre/i.test(msg)) return "Una oportunidad cerrada necesita su fecha de cierre.";
    if (/no es compatible/i.test(msg)) return "Esa etapa no corresponde a lo que querés hacer. Elegí otra.";
    if (/responsable/i.test(msg)) return "El responsable tiene que ser un usuario de tu organización.";
    if (/probabilidad/i.test(msg)) return "La probabilidad es un número entero de 0 a 100.";
    return generico;
  }
  // 0011: una sola oportunidad abierta por equipo (indice unico parcial).
  if (code === "23505" && /venta_item_abierta/i.test(msg)) return "Ya hay una oportunidad abierta para este equipo.";
  if (code === "23503") {
    return "Algo de lo que elegiste (empresa, contacto, producto, origen, etapa o motivo) ya no existe. Recargá la página y probá de nuevo.";
  }
  // Un `raise exception` sin errcode llega como P0001 con el texto ya escrito para personas.
  if (code === "P0001" && msg) return msg;
  return generico;
}

/* ------------------------------------------------------------------------ */
/* Linea de tiempo unificada                                                 */
/* ------------------------------------------------------------------------ */

export type ItemTiempo<A extends { ocurrido_en: string }, C extends { cambiado_en: string }> =
  | { tipo: "actividad"; cuando: string; actividad: A }
  | { tipo: "etapa"; cuando: string; cambio: C };

/**
 * Junta las actividades (`ocurrido_en`) y los cambios de etapa (`cambiado_en`) en
 * una sola lista, la mas reciente arriba. A igual instante, el cambio de etapa
 * va primero (es lo ultimo que "paso" en el sistema). No muta las entradas.
 */
export function lineaDeTiempo<A extends { ocurrido_en: string }, C extends { cambiado_en: string }>(
  actividades: readonly A[],
  cambios: readonly C[],
): ItemTiempo<A, C>[] {
  const items: ItemTiempo<A, C>[] = [
    ...cambios.map((cambio) => ({ tipo: "etapa" as const, cuando: cambio.cambiado_en, cambio })),
    ...actividades.map((actividad) => ({ tipo: "actividad" as const, cuando: actividad.ocurrido_en, actividad })),
  ];
  return items.sort((a, b) => {
    const dif = new Date(b.cuando).getTime() - new Date(a.cuando).getTime();
    if (dif !== 0) return dif;
    return a.tipo === b.tipo ? 0 : a.tipo === "etapa" ? -1 : 1;
  });
}

/* ------------------------------------------------------------------------ */
/* Auditoria de oportunidades cerradas                                       */
/* ------------------------------------------------------------------------ */

const ETIQUETA_CAMPO: Record<string, string> = {
  titulo: "Título",
  empresa_id: "Empresa",
  contacto_id: "Contacto",
  producto_id: "Producto",
  responsable_id: "Responsable",
  etapa_id: "Etapa",
  monto: "Valor estimado",
  notas: "Observaciones",
  estado: "Estado",
  fecha_estimada_cierre: "Fecha estimada de cierre",
  fecha_cierre: "Fecha de cierre",
  origen_id: "Origen",
  motivo_perdida_id: "Motivo de pérdida",
  probabilidad: "Probabilidad",
  tipo: "Tipo",
};

/** Busca el nombre de un id (etapa, persona, empresa…); undefined si no lo conoce. */
export type ResolverId = (campo: string, id: string) => string | undefined;

function valorLegible(campo: string, valor: unknown, resolver: ResolverId): string {
  if (valor === null || valor === undefined || valor === "") return "vacío";
  if (campo.endsWith("_id")) return resolver(campo, String(valor)) ?? "Sin acceso";
  if (campo === "fecha_cierre" || campo === "fecha_estimada_cierre") return formatFecha(String(valor));
  if (campo === "estado") return estadoOportunidadInfo(String(valor)).label;
  if (campo === "tipo") return etiquetaTipoOportunidad(String(valor));
  if (campo === "monto") return formatMoney(Number(valor));
  if (campo === "probabilidad") return `${valor}%`;
  return String(valor);
}

/** Una linea de auditoria: `{campo: {antes, despues}}` -> "Etapa: Negociación → Entregado". */
export function describirCambios(
  cambios: unknown,
  resolver: ResolverId,
): { campo: string; antes: string; despues: string }[] {
  if (!cambios || typeof cambios !== "object" || Array.isArray(cambios)) return [];
  return Object.entries(cambios as Record<string, unknown>).map(([campo, v]) => {
    const par = (v && typeof v === "object" ? v : {}) as { antes?: unknown; despues?: unknown };
    return {
      campo: ETIQUETA_CAMPO[campo] ?? campo,
      antes: valorLegible(campo, par.antes, resolver),
      despues: valorLegible(campo, par.despues, resolver),
    };
  });
}

/* ------------------------------------------------------------------------ */
/* Opciones que arma el servidor para los selects                            */
/* ------------------------------------------------------------------------ */

/** Empresa elegible en el formulario. `estado` deja avisar "No contactar" y esconder las dadas de baja. */
export type OpcionEmpresa = { id: string; label: string; estado: string };
export type OpcionContacto = OpcionEmpresa & { empresaId: string | null; empresa: string | null };
export type OpcionProducto = { id: string; label: string; activo: boolean };

/* ------------------------------------------------------------------------ */
/* Titulo de cada entrada del historial de etapas                            */
/* ------------------------------------------------------------------------ */

/**
 * Como se llama un cambio de etapa en la linea de tiempo.
 *  - sin etapa anterior: "Registro inicial" para las filas que escribio la 0007 al activar el
 *    historial (la oportunidad ya existia, no "nacio" ahi); "Alta" para el alta real;
 *  - de abierta a abierta: "Cambio de etapa"; de cerrada a abierta: "Reapertura";
 *  - de abierta a cerrada: "Cierre"; de cerrada a otro cierre: "Cambio de resultado"
 *    (o "Cambio de etapa" si sigue siendo el mismo resultado).
 */
export function tituloCambioEtapa(c: {
  hayAnterior: boolean;
  anteriorTipo?: string;
  nuevaTipo?: string;
  observacion?: string | null;
}): string {
  if (!c.hayAnterior) return /^registro inicial/i.test(c.observacion ?? "") ? "Registro inicial" : "Alta";
  const desdeCerrada = c.anteriorTipo !== undefined && c.anteriorTipo !== "abierta";
  if (c.nuevaTipo === "abierta") return desdeCerrada ? "Reapertura" : "Cambio de etapa";
  if (!desdeCerrada) return "Cierre";
  return c.anteriorTipo === c.nuevaTipo ? "Cambio de etapa" : "Cambio de resultado";
}
