/**
 * Arma el PDF del manual: docs/Manual-de-usuario-Tuco-y-Nito.pdf
 *
 *   npm run manual:pdf
 *
 * Qué hace, en orden:
 *  1. Lee docs/manual/manual.html (tapa, índice y el hueco `<!--#capitulos-->`) y le suma cada capítulo de
 *     docs/manual/capitulos/*.html, en orden de nombre.
 *  2. Completa lo que sale del código y no se escribe a mano: la matriz de permisos y la tabla de pantallas por
 *     rol (se leen de src/lib/permisos.ts y src/lib/navegacion.ts: siempre coinciden con la aplicación).
 *  3. Pone cada figura: la captura de docs/manual/capturas/ si existe; si no, el recuadro «Captura pendiente»
 *     (el motivo sale de docs/manual/pendientes.json).
 *  4. Arma el índice con los números de página REALES: cada capítulo empieza en página nueva, así que se
 *     imprime cada uno por separado, se cuentan sus páginas y se suman. Al final se comprueba que la suma
 *     coincide con las páginas del PDF completo (si no, falla).
 *  5. Imprime con Chromium (A4, fondos, encabezado y pie como márgenes de página de CSS) y deja el PDF.
 *
 * No necesita internet salvo la primera vez (las fuentes, ver fuentes.mjs). No necesita la aplicación andando.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DIR_CAPITULOS,
  DIR_CAPTURAS,
  HTML_FUENTE,
  HTML_GENERADO,
  PDF_SALIDA,
  PENDIENTES,
  RAIZ,
} from "./comun.mjs";
import { asegurarFuentes } from "./fuentes.mjs";
import { FIGURA_POR_ID } from "./figuras.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ───────────────────────── Dimensiones de las imágenes (para fijar el tamaño en el papel)

function medida(archivo) {
  const b = fs.readFileSync(archivo);
  if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  // JPEG: buscar el marcador SOF.
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marca = b[i + 1];
    if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`No se pudo leer el tamaño de ${archivo}`);
}

// ───────────────────────── Figuras

const ANCHO_PAGINA_MM = 170;
const ALTO_MAX_FIGURA_MM = 110;
/** Escala común a todas las capturas: 1218 px de ancho (el área de contenido del CRM 2.0 en 1440: la ventana menos el menú lateral) = 170 mm. Así el texto de cada figura tiene el mismo tamaño. */
const MM_POR_PX = ANCHO_PAGINA_MM / 1218;
/** Un recuadro de pendiente no lleva información: conserva la proporción de la captura pero no ocupa más que esto de alto. */
const ALTO_MAX_PENDIENTE_MM = 80;

function leerPendientes() {
  try {
    return new Map(JSON.parse(fs.readFileSync(PENDIENTES, "utf8")).pendientes.map((p) => [p.id, p]));
  } catch {
    return new Map();
  }
}

/** El tamaño en el papel de una figura: a escala común (MM_POR_PX); si queda más alta que la página, se achica. */
function anchoMm(ratio, tope = ANCHO_PAGINA_MM, anchoPx = 1218) {
  // Las figuras de a dos (tope chico) son más bajas todavía: tienen que entrar al lado de otra.
  const altoMax = tope <= 80 ? 92 : ALTO_MAX_FIGURA_MM;
  return Math.round(Math.min(tope, altoMax * ratio, anchoPx * MM_POR_PX) * 10) / 10;
}

const ICONO_CAMARA = `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h2.2l1.3-2h7l1.3 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.6"/></svg>`;

function armarFigura(id, titulo, numero, pendientes, usadas, avisos, tope) {
  const def = FIGURA_POR_ID.get(id);
  if (!def) avisos.push(`La figura "${id}" está en un capítulo pero no en scripts/manual/figuras.mjs.`);
  usadas.add(id);
  const archivo = ["png", "jpg"].map((e) => path.join(DIR_CAPTURAS, `${id}.${e}`)).find((f) => fs.existsSync(f));
  let marco;
  let mm;
  if (archivo) {
    const { w, h } = medida(archivo);
    mm = anchoMm(w / h, tope, (w / (def?.movil ? 2 : 1)) * (def?.zoom ?? 1));
    marco = `<div class="fig-marco" style="width:${mm}mm"><img src="capturas/${path.basename(archivo)}" alt="${esc(titulo)}"></div>`;
  } else {
    const [aw, ah] = (def?.aspecto ?? "1218/800").split("/").map(Number);
    mm = Math.round(Math.min(anchoMm(aw / ah, tope, aw * (def?.zoom ?? 1)), ALTO_MAX_PENDIENTE_MM * (aw / ah)) * 10) / 10;
    const p = pendientes.get(id);
    const motivo = p?.motivo ?? "Se completa sola al correr npm run manual con la pantalla disponible.";
    marco = `<div class="fig-marco fig-pendiente" style="width:${mm}mm;aspect-ratio:${aw}/${ah}">${ICONO_CAMARA}<div class="t">Captura pendiente</div><div class="m">${esc(motivo)}</div><div class="id">figura: ${esc(id)}</div></div>`;
  }
  return { html: `<figure class="fig" data-fig="${esc(id)}">${marco}<figcaption data-num="${numero}">${titulo}</figcaption></figure>`, pendiente: !archivo, mm };
}

// ───────────────────────── Tablas que salen del código

async function cargarCodigo() {
  const permisos = await import(pathToFileURL(path.join(RAIZ, "src", "lib", "permisos.ts")).href);
  const nav = await import(pathToFileURL(path.join(RAIZ, "src", "lib", "navegacion.ts")).href);
  return { permisos, nav };
}

const ORDEN_ROLES = ["Administrador", "Responsable comercial", "Vendedor", "Solo lectura"];

function tablaPermisos({ permisos }) {
  const roles = ORDEN_ROLES.map((n) => permisos.ROLES_POR_DEFECTO.find((r) => r.nombre === n));
  if (roles.some((r) => !r)) throw new Error("ROLES_POR_DEFECTO ya no tiene los cuatro roles que el manual describe: revisá el capítulo 3.");
  // Un <tbody> por grupo: así el encabezado de un grupo ("Alertas") nunca queda solo al final de una página.
  let html = `<table class="tabla compacta"><thead><tr><th>Permiso</th><th>Qué permite</th>${roles.map((r) => `<th class="c">${esc(r.nombre)}</th>`).join("")}</tr></thead>`;
  let grupo = "";
  for (const p of permisos.PERMISOS) {
    if (p.grupo !== grupo) {
      if (grupo) html += "</tbody>";
      grupo = p.grupo;
      html += `<tbody class="grupo"><tr class="grupo"><td colspan="${2 + roles.length}">${esc(grupo)}</td></tr>`;
    }
    html += `<tr><td><strong>${esc(p.etiqueta)}</strong></td><td>${esc(p.descripcion)}</td>${roles
      .map((r) => (r.permisos.includes(p.clave) ? `<td class="c si">Sí</td>` : `<td class="c no">No</td>`))
      .join("")}</tr>`;
  }
  html += `</tbody><tbody class="grupo"><tr class="grupo"><td colspan="2">Total de permisos</td>${roles.map((r) => `<td class="c">${r.permisos.length} de ${permisos.PERMISOS.length}</td>`).join("")}</tr>`;
  return html + "</tbody></table>";
}

function tablaPantallas({ permisos, nav }) {
  const roles = ORDEN_ROLES.map((n) => permisos.ROLES_POR_DEFECTO.find((r) => r.nombre === n));
  let html = `<table class="tabla compacta"><thead><tr><th>Pantalla</th><th>Para qué sirve</th>${roles.map((r) => `<th class="c">${esc(r.nombre)}</th>`).join("")}</tr></thead><tbody>`;
  for (const r of nav.RUTAS) {
    html += `<tr><td><strong>${esc(r.label)}</strong></td><td>${esc(r.pista)}</td>${roles
      .map((rol) => (nav.tieneTodos(rol.permisos, r.permisos) ? `<td class="c si">Sí</td>` : `<td class="c no">No</td>`))
      .join("")}</tr>`;
  }
  return html + "</tbody></table>";
}

function tablaRolesResumen({ permisos }) {
  const roles = ORDEN_ROLES.map((n) => permisos.ROLES_POR_DEFECTO.find((r) => r.nombre === n));
  const cartera = (r) => (r.permisos.includes("clientes.ver_todos") ? "Toda la cartera" : "Solo la propia");
  let html = `<table class="tabla"><thead><tr><th>Rol</th><th>Permisos</th><th>Cartera</th><th>Para qué está pensado</th></tr></thead><tbody>`;
  for (const r of roles) {
    html += `<tr><td><strong>${esc(r.nombre)}</strong></td><td class="n">${r.permisos.length} de ${permisos.PERMISOS.length}</td><td>${cartera(r)}</td><td>${esc(r.descripcion)}</td></tr>`;
  }
  return html + "</tbody></table>";
}

// ───────────────────────── Capítulos

function leerCapitulos() {
  const archivos = fs.readdirSync(DIR_CAPITULOS).filter((f) => /^\d\d.*\.html$/.test(f)).sort();
  if (!archivos.length) throw new Error("No hay capítulos en docs/manual/capitulos/");
  return archivos.map((f) => ({ archivo: f, html: fs.readFileSync(path.join(DIR_CAPITULOS, f), "utf8") }));
}

function atributo(tag, nombre) {
  const m = new RegExp(`${nombre}="([^"]*)"`).exec(tag);
  return m ? m[1] : "";
}

function procesarCapitulo(cap, ctx) {
  const abre = /<section\b[^>]*class="cap[^"]*"[^>]*>/.exec(cap.html);
  if (!abre) throw new Error(`${cap.archivo}: falta <section class="cap" id=… data-num=… data-titulo=…>`);
  const tag = abre[0];
  const meta = {
    id: atributo(tag, "id"),
    num: atributo(tag, "data-num"),
    titulo: atributo(tag, "data-titulo"),
    bajada: atributo(tag, "data-bajada"),
    parte: atributo(tag, "data-parte"),
    apendice: /class="cap[^"]*apendice/.test(tag),
  };
  if (!meta.id || !meta.num || !meta.titulo) throw new Error(`${cap.archivo}: la sección necesita id, data-num y data-titulo.`);
  const rotulo = meta.apendice ? `Apéndice ${meta.num}` : `Capítulo ${meta.num}`;
  const cabecera = `<header class="cap-cab"><p class="eyebrow">${esc(rotulo)}${meta.parte && !meta.apendice ? ` · ${esc(meta.parte)}` : ""}</p><h1>${meta.titulo}</h1>${meta.bajada ? `<p class="bajada">${meta.bajada}</p>` : ""}</header>`;
  let html = cap.html.replace(tag, () => tag + cabecera);

  // Figuras (se numeran por capítulo: 5.1, 5.2…). `data-ancho="par"` las achica para ponerlas de a dos.
  let n = 0;
  html = html.replace(/<figure\b([^>]*)data-fig="([^"]+)"([^>]*)>\s*<figcaption>([\s\S]*?)<\/figcaption>\s*<\/figure>/g, (_, a, id, b, titulo) => {
    n++;
    // data-ancho="par" las achica para ponerlas de a dos; data-ancho="NN" fija el ancho máximo en mm.
    const ancho = /data-ancho="(\d+)"/.exec(a + b);
    const par = /data-ancho="par"/.test(a + b);
    const r = armarFigura(id, titulo, `${meta.num}.${n}`, ctx.pendientes, ctx.figurasUsadas, ctx.avisos, par ? 80 : ancho ? Number(ancho[1]) : ANCHO_PAGINA_MM);
    if (r.pendiente) ctx.pendientesEnUso.push({ id, capitulo: meta.num, titulo: titulo.replace(/<[^>]+>/g, "") });
    return r.html;
  });

  // Tablas que salen del código.
  html = html
    .replace("<!--MATRIZ_PERMISOS-->", () => tablaPermisos(ctx.codigo))
    .replace("<!--TABLA_PANTALLAS-->", () => tablaPantallas(ctx.codigo))
    .replace("<!--ROLES_RESUMEN-->", () => tablaRolesResumen(ctx.codigo));

  // Las tablas cortas no se parten entre páginas.
  html = html.replace(/<table class="tabla([^"]*)">([\s\S]*?)<\/table>/g, (t, clases, cuerpo) => ((cuerpo.match(/<tr/g) ?? []).length <= 6 ? `<table class="tabla${clases} corta">${cuerpo}</table>` : t));
  return { ...meta, html };
}

function armarIndice(capitulos, paginas) {
  let html = "";
  let parte = null;
  let abierto = false;
  for (const c of capitulos) {
    const p = c.parte || (c.apendice ? "Apéndices" : "");
    if (p !== parte) {
      if (abierto) html += "</ol>";
      html += `${p ? `<p class="parte">${esc(p)}</p>` : ""}<ol>`;
      abierto = true;
      parte = p;
    }
    const pagina = paginas ? paginas.get(c.id) : "00";
    html += `<li><span class="n">${esc(c.num)}</span><span class="t">${c.titulo}</span><span class="puntos"></span><span class="p">${pagina}</span></li>`;
  }
  return html + (abierto ? "</ol>" : "");
}

const AVISO_PENDIENTES = `<p>Los recuadros con la leyenda <em>Captura pendiente</em> marcan pantallas que todavía no se pudieron fotografiar: los botones de inteligencia artificial, que se activan al cargar la clave del servicio (<code>ANTHROPIC_API_KEY</code>), y el panel de plataforma, que solo ve la cuenta de superadministrador. El manual se regenera con un solo comando (<code>npm run manual</code>) y esas figuras se completan solas.</p>`;

// ───────────────────────── Marcadores del PDF

const decodificar = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

/**
 * Chromium pierde el espacio de los títulos que ocupan dos renglones en los marcadores del PDF ("Manual deusuario").
 * Se reescriben con los títulos reales del HTML usando PyMuPDF (scripts/manual/outline.py). Sin Python o sin PyMuPDF
 * el PDF queda como lo dejó Chromium y se avisa; no es un error.
 */
function arreglarMarcadores(html) {
  const titulos = [...html.matchAll(/<h([123])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => decodificar(m[2].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim());
  const json = path.join(path.dirname(HTML_GENERADO), "_titulos.generado.json");
  fs.writeFileSync(json, JSON.stringify(titulos));
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "outline.py");
  for (const py of ["python", "python3"]) {
    const r = spawnSync(py, [script, PDF_SALIDA, json], { encoding: "utf8" });
    if (r.error) continue;
    fs.rmSync(json, { force: true });
    if (r.status === 0) return console.log(`[manual] Marcadores del PDF: ${r.stdout.trim()}`);
    return console.warn(`[manual] AVISO: no se pudieron reescribir los marcadores del PDF (${(r.stderr || r.stdout).trim().split("\n").pop()}). Instalá PyMuPDF: pip install pymupdf.`);
  }
  fs.rmSync(json, { force: true });
  console.warn("[manual] AVISO: no hay Python con PyMuPDF; los marcadores del PDF pueden perder un espacio en los títulos largos.");
}

// ───────────────────────── Impresión

const OPCIONES_PDF = { format: "A4", printBackground: true, preferCSSPageSize: true, outline: true, tagged: true };

function contarPaginas(buf) {
  return (buf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

async function paginasDe(page, ids) {
  await page.evaluate((visibles) => {
    for (const el of document.querySelectorAll(".tapa, .toc, .cap")) el.style.display = visibles.includes(el.id) ? "" : "none";
  }, ids);
  return contarPaginas(await page.pdf(OPCIONES_PDF));
}

async function main() {
  await asegurarFuentes();
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));
  const fecha = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });

  const ctx = {
    codigo: await cargarCodigo(),
    pendientes: leerPendientes(),
    figurasUsadas: new Set(),
    pendientesEnUso: [],
    avisos: [],
  };
  const capitulos = leerCapitulos().map((c) => procesarCapitulo(c, ctx));
  const ids = capitulos.map((c) => c.id);
  if (new Set(ids).size !== ids.length) throw new Error("Hay capítulos con el mismo id.");
  for (const id of FIGURA_POR_ID.keys()) if (!ctx.figurasUsadas.has(id)) ctx.avisos.push(`La figura "${id}" está en figuras.mjs pero ningún capítulo la usa.`);

  const fuente = fs.readFileSync(HTML_FUENTE, "utf8").replace("{{VERSION}}", () => esc(pkg.version)).replace("{{FECHA}}", () => esc(fecha));
  const armar = (paginas) =>
    fuente
      .replace("<!--#capitulos-->", () => capitulos.map((c) => c.html).join("\n"))
      .replace("<!--TOC-->", () => armarIndice(capitulos, paginas))
      .replace("<!--AVISO_PENDIENTES-->", () => (ctx.pendientesEnUso.length ? AVISO_PENDIENTES : ""));
  const cargar = async (page, html) => {
    fs.writeFileSync(HTML_GENERADO, html);
    await page.goto(pathToFileURL(HTML_GENERADO).href, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => {}))));
    });
    await page.emulateMedia({ media: "print" });
  };

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    // Pasada 1: páginas de cada parte (tapa + índice, y cada capítulo) → número de página de cada capítulo.
    await cargar(page, armar(null));
    const frente = await paginasDe(page, ["tapa", "indice"]);
    const paginas = new Map();
    let siguiente = frente + 1;
    let suma = frente;
    for (const c of capitulos) {
      const n = await paginasDe(page, [c.id]);
      paginas.set(c.id, String(siguiente));
      c.paginas = n;
      siguiente += n;
      suma += n;
    }

    // Pasada 2: el documento entero, ya con los números del índice.
    await cargar(page, armar(paginas));
    await page.evaluate(() => {
      for (const el of document.querySelectorAll(".tapa, .toc, .cap")) el.style.display = "";
    });
    fs.mkdirSync(path.dirname(PDF_SALIDA), { recursive: true });
    const pdf = await page.pdf({ ...OPCIONES_PDF, path: PDF_SALIDA });
    const total = contarPaginas(pdf);
    arreglarMarcadores(armar(paginas));

    if (total !== suma) {
      throw new Error(`El índice no coincide: la suma de las partes da ${suma} páginas y el PDF completo tiene ${total}. Algún capítulo no arranca en página nueva.`);
    }
    const mb = (fs.statSync(PDF_SALIDA).size / 1024 / 1024).toFixed(2);
    console.log(`[manual] ${path.relative(RAIZ, PDF_SALIDA)}: ${total} páginas, ${mb} MB (el índice coincide con el PDF: ${frente} de tapa e índice + ${capitulos.length} capítulos).`);
    if (ctx.pendientesEnUso.length) {
      console.log(`[manual] ${ctx.pendientesEnUso.length} figuras con «Captura pendiente»:`);
      for (const p of ctx.pendientesEnUso) console.log(`   cap. ${p.capitulo}  ${p.id}`);
    } else console.log("[manual] Todas las figuras tienen su captura.");
    for (const a of ctx.avisos) console.warn(`[manual] AVISO: ${a}`);
    if (Number(mb) > 15) console.warn("[manual] AVISO: el PDF pesa más de 15 MB; conviene achicar las capturas.");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
