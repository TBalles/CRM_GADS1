/**
 * Baseline del CRM ACTUAL (CRM 2.0, Etapa 0): capturas de cada pantalla autenticada en claro y oscuro, a
 * 1440 y 390 de ancho, para la comparación "generación 1 vs generación 2". Las imágenes se guardan FUERA del
 * repositorio (para no inflarlo): por defecto en ../baseline-crm-actual/ (al lado de la carpeta del proyecto).
 *
 *   GUARD_BASE_URL                       app levantada, build de producción (por defecto http://localhost:3000)
 *   MANUAL_EMAIL / MANUAL_PASSWORD       el Administrador de la organización de demostración
 *   MANUAL_EMAIL_VENDEDOR / MANUAL_PASSWORD_VENDEDOR   (opcional) el Vendedor: suma 3 pantallas
 *   GUARD_BASELINE_OUT                   carpeta de salida (por defecto ../baseline-crm-actual)
 *
 *   npm run guard:baseline-crm
 *   npm run guard:baseline-crm -- --solo=dashboard,empresas     solo esas pantallas
 *   npm run guard:baseline-crm -- --continuar                   salta las imágenes que ya existen
 *
 * Las credenciales NUNCA van en el repositorio: se pasan por entorno en la línea de comandos (la cuenta de
 * demostración y su clave están en el comentario de supabase/seeds/demo_catedra.sql).
 *
 * Es solo NAVEGACIÓN: no se crea, guarda, envía ni borra nada. Todo lo que se abre (panel, paleta) queda
 * abierto en la foto y la página se descarta sin confirmar.
 *
 * Nombres: <pantalla>__<light|dark>__<1440|390>.png. Nombres iguales entre generaciones = pares de comparación.
 * Se salta (y queda anotado en _indice.json): el panel de plataforma (/admin: necesita un superadmin que la
 * demo no tiene) y "sin permisos" como un rol sin acceso (la demo no tiene un rol sin pantallas: se fotografía
 * /sin-permisos entrando directo).
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = (process.env.GUARD_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SALIDA = path.resolve(process.env.GUARD_BASELINE_OUT ?? path.join(RAIZ, "..", "baseline-crm-actual"));
const ALTO_MAX = 2600;

const CREDENCIALES = {
  admin: { email: process.env.MANUAL_EMAIL, password: process.env.MANUAL_PASSWORD, vars: "MANUAL_EMAIL y MANUAL_PASSWORD" },
  vendedor: { email: process.env.MANUAL_EMAIL_VENDEDOR, password: process.env.MANUAL_PASSWORD_VENDEDOR, vars: "MANUAL_EMAIL_VENDEDOR y MANUAL_PASSWORD_VENDEDOR" },
};

// --continuar: no repite las imágenes que ya existen en la carpeta de salida (retomar una corrida cortada).
const CONTINUAR = process.argv.includes("--continuar");
const soloArg =process.argv.find((a) => a.startsWith("--solo="));
const SOLO = soloArg ? new Set(soloArg.slice("--solo=".length).split(",").filter(Boolean)) : null;

/* ── Ayudas de navegación ─────────────────────────────────────────────── */

const visible = (page, loc) => loc.filter({ visible: true }).first();
// En celular algunos textos (p. ej. "Nueva empresa") son solo el aria-label de un botón con ícono: se aceptan
// como texto visible o como nombre de botón. Si el marcador no aparece, basta que el área de contenido tenga
// texto: esperarCarga() ya esperó a que termine el esqueleto de carga (en celular algunas pantallas no
// muestran el título h1).
const contenido = (page) => page.waitForFunction(() => (document.querySelector("[data-app-main]")?.innerText ?? "").trim().length > 40, null, { timeout: 15_000 });
const texto = (t, opts = {}) => async (page) => {
  const marcador = page.getByText(t, { exact: false, ...opts }).filter({ visible: true }).or(page.getByRole("button", { name: t, ...opts }));
  try {
    await marcador.first().waitFor({ state: "visible", timeout: 10_000 });
  } catch {
    await contenido(page);
  }
};
/** La ficha de CRM 2.0 cargó: su tab Resumen está elegida. ("Resumen de la cuenta" ahora es un h2 solo para lectores
 *  de pantalla y solo con cifras: no sirve de marcador visible.) */
const fichaLista = async (page) => {
  try {
    await page.getByRole("tab", { name: /^Resumen/, selected: true }).first().waitFor({ state: "visible", timeout: 10_000 });
  } catch {
    await contenido(page);
  }
};
const dialogo = (page) => page.locator('[role="dialog"]:visible').last();

async function esperarCarga(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.locator('[role="status"]', { hasText: /^Cargando/ }).first().waitFor({ state: "detached", timeout: 120_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}
async function ir(page, ruta) {
  await page.goto(BASE + ruta, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await esperarCarga(page);
}
async function abrirFicha(page, lista, nombre) {
  await ir(page, lista);
  await visible(page, page.getByRole("link", { name: nombre })).click({ timeout: 30_000 });
  await page.waitForURL(/\/(empresas|contactos)\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await esperarCarga(page);
}
async function abrirOportunidad(page, titulo, sufijo = "") {
  await ir(page, "/oportunidades?vista=lista&estado=todos");
  await visible(page, page.getByRole("link", { name: titulo })).click({ timeout: 30_000 });
  await page.waitForURL(/\/oportunidades\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await esperarCarga(page);
  if (sufijo) await ir(page, new URL(page.url()).pathname + sufijo);
}
const abrirDialogo = (nombreBoton) => async (page) => {
  await visible(page, page.getByRole("button", { name: nombreBoton })).click();
  await dialogo(page).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
};
const pestana = (nombre) => async (page) => {
  await page.getByRole("tab", { name: nombre }).click();
  await page.waitForTimeout(700);
};

/* ── Pantallas ────────────────────────────────────────────────────────────
 * ir(page)        llega a la pantalla; esperar(page): lo que prueba que cargó de verdad
 * preparar(page)  abre lo que tenga que estar abierto (panel, paleta, menú)
 * viewport: true  foto del viewport tal cual (overlays); si no, se alarga la ventana al alto del contenido
 * soloAncho       si está, solo ese ancho                                                     */
const PANTALLAS = [
  { id: "dashboard", ir: (p) => ir(p, "/dashboard"), esperar: texto("en juego") },
  { id: "empresas", ir: (p) => ir(p, "/empresas"), esperar: texto("Nueva empresa") },
  { id: "empresa-ficha", ir: (p) => abrirFicha(p, "/empresas", "Club Atlético San Justo"), esperar: fichaLista },
  { id: "empresa-nueva", ir: (p) => ir(p, "/empresas"), esperar: texto("Nueva empresa"), preparar: abrirDialogo("Nueva empresa"), viewport: true },
  { id: "contactos", ir: (p) => ir(p, "/contactos"), esperar: texto("Nuevo contacto") },
  { id: "contacto-ficha", ir: (p) => abrirFicha(p, "/contactos", /Gutiérrez/), esperar: fichaLista },
  { id: "oportunidades-tablero", ir: (p) => ir(p, "/oportunidades"), esperar: texto("Embudo comercial") },
  { id: "oportunidades-lista", ir: (p) => ir(p, "/oportunidades?vista=lista"), esperar: texto("Mostrando") },
  { id: "oportunidad-detalle", ir: (p) => abrirOportunidad(p, /Dos arcos de fútbol 5/), esperar: texto("Cambiar etapa") },
  { id: "oportunidad-presupuesto", ir: (p) => abrirOportunidad(p, /Dos arcos de fútbol 5/, "/presupuesto"), esperar: texto("Agregar línea libre") },
  { id: "productos", ir: (p) => ir(p, "/productos?estado=activo"), esperar: texto("Nuevo producto") },
  { id: "ventas", ir: (p) => ir(p, "/ventas"), esperar: texto("Nueva venta") },
  { id: "alertas", ir: (p) => ir(p, "/alertas"), esperar: texto("Alertas de recambio") },
  { id: "usuarios-usuarios", ir: (p) => ir(p, "/usuarios"), esperar: texto("Invitar usuario") },
  { id: "usuarios-roles", ir: (p) => ir(p, "/usuarios?tab=roles"), esperar: texto("Nuevo rol") },
  { id: "configuracion-datos", ir: (p) => ir(p, "/configuracion"), esperar: texto("Así va a verse en tus presupuestos") },
  { id: "configuracion-etapas", ir: (p) => ir(p, "/configuracion"), esperar: async (p) => p.getByRole("tab", { name: /Etapas/ }).first().waitFor({ timeout: 20_000 }), preparar: pestana(/Etapas/) },
  { id: "configuracion-tipos", ir: (p) => ir(p, "/configuracion"), esperar: async (p) => p.getByRole("tab", { name: /Tipos de actividad/ }).first().waitFor({ timeout: 20_000 }), preparar: pestana(/Tipos de actividad/) },
  { id: "configuracion-origenes", ir: (p) => ir(p, "/configuracion"), esperar: async (p) => p.getByRole("tab", { name: /Orígenes/ }).first().waitFor({ timeout: 20_000 }), preparar: pestana(/Orígenes/) },
  { id: "configuracion-motivos", ir: (p) => ir(p, "/configuracion"), esperar: async (p) => p.getByRole("tab", { name: /Motivos de pérdida/ }).first().waitFor({ timeout: 20_000 }), preparar: pestana(/Motivos de pérdida/) },
  { id: "tablero-comercial", ir: (p) => ir(p, "/tablero-comercial"), esperar: texto("Pipeline por responsable") },
  { id: "embudo", ir: (p) => ir(p, "/embudo"), esperar: texto("Cómo se calcula") },
  {
    id: "paleta",
    ir: (p) => ir(p, "/ventas"),
    esperar: contenido,
    preparar: async (p) => {
      await p.keyboard.press("Control+k");
      await p.getByRole("dialog").waitFor({ timeout: 10_000 });
      await p.waitForTimeout(400);
    },
    viewport: true,
  },
  { id: "sin-permisos", ir: (p) => ir(p, "/sin-permisos"), esperar: texto("Tu rol todavía no tiene secciones habilitadas") },
  {
    id: "menu-movil",
    ir: (p) => ir(p, "/dashboard"),
    esperar: texto("en juego"),
    preparar: async (p) => {
      await p.getByRole("button", { name: "Abrir menú" }).click();
      await p.waitForTimeout(500);
    },
    viewport: true,
    soloAncho: 390,
  },
  { id: "vendedor-dashboard", rol: "vendedor", ir: (p) => ir(p, "/dashboard"), esperar: texto("en juego") },
  { id: "vendedor-empresas", rol: "vendedor", ir: (p) => ir(p, "/empresas"), esperar: texto("Mostrando") },
  { id: "vendedor-oportunidades", rol: "vendedor", ir: (p) => ir(p, "/oportunidades"), esperar: texto("Embudo comercial") },
];

const SALTADAS = [
  { id: "admin-plataforma", motivo: "El panel de plataforma (/admin) necesita un superadmin que la demo no tiene." },
  { id: "sin-permisos-rol-sin-acceso", motivo: "La demo no tiene un rol sin pantallas: /sin-permisos se fotografía entrando directo con el Administrador (pantalla `sin-permisos`)." },
];

/* ── Captura ──────────────────────────────────────────────────────────── */

async function iniciarSesion(browser, rol) {
  const { email, password, vars } = CREDENCIALES[rol];
  if (!email || !password) throw new Error(`Faltan las variables de entorno ${vars}`);
  const context = await browser.newContext({ locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
    return await context.storageState();
  } finally {
    await context.close();
  }
}

async function capturar(page, pantalla, destino, ancho, altoBase) {
  await pantalla.ir(page);
  await pantalla.esperar(page);
  if (pantalla.preparar) await pantalla.preparar(page);
  if (!pantalla.viewport) {
    const alto = await page.evaluate(() => {
      const m = document.querySelector("[data-app-main]");
      return m ? Math.ceil(m.scrollHeight + m.getBoundingClientRect().top) : null;
    });
    if (alto) {
      await page.setViewportSize({ width: ancho, height: Math.min(Math.max(alto, altoBase), ALTO_MAX) });
      await page.waitForTimeout(400);
    }
  }
  await page.mouse.move(2, 2);
  await page.waitForTimeout(500);
  // caret: "hide" por el campo con foco de los paneles (el cursor de texto parpadea). Sin `animations:
  // "disabled"`: con `reducedMotion: "reduce"` el CRM ya no anima, y esa opción hacía lentas las capturas.
  await page.screenshot({ path: destino, type: "png", caret: "hide" });
}

async function main() {
  fs.mkdirSync(SALIDA, { recursive: true });
  const browser = await chromium.launch();
  const sesiones = {};
  const falloSesion = {};
  for (const rol of ["admin", "vendedor"]) {
    if (!PANTALLAS.some((p) => (p.rol ?? "admin") === rol && (!SOLO || SOLO.has(p.id)))) continue;
    try {
      sesiones[rol] = await iniciarSesion(browser, rol);
      console.log(`[baseline] Sesión de ${rol}: ok`);
    } catch (e) {
      falloSesion[rol] = e.message.split("\n")[0];
      console.warn(`[baseline] Sesión de ${rol}: ${falloSesion[rol]}${rol === "vendedor" ? " (opcional: se omiten sus pantallas)" : ""}`);
    }
  }
  if (falloSesion.admin) {
    await browser.close();
    process.exit(1);
  }

  const hechas = [];
  const fallidas = [];
  for (const tema of ["light", "dark"]) {
    for (const ancho of [1440, 390]) {
      const movil = ancho === 390;
      const altoBase = movil ? 844 : 900;
      for (const rol of ["admin", "vendedor"]) {
        if (!sesiones[rol]) continue;
        const context = await browser.newContext({
          locale: "es-AR",
          timezoneId: "America/Argentina/Buenos_Aires",
          colorScheme: tema,
          reducedMotion: "reduce",
          viewport: { width: ancho, height: altoBase },
          deviceScaleFactor: 1,
          isMobile: movil,
          hasTouch: movil,
          storageState: sesiones[rol],
        });
        await context.addInitScript((t) => {
          try {
            localStorage.setItem("theme", t);
          } catch {}
        }, tema);
        for (const pantalla of PANTALLAS) {
          if ((pantalla.rol ?? "admin") !== rol) continue;
          if (SOLO && !SOLO.has(pantalla.id)) continue;
          if (pantalla.soloAncho && pantalla.soloAncho !== ancho) continue;
          const nombre = `${pantalla.id}__${tema}__${ancho}.png`;
          if (CONTINUAR && fs.existsSync(path.join(SALIDA, nombre))) {
            hechas.push(nombre);
            continue;
          }
          const page = await context.newPage();
          page.setDefaultTimeout(45_000);
          let reloj;
          try {
            // Tope duro por pantalla: una pantalla colgada no frena a las demás.
            const tope = new Promise((_, rechazar) => {
              reloj = setTimeout(() => rechazar(new Error("tiempo agotado (150 s)")), 150_000);
            });
            await Promise.race([capturar(page, pantalla, path.join(SALIDA, nombre), ancho, altoBase), tope]);
            hechas.push(nombre);
            console.log(`  ok        ${nombre}`);
          } catch (e) {
            fallidas.push({ archivo: nombre, causa: e.message.split("\n")[0] });
            console.log(`  FALLÓ     ${nombre}  ${e.message.split("\n")[0]}`);
          } finally {
            clearTimeout(reloj);
            await page.close().catch(() => {});
          }
        }
        await context.close();
      }
    }
  }
  await browser.close();

  fs.writeFileSync(
    path.join(SALIDA, "_indice.json"),
    JSON.stringify({ base: BASE, generado: new Date().toISOString(), cantidad: hechas.length, imagenes: hechas, fallidas, saltadas: SALTADAS }, null, 2) + "\n",
  );
  console.log(`\n[baseline] ${hechas.length} imágenes en ${SALIDA}; ${fallidas.length} fallidas; saltadas: ${SALTADAS.map((s) => s.id).join(", ")}.`);
  if (fallidas.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
