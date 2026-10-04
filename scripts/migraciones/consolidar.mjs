/**
 * Arma el kit de migraciones para la base viva: supabase/aplicar/aplicar_0008_a_0012.sql
 *
 *   npm run migraciones:consolidar
 *
 * Concatena las migraciones 0008 a 0012, en orden, con un cartel por cada una, y cierra con un `select` que
 * confirma que cada pieza quedó puesta (una fila por verificación y un TOTAL). Es lo que se pega, entero, en el
 * SQL Editor de Supabase; los pasos están en supabase/aplicar/LEEME.md.
 *
 * Decisiones:
 *  - SIN `begin`/`commit` propios: ninguna de las cinco usa sentencias que no puedan correr dentro de una
 *    transacción (no hay `create index concurrently`, `vacuum` ni `alter type ... add value`; los `begin` que
 *    aparecen están dentro de funciones plpgsql). El SQL Editor manda el archivo como un solo pedido, así que
 *    si algo falla Postgres revierte todo el archivo.
 *  - El bloque de `pg_trgm` de la 0010 es OPCIONAL y viene APAGADO (comentado): se enciende a mano, ver el cartel.
 *  - El archivo es generado. Una prueba (src/lib/migraciones.check.ts) lo regenera en memoria y falla si el
 *    del repositorio quedó viejo: si tocás una migración, volvé a correr este script y commiteá el resultado.
 *
 * Se puede importar (`armar()`) sin que haga nada: solo escribe el archivo cuando se corre directo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aca = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(aca, "..", "..");
export const DIR_MIGRACIONES = path.join(RAIZ, "supabase", "migrations");
export const SALIDA = path.join(RAIZ, "supabase", "aplicar", "aplicar_0008_a_0012.sql");

/** Las migraciones del kit: de la 0008 a la 0012, por prefijo numérico. */
export const DESDE = 8;
export const HASTA = 12;

const MARCA_INICIO_TRGM = "-- >>> BLOQUE OPCIONAL: PG_TRGM";
const MARCA_FIN_TRGM = "-- <<< FIN BLOQUE OPCIONAL: PG_TRGM";

const normalizar = (texto) => texto.replace(/\r\n/g, "\n").replace(/\s+$/, "") + "\n";

/** Las migraciones del kit, en orden: [{ archivo, numero, sql }]. */
export function leerMigraciones(dir = DIR_MIGRACIONES) {
  const archivos = fs
    .readdirSync(dir)
    .map((f) => ({ archivo: f, numero: Number(/^(\d{4})_.+\.sql$/.exec(f)?.[1]) }))
    .filter((m) => Number.isInteger(m.numero) && m.numero >= DESDE && m.numero <= HASTA)
    .sort((a, b) => a.numero - b.numero);
  const esperadas = HASTA - DESDE + 1;
  if (archivos.length !== esperadas || archivos.some((m, i) => m.numero !== DESDE + i)) {
    throw new Error(`Se esperaban las migraciones ${DESDE} a ${HASTA} (${esperadas}, sin huecos) y se encontraron: ${archivos.map((m) => m.archivo).join(", ") || "ninguna"}.`);
  }
  return archivos.map((m) => ({ ...m, sql: normalizar(fs.readFileSync(path.join(dir, m.archivo), "utf8")) }));
}

/** Apaga el bloque de pg_trgm de la 0010: comenta cada línea entre sus dos marcadores. */
export function apagarTrigramas(sql) {
  const lineas = sql.split("\n");
  const ini = lineas.indexOf(MARCA_INICIO_TRGM);
  const fin = lineas.indexOf(MARCA_FIN_TRGM);
  if (ini < 0 || fin < ini) throw new Error("No se encontró el bloque opcional de pg_trgm (sus marcadores) en la migración 0010.");
  return lineas.map((l, i) => (i > ini && i < fin && l.trim() !== "" ? `-- ${l}` : l)).join("\n");
}

const cartel = (texto, ancho = 78) => {
  const linea = "-- " + "=".repeat(ancho - 3);
  return [linea, ...texto.split("\n").map((l) => `-- ${l}`), linea].join("\n");
};

const CARTEL_TRGM = cartel(
  [
    "OPCIONAL: PG_TRGM (apagado). Lo de abajo, entre >>> y <<<, esta COMENTADO a proposito.",
    "Hace falta solo con decenas de miles de filas (acelera el ilike '%texto%' de los",
    "buscadores). Con el volumen de un CRM chico no se nota. La app anda igual sin esto.",
    "Para encenderlo: en las lineas entre >>> y <<<, sacale el '-- ' del principio y",
    "ejecuta el archivo ENTERO de nuevo (es idempotente: lo ya aplicado no cambia).",
  ].join("\n"),
);

/** Una fila por pieza que tiene que haber quedado puesta. [migración, qué se verifica, expresión booleana]. */
const trigger = (nombre, tabla) =>
  `exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = '${tabla}' and t.tgname = '${nombre}' and not t.tgisinternal)`;
const politica = (nombre, tabla) =>
  `exists (select 1 from pg_policies where schemaname = 'public' and tablename = '${tabla}' and policyname = '${nombre}')`;
const indice = (nombre) => `exists (select 1 from pg_indexes where schemaname = 'public' and indexname = '${nombre}')`;
const tabla = (nombre) => `to_regclass('public.${nombre}') is not null`;
const rls = (nombre) => `coalesce((select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = '${nombre}'), false)`;
const funcion = (nombre) => `exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '${nombre}')`;

export const VERIFICACIONES = [
  ["0008", "empresas: ya no hay política de borrado (baja lógica garantizada)", `not ${politica("borrar", "empresas")}`],
  ["0008", "contactos: ya no hay política de borrado (baja lógica garantizada)", `not ${politica("borrar", "contactos")}`],
  ["0008", "etapas: trigger que conserva una etapa ganada y una perdida", trigger("etapas_conservar_cierres", "etapas")],
  ["0009", "oportunidades: trigger «empresa o contacto obligatorio»", trigger("oportunidades_requiere_cliente", "oportunidades")],
  ["0009", "oportunidades: la regla de cierre rechaza la fecha futura", `coalesce((select pg_get_functiondef(p.oid) ilike '%no puede ser futura%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'oportunidad_reglas' limit 1), false)`],
  ["0010", "índice de empresas por nombre", indice("empresas_org_nombre_idx")],
  ["0010", "índice de empresas por estado", indice("empresas_org_estado_idx")],
  ["0010", "índice de contactos por nombre", indice("contactos_org_nombre_idx")],
  ["0010", "índice de contactos por estado", indice("contactos_org_estado_idx")],
  ["0010", "índice de oportunidades por fecha de alta", indice("oportunidades_org_creada_idx")],
  ["0010", "índice de ventas por fecha", indice("ventas_org_fecha_idx")],
  ["0010", "índice de usuarios por nombre", indice("perfiles_org_nombre_idx")],
  ["0011", "tabla canchas, con RLS", `${tabla("canchas")} and ${rls("canchas")}`],
  ["0011", "tabla licitaciones, con RLS", `${tabla("licitaciones")} and ${rls("licitaciones")}`],
  ["0011", "canchas y licitaciones: políticas de lectura", `${politica("ver", "canchas")} and ${politica("ver", "licitaciones")}`],
  ["0011", "oportunidades: columna venta_item_id (recambio en 1 clic)", `exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'oportunidades' and column_name = 'venta_item_id')`],
  ["0011", "oportunidades: una sola abierta por equipo (índice único parcial)", indice("oportunidades_venta_item_abierta_key")],
  ["0011", "oportunidades: trigger «una licitación no se gana antes de su apertura»", trigger("oportunidades_licitacion_regla", "oportunidades")],
  ["0012", "tabla presupuestos, con RLS", `${tabla("presupuestos")} and ${rls("presupuestos")}`],
  ["0012", "tabla presupuesto_contadores (numeración por organización)", tabla("presupuesto_contadores")],
  ["0012", "presupuestos: trigger que asigna el número", trigger("presupuestos_numero", "presupuestos")],
  ["0012", "presupuestos: trigger que impide modificarlos", trigger("presupuestos_proteger", "presupuestos")],
  ["0012", "presupuestos: política de lectura", politica("ver", "presupuestos")],
  ["0012", "función que asigna el número de presupuesto", funcion("presupuesto_asignar_numero")],
];

const comillas = (s) => `'${s.replace(/'/g, "''")}'`;

/** El `select` final: el checklist legible. La última fila es el TOTAL. */
export function armarVerificacion() {
  const filas = VERIFICACIONES.map(([mig, texto, expr], i) => `    (${i + 1}, ${comillas(mig)}, ${comillas(texto)}, (${expr}))`).join(",\n");
  return [
    cartel("VERIFICACION: una fila por pieza. Todo tiene que decir OK; la ultima fila resume.\nSi algo dice FALTA, mira supabase/aplicar/LEEME.md (\"Si algo falla\")."),
    "",
    "with v(paso, migracion, verificacion, ok) as (",
    "  values",
    filas,
    ")",
    "select paso, migracion, verificacion, case when ok then 'OK' else 'FALTA' end as estado",
    "from v",
    "union all",
    "select 1000, 'TOTAL', 'pg_trgm (OPCIONAL): ' || case when exists (select 1 from pg_extension where extname = 'pg_trgm') then 'activo' else 'apagado' end,",
    "       case when bool_and(ok) then 'TODO OK' else 'HAY ' || count(*) filter (where not ok) || ' FALTANTES' end",
    "from v",
    "order by paso;",
    "",
  ].join("\n");
}

/** El archivo completo, como string (sin tocar el disco). */
export function armar(dir = DIR_MIGRACIONES) {
  const migraciones = leerMigraciones(dir);
  const partes = [];
  partes.push(
    cartel(
      [
        "Tuco & Nito - KIT DE MIGRACIONES 0008 a 0012 (archivo GENERADO, no editar a mano)",
        "",
        "Pegar ENTERO en el SQL Editor de Supabase y ejecutar. Orden: " + migraciones.map((m) => m.archivo.slice(0, 4)).join(", ") + ".",
        "Es idempotente: se puede volver a correr sin efecto. Requiere 0001 a 0007 aplicadas.",
        "Sin BEGIN/COMMIT: el editor lo manda como un solo pedido; si algo falla, se revierte todo.",
        "Termina con una tabla de verificacion: todo tiene que decir OK y el TOTAL, 'TODO OK'.",
        "Pasos completos y que hacer si falla: supabase/aplicar/LEEME.md",
        "",
        "Se regenera con: npm run migraciones:consolidar   (lo verifica `npm test`)",
      ].join("\n"),
    ),
  );
  migraciones.forEach((m, i) => {
    partes.push("");
    partes.push(cartel(`>>> ${m.archivo}   (${i + 1} de ${migraciones.length})`));
    partes.push("");
    if (m.numero === 10) partes.push(apagarTrigramas(m.sql).replace(MARCA_INICIO_TRGM, `${CARTEL_TRGM}\n${MARCA_INICIO_TRGM}`).trimEnd());
    else partes.push(m.sql.trimEnd());
    partes.push("");
    partes.push(cartel(`<<< fin de ${m.archivo}`));
  });
  partes.push("");
  partes.push(armarVerificacion());
  return normalizar(partes.join("\n"));
}

// Solo escribe el archivo si se corre directo (no al importarlo desde la prueba).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sql = armar();
  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, sql);
  console.log(`[migraciones] ${path.relative(RAIZ, SALIDA)}: ${sql.split("\n").length} líneas, ${(Buffer.byteLength(sql) / 1024).toFixed(0)} KB.`);
}
