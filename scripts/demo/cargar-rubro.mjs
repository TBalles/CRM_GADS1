/**
 * Carga la demo del rubro POR LA API, sin SQL Editor: es la alternativa a supabase/seeds/demo_rubro.sql para quien
 * no tiene acceso al panel de Supabase. Entra con la cuenta de Administrador de la demo y respeta todas las
 * reglas (RLS, triggers): no saltea nada.
 *
 *   DEMO_PASSWORD=… npm run demo:rubro              carga lo que falte
 *   DEMO_PASSWORD=… npm run demo:rubro -- --dry     solo lee: muestra qué crearía, no escribe nada
 *
 *   DEMO_EMAIL      por defecto administrador@demo.tuconito.com.ar
 *   DEMO_PASSWORD   obligatoria; la de la demo está en el comentario de supabase/seeds/demo_catedra.sql.
 *                   Se pasa por entorno en la línea de comandos: nunca va en un archivo del repositorio.
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY   salen del .env (se lo carga solo)
 *
 * QUÉ DEJA (todo con nombres reales de la demo, sin «ZZ»)
 *   - 2 canchas: «Canchas de fútbol 5» (La Tablada) y «Cancha principal de fútbol 11» (San Justo)
 *   - los datos de la licitación «Licitación: equipamiento completo del predio» (apertura a 12 días)
 *   - 1 presupuesto guardado para «Dos arcos de fútbol 5 para la cancha nueva»
 *   - 1 oportunidad de recambio abierta vinculada a un equipo entregado (las redes de fútbol 11 de San Justo)
 *
 * ES IDEMPOTENTE: busca cada cosa por su clave natural (empresa + nombre de la cancha, oportunidad de la
 * licitación, oportunidad del presupuesto, equipo del recambio) y solo crea lo que falta. Correrlo dos veces no
 * duplica nada, y sobre una base donde ya se corrió demo_rubro.sql no crea nada. Un presupuesto emitido no se
 * puede borrar, por eso el control de «ya existe» es lo que evita sumar uno cada vez.
 */
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry");
const EMAIL = process.env.DEMO_EMAIL ?? "administrador@demo.tuconito.com.ar";
const PASSWORD = process.env.DEMO_PASSWORD;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!PASSWORD) fallar("Falta DEMO_PASSWORD (la clave de la cuenta de demostración). Pasala por entorno, no por archivo.");
if (!SB_URL || !KEY) fallar("Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (el .env de la raíz las trae).");

function fallar(msg) {
  console.error(`[demo:rubro] ${msg}`);
  process.exit(1);
}

const supabase = createClient(SB_URL, KEY, { auth: { persistSession: false } });
const resumen = [];
const hecho = (que, estado) => {
  resumen.push([que, estado]);
  console.log(`  ${estado.padEnd(9)} ${que}`);
};

/** Lanza si la consulta falló; un error de «tabla inexistente» se explica en vez de mostrarse crudo. */
function ok({ data, error }, donde) {
  if (!error) return data;
  if (error.code === "PGRST205" || error.code === "42703" || error.code === "42P01") {
    fallar(`${donde}: falta aplicar las migraciones 0011 y 0012 (${error.message}). Ver supabase/aplicar/LEEME.md.`);
  }
  fallar(`${donde}: [${error.code}] ${error.message}`);
}

/** Escribe (o, con --dry, solo avisa). Devuelve la fila creada, o null en --dry. */
async function crear(que, consulta) {
  if (DRY) {
    hecho(que, "crearía");
    return null;
  }
  const fila = ok(await consulta(), que);
  hecho(que, "creado");
  return fila;
}

/** «Hoy» en Argentina (el servidor y esta máquina pueden estar en otro huso). */
const hoyAR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
function sumarDias(ymd, dias) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function empresaPorNombre(nombre) {
  const filas = ok(await supabase.from("empresas").select("id, nombre").eq("nombre", nombre).limit(1), `buscar la empresa «${nombre}»`);
  if (!filas.length) fallar(`No existe la empresa «${nombre}»: primero hay que cargar supabase/seeds/demo_catedra.sql.`);
  return filas[0].id;
}

async function oportunidadPorTitulo(titulo) {
  const filas = ok(
    await supabase.from("oportunidades").select("id, titulo, empresa_id, contacto_id, estado, venta_item_id").eq("titulo", titulo).limit(1),
    `buscar la oportunidad «${titulo}»`,
  );
  if (!filas.length) fallar(`No existe la oportunidad «${titulo}»: primero hay que cargar supabase/seeds/demo_catedra.sql.`);
  return filas[0];
}

// ─────────────────────────────────────────────────────────── sesión
console.log(`[demo:rubro] ${DRY ? "SIMULACRO (no escribe nada)" : "carga"} como ${EMAIL}`);
{
  const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) fallar(`No se pudo ingresar: ${error.message}`);
}

// ─────────────────────────────────────────────────────────── 1. canchas
const CANCHAS = [
  { empresa: "Complejo Fútbol 5 La Tablada", nombre: "Canchas de fútbol 5", formato: "F5", superficie: "sintetico", cantidad: 6, iluminacion: true,
    notas: "Seis canchas de sintético con iluminación nocturna. Los arcos son de caño de 3 x 2 m." },
  { empresa: "Club Atlético San Justo", nombre: "Cancha principal de fútbol 11", formato: "F11", superficie: "natural", cantidad: 1, iluminacion: true,
    notas: "Césped natural. Arcos reglamentarios de 7,32 x 2,44 m." },
];
console.log("\nCanchas");
for (const c of CANCHAS) {
  const empresaId = await empresaPorNombre(c.empresa);
  const existe = ok(await supabase.from("canchas").select("id").eq("empresa_id", empresaId).eq("nombre", c.nombre).limit(1), "buscar canchas");
  const que = `cancha «${c.nombre}» (${c.empresa})`;
  if (existe.length) {
    hecho(que, "ya estaba");
    continue;
  }
  const { empresa: _e, ...datos } = c;
  await crear(que, () => supabase.from("canchas").insert({ ...datos, empresa_id: empresaId, activa: true }).select().single());
}

// ─────────────────────────────────────────────────────────── 2. licitación
console.log("\nLicitación");
{
  const opp = await oportunidadPorTitulo("Licitación: equipamiento completo del predio");
  const existe = ok(await supabase.from("licitaciones").select("id").eq("oportunidad_id", opp.id).limit(1), "buscar la licitación");
  const que = "datos de «Licitación: equipamiento completo del predio»";
  if (existe.length) hecho(que, "ya estaba");
  else {
    await crear(que, () =>
      supabase
        .from("licitaciones")
        .insert({
          oportunidad_id: opp.id,
          expediente: "EXP-4059-2026",
          organismo: "Secretaría de Deportes del Municipio",
          fecha_apertura: sumarDias(hoyAR(), 12),
          monto_oficial: 1850000,
          garantia: "Seguro de caución por el 5 % del monto oficial",
        })
        .select()
        .single(),
    );
  }
}

// ─────────────────────────────────────────────────────────── 3. presupuesto
console.log("\nPresupuesto");
{
  const opp = await oportunidadPorTitulo("Dos arcos de fútbol 5 para la cancha nueva");
  const existen = ok(await supabase.from("presupuestos").select("numero").eq("oportunidad_id", opp.id), "buscar presupuestos");
  const que = "presupuesto de «Dos arcos de fútbol 5 para la cancha nueva»";
  if (existen.length) hecho(que, `ya estaba (N° ${String(existen[0].numero).padStart(6, "0")})`);
  else {
    const [org] = ok(await supabase.from("organizaciones").select("*").limit(1), "leer la organización");
    // Foto del emisor, igual que emisorDesdeOrganizacion() de src/lib/presupuesto.ts (sin el logo ni los vacíos).
    const emisor = Object.fromEntries(
      Object.entries({
        razon_social: org.razon_social, cuit: org.cuit, direccion: org.direccion, telefono: org.telefono, email: org.email, sitio_web: org.sitio_web,
      }).filter(([, v]) => v != null && v !== ""),
    );
    await crear(que, () =>
      supabase
        .from("presupuestos")
        .insert({
          oportunidad_id: opp.id,
          validez_dias: 15,
          condiciones: "Precios netos de IVA. Entrega en 10 días hábiles desde la aprobación.",
          lineas: [{ descripcion: "Arco de fútbol 5/7", cantidad: 2, precio_unitario: 180000, descuento_pct: 0 }],
          // Responsable Inscripto: 2 x 180.000 = 360.000 neto + IVA 21 % = 435.600.
          total: 435600,
          condicion_iva: org.condicion_iva,
          emisor,
        })
        .select()
        .single(),
    );
  }
}

// ─────────────────────────────────────────────────────────── 4. recambio vinculado a un equipo
console.log("\nRecambio");
{
  const alerta = ok(
    await supabase.from("alertas_vida_util").select("*").eq("empresa_nombre", "Club Atlético San Justo").eq("producto_nombre", "Red para arco de fútbol 11").limit(1),
    "buscar la alerta de las redes",
  )[0];
  const que = "oportunidad de recambio de las redes de fútbol 11 (San Justo)";
  if (!alerta) hecho(que, "omitido (no hay alerta vigente de ese equipo)");
  else {
    const abierta = ok(
      await supabase.from("oportunidades").select("id").eq("venta_item_id", alerta.venta_item_id).eq("estado", "abierta").limit(1),
      "buscar recambios abiertos",
    );
    if (abierta.length) hecho(que, "ya estaba");
    else {
      // La demo ya trae «Recambio de redes de fútbol 11» sin vincular: se la vincula al equipo en vez de duplicarla.
      const previa = ok(
        await supabase
          .from("oportunidades")
          .select("id")
          .eq("titulo", "Recambio de redes de fútbol 11")
          .eq("estado", "abierta")
          .is("venta_item_id", null)
          .limit(1),
        "buscar la oportunidad de recambio de la demo",
      )[0];
      if (previa) {
        await crear(`${que} (se vincula la existente)`, () =>
          supabase.from("oportunidades").update({ venta_item_id: alerta.venta_item_id }).eq("id", previa.id).select().single(),
        );
      } else {
        const etapa = ok(await supabase.from("etapas").select("id").eq("tipo", "abierta").order("orden").limit(1), "leer las etapas")[0];
        const { data: sesion } = await supabase.auth.getUser();
        await crear(que, () =>
          supabase
            .from("oportunidades")
            .insert({
              titulo: `Recambio: ${alerta.producto_nombre} — ${alerta.empresa_nombre}`,
              empresa_id: alerta.empresa_id,
              contacto_id: alerta.contacto_id,
              producto_id: alerta.producto_id,
              etapa_id: etapa.id,
              responsable_id: sesion.user.id,
              venta_item_id: alerta.venta_item_id,
              tipo: "directa",
            })
            .select()
            .single(),
        );
      }
    }
  }
}

const creados = resumen.filter(([, e]) => e === "creado" || e === "crearía").length;
console.log(`\n[demo:rubro] ${DRY ? "Crearía" : "Creó"} ${creados} elemento(s); el resto ya estaba (${resumen.length - creados}).`);
