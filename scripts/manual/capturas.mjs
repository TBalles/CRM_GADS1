/**
 * Saca las capturas de pantalla del manual con Playwright y las guarda en docs/manual/capturas/.
 *
 *   MANUAL_BASE_URL                       a dónde apunta (por defecto http://localhost:3000)
 *   MANUAL_EMAIL / MANUAL_PASSWORD        un Administrador de la organización de demostración
 *   MANUAL_EMAIL_VENDEDOR / MANUAL_PASSWORD_VENDEDOR   un Vendedor de la misma organización
 *   MANUAL_EMAIL_SUPERADMIN / MANUAL_PASSWORD_SUPERADMIN   (opcional) el superadmin de la plataforma, para el panel /admin
 *
 *   npm run manual:capturas                       todas las figuras
 *   npm run manual:capturas -- --solo=tablero,login   solo esas
 *
 * Las credenciales NUNCA van en el repositorio: se pasan por entorno en la línea de comandos. (La cuenta
 * de demostración y su clave están en el comentario de supabase/seeds/demo_catedra.sql.)
 *
 * Es solo navegación: no se crea, guarda, envía ni borra nada (ver las reglas en figuras.mjs). Tema claro,
 * 1440 × 900 (390 de ancho en las figuras de celular), horario y locale de Argentina.
 *
 * Lo que no se puede capturar todavía (una migración sin aplicar, la IA sin clave, el superadmin sin
 * credenciales) no rompe nada: queda anotado en docs/manual/pendientes.json y el manual muestra un recuadro
 * «Captura pendiente». Al volver a correr este script con la pantalla disponible, la figura se llena sola.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { DIR_CAPTURAS, PENDIENTES } from "./comun.mjs";
import { FIGURAS, dialogo } from "./figuras.mjs";

const BASE = (process.env.MANUAL_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const LIMITE_PNG = 260 * 1024;

const CREDENCIALES = {
  admin: { email: process.env.MANUAL_EMAIL, password: process.env.MANUAL_PASSWORD, vars: "MANUAL_EMAIL y MANUAL_PASSWORD" },
  vendedor: { email: process.env.MANUAL_EMAIL_VENDEDOR, password: process.env.MANUAL_PASSWORD_VENDEDOR, vars: "MANUAL_EMAIL_VENDEDOR y MANUAL_PASSWORD_VENDEDOR" },
  superadmin: { email: process.env.MANUAL_EMAIL_SUPERADMIN, password: process.env.MANUAL_PASSWORD_SUPERADMIN, vars: "MANUAL_EMAIL_SUPERADMIN y MANUAL_PASSWORD_SUPERADMIN" },
};

const soloArg = process.argv.find((a) => a.startsWith("--solo="));
const SOLO = soloArg ? new Set(soloArg.slice("--solo=".length).split(",").filter(Boolean)) : null;

const OPCIONES_CONTEXTO = {
  locale: "es-AR",
  timezoneId: "America/Argentina/Buenos_Aires",
  colorScheme: "light",
  reducedMotion: "reduce",
};

/** Lo que no es parte de la pantalla: el indicador de Next en desarrollo y los avisos «Se activa al aplicar la migración…» (son para quien administra, no para el manual). */
async function limpiarRuido(page) {
  await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }" }).catch(() => {});
  await page
    .evaluate(() => {
      for (const el of document.querySelectorAll('[role="status"]')) {
        if ((el.textContent ?? "").trim().startsWith("Se activa al aplicar la migración")) el.remove();
      }
    })
    .catch(() => {});
}

/** Espera a que desaparezca la pantalla de carga («Cargando la ficha…»). */
async function esperarCarga(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.locator('[role="status"]', { hasText: /^Cargando/ }).first().waitFor({ state: "detached", timeout: 120_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}

function ayudas(page) {
  const h = {
    async ir(ruta) {
      await page.goto(BASE + ruta, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await esperarCarga(page);
    },
    /** Desde una lista, entra a la ficha cuyo link tiene ese nombre. */
    async abrirFicha(lista, nombre) {
      await h.ir(lista);
      await page.getByRole("link", { name: nombre }).first().click({ timeout: 30_000 });
      await page.waitForURL(/\/(empresas|contactos)\/[0-9a-f-]{36}/, { timeout: 60_000 });
      await esperarCarga(page);
    },
    /** Desde la lista de oportunidades (todas), entra al detalle de la que tiene ese título; con `sufijo`, a una subpágina. */
    async abrirOportunidad(titulo, sufijo = "") {
      await h.ir("/oportunidades?vista=lista&estado=todos");
      await page.getByRole("link", { name: titulo }).first().click({ timeout: 30_000 });
      await page.waitForURL(/\/oportunidades\/[0-9a-f-]{36}/, { timeout: 60_000 });
      await esperarCarga(page);
      if (sufijo) await h.ir(new URL(page.url()).pathname + sufijo);
    },
    /** La primera oportunidad cerrada con ese estado ("ganada" o "perdida"). */
    async abrirOportunidadCerrada(estado) {
      await h.ir(`/oportunidades?vista=lista&estado=${estado}`);
      await page.locator('a[href^="/oportunidades/"]:visible').first().click({ timeout: 30_000 });
      await page.waitForURL(/\/oportunidades\/[0-9a-f-]{36}/, { timeout: 60_000 });
      await esperarCarga(page);
    },
  };
  return h;
}

/**
 * Ajusta el alto de la ventana para que el panel lateral o el modal salga entero y sin aire de sobra:
 *  - panel lateral (ocupa todo el alto): se achica la ventana para que su contenido desborde, se mide y se vuelve a
 *    abrir la ventana a ese alto;
 *  - modal centrado: alcanza con una ventana alta (su tope es el 90 % del alto).
 */
async function ajustarDialogo(page, ancho, tope) {
  const esPanel = await page.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].pop();
    return Boolean(d) && Math.abs(d.getBoundingClientRect().height - window.innerHeight) < 2;
  });
  if (!esPanel) {
    await page.setViewportSize({ width: ancho, height: 1200 });
    return;
  }
  await page.setViewportSize({ width: ancho, height: 300 });
  await page.waitForTimeout(300);
  const necesario = await page.evaluate(() => {
    const d = [...document.querySelectorAll('[role="dialog"]')].pop();
    const scroller = [...d.querySelectorAll("div")].find((e) => ["auto", "scroll"].includes(getComputedStyle(e).overflowY));
    return d.firstElementChild.offsetHeight + (scroller ? scroller.scrollHeight : d.scrollHeight);
  });
  await page.setViewportSize({ width: ancho, height: Math.min(Math.max(Math.ceil(necesario), 420), tope) });
}

async function guardar(destino, tomar) {
  const png = `${destino}.png`;
  const jpg = `${destino}.jpg`;
  fs.rmSync(png, { force: true });
  fs.rmSync(jpg, { force: true });
  await tomar({ path: png, type: "png" });
  if (fs.statSync(png).size > LIMITE_PNG) {
    // Para pantallas con mucha superficie, JPEG q85 pesa bastante menos y se lee igual.
    await tomar({ path: jpg, type: "jpeg", quality: 85 });
    if (fs.statSync(jpg).size < fs.statSync(png).size) fs.rmSync(png);
    else fs.rmSync(jpg);
  }
  return fs.existsSync(png) ? png : jpg;
}

async function sacar(browser, estados, fig) {
  const movil = Boolean(fig.movil);
  const ancho = movil ? 390 : (fig.ancho ?? 1440);
  const altoBase = movil ? 844 : typeof fig.alto === "number" ? fig.alto : 900;
  const context = await browser.newContext({
    ...OPCIONES_CONTEXTO,
    viewport: { width: ancho, height: altoBase },
    deviceScaleFactor: movil ? 2 : 1,
    isMobile: movil,
    hasTouch: movil,
    storageState: estados[fig.rol] ?? undefined,
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("theme", "light");
    } catch {}
  });
  const page = await context.newPage();
  try {
    const h = ayudas(page);
    if (fig.ir) await fig.ir(page, h);
    else await h.ir(fig.ruta);
    await limpiarRuido(page);
    await fig.esperar(page, h);
    if (fig.preparar) await fig.preparar(page, h);
    // Sin el puntero encima de nada (no queden tooltips a medio mostrar).
    await page.mouse.move(2, 2);
    await page.waitForTimeout(500);
    await limpiarRuido(page);

    const destino = path.join(DIR_CAPTURAS, fig.id);
    const dialogoAbierto = fig.elemento === dialogo;
    let archivo;
    if (fig.modo === "main") {
      const main = page.locator("[data-app-main]");
      if (fig.alto === "auto") {
        // El alto del contenido: donde termina lo último que hay, más el relleno de abajo (si no, una pantalla corta saldría con aire de sobra).
        const alto = await main.evaluate((el) => {
          const arriba = el.getBoundingClientRect().top - el.scrollTop;
          const fondo = Math.max(0, ...[...el.children].map((h) => h.getBoundingClientRect().bottom - arriba));
          return Math.ceil(fondo + parseFloat(getComputedStyle(el).paddingBottom || "0"));
        });
        await page.setViewportSize({ width: ancho, height: Math.min(Math.max(alto, 420), fig.altoMax ?? 1700) });
        await page.waitForTimeout(400);
      }
      archivo = await guardar(destino, (o) => main.screenshot(o));
    } else if (fig.modo === "elemento") {
      if (dialogoAbierto) {
        await ajustarDialogo(page, ancho, fig.alto ?? 1500);
        await page.waitForTimeout(400);
      }
      const el = fig.elemento(page, h);
      await el.waitFor({ state: "visible", timeout: 10_000 });
      const caja = fig.recorteAlto || fig.margen ? await el.boundingBox() : null;
      if (caja) {
        // Recorte con aire alrededor (`margen`, en px) y, si el elemento es muy alto, solo su parte de arriba (`recorteAlto`).
        const m = fig.margen ?? 0;
        const alto = Math.min(caja.height, fig.recorteAlto ?? Infinity);
        const clip = { x: Math.max(0, caja.x - m), y: Math.max(0, caja.y - m), width: caja.width + 2 * m, height: alto + 2 * m };
        archivo = await guardar(destino, (o) => page.screenshot({ ...o, clip }));
      } else {
        archivo = await guardar(destino, (o) => el.screenshot(o));
      }
    } else {
      archivo = await guardar(destino, (o) => page.screenshot(o));
    }
    return { ok: true, archivo };
  } finally {
    await context.close();
  }
}

/** Entra con el formulario de /login y devuelve el estado de la sesión (cookies), o lanza. */
async function iniciarSesion(browser, nombre) {
  const { email, password, vars } = CREDENCIALES[nombre];
  if (!email || !password) throw new Error(`Faltan las variables de entorno ${vars}`);
  const context = await browser.newContext({ ...OPCIONES_CONTEXTO, viewport: { width: 1440, height: 900 } });
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

function leerPendientes() {
  try {
    return JSON.parse(fs.readFileSync(PENDIENTES, "utf8")).pendientes ?? [];
  } catch {
    return [];
  }
}

async function main() {
  fs.mkdirSync(DIR_CAPTURAS, { recursive: true });
  const figuras = FIGURAS.filter((f) => !SOLO || SOLO.has(f.id));
  if (SOLO) for (const id of SOLO) if (!FIGURAS.some((f) => f.id === id)) console.warn(`[manual] No existe la figura "${id}".`);

  const browser = await chromium.launch();
  const estados = {};
  const falloSesion = {};
  for (const nombre of ["admin", "vendedor", "superadmin"]) {
    if (!figuras.some((f) => f.rol === nombre)) continue;
    try {
      estados[nombre] = await iniciarSesion(browser, nombre);
      console.log(`[manual] Sesión de ${nombre}: ok`);
    } catch (e) {
      falloSesion[nombre] = e.message.split("\n")[0];
      console.warn(`[manual] Sesión de ${nombre}: ${falloSesion[nombre]}`);
    }
  }

  const resultados = new Map();
  for (const fig of figuras) {
    if (fig.rol !== "publico" && falloSesion[fig.rol]) {
      if (fig.pendiente) for (const ext of ["png", "jpg"]) fs.rmSync(path.join(DIR_CAPTURAS, `${fig.id}.${ext}`), { force: true });
      resultados.set(fig.id, { ok: false, motivo: fig.rol === "superadmin" ? fig.pendiente : falloSesion[fig.rol] });
      console.log(`  pendiente  ${fig.id}  (${falloSesion[fig.rol]})`);
      continue;
    }
    try {
      const r = await sacar(browser, estados, fig);
      resultados.set(fig.id, r);
      const kb = Math.round(fs.statSync(r.archivo).size / 1024);
      console.log(`  ok         ${fig.id}  ${path.basename(r.archivo)}  ${kb} KB`);
    } catch (e) {
      // Una figura que se sabe pendiente no puede conservar una imagen vieja (sería mostrar una pantalla que no existe).
      if (fig.pendiente) for (const ext of ["png", "jpg"]) fs.rmSync(path.join(DIR_CAPTURAS, `${fig.id}.${ext}`), { force: true });
      const motivo = fig.pendiente ?? `No se encontró lo esperado en pantalla (${e.message.split("\n")[0].slice(0, 120)})`;
      resultados.set(fig.id, { ok: false, motivo, causa: e.message.split("\n")[0] });
      console.log(`  pendiente  ${fig.id}  ${fig.pendiente ? "(" + fig.pendiente + ")" : "ERROR: " + e.message.split("\n")[0]}`);
    }
  }
  await browser.close();

  // pendientes.json: lo que esta corrida no pudo capturar; el resto de las figuras (si se corrió con --solo) se conserva.
  const previos = leerPendientes().filter((p) => !resultados.has(p.id));
  const nuevos = figuras
    .filter((f) => !resultados.get(f.id)?.ok)
    .map((f) => ({ id: f.id, capitulo: f.cap, titulo: f.titulo, motivo: resultados.get(f.id).motivo }));
  const pendientes = [...previos, ...nuevos].sort((a, b) => a.capitulo - b.capitulo || a.id.localeCompare(b.id));
  fs.writeFileSync(PENDIENTES, JSON.stringify({ pendientes }, null, 2) + "\n");

  const ok = [...resultados.values()].filter((r) => r.ok).length;
  console.log(`\n[manual] ${ok} capturadas, ${nuevos.length} pendientes (${path.relative(process.cwd(), PENDIENTES)}).`);
  const errores = nuevos.filter((n) => !FIGURAS.find((f) => f.id === n.id).pendiente && resultados.get(n.id).causa);
  if (errores.length) console.warn(`[manual] Ojo: ${errores.length} figura(s) fallaron por algo distinto de una migración pendiente: ${errores.map((e) => e.id).join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
