/**
 * Guarda de archivos congelados (CRM 2.0, Etapa 0).
 *
 * La landing (`/`) y las pantallas previas al ingreso (`/login`, `/recuperar`, `/definir-clave`) no tienen que
 * cambiar mientras se rediseña el CRM. Este script falla (exit 1) si:
 *   1. el sha256 de algún archivo congelado difiere del manifiesto (design-system/crm-2/guard/frozen-files.json);
 *   2. aparece o desaparece un archivo dentro de una carpeta congelada (src/components/landing/);
 *   3. `git diff <base>...HEAD` o el árbol de trabajo (cambios sin commitear, incluidos archivos nuevos) tocan
 *      una ruta congelada. <base> = GUARD_BASE (variable de entorno) > `base` del manifiesto > `main`.
 *      Si no se puede resolver la base (checkout superficial, sin `main`) FALLA, salvo GUARD_ALLOW_NO_BASE=1;
 *   4. src/app/(app)/crm.css tiene algo que no cuelgue de `[data-crm]` o un at-rule global.
 *
 *   node scripts/guard/frozen-files.mjs             verifica
 *   node scripts/guard/frozen-files.mjs --update    regenera el manifiesto. SOLO para un cambio deliberado y aprobado
 *                                                   de un archivo congelado (procedimiento: README de design-system/crm-2/).
 *                                                   Con GUARD_BASE=<commit> fija ese commit como `base` del manifiesto.
 *
 * Los hashes se calculan con los saltos de línea normalizados a LF: el mismo archivo da el mismo hash en
 * Windows (autocrlf) y en Linux. El manifiesto NO se protege a sí mismo: lo protege la revisión del PR.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFIESTO = path.join(RAIZ, "design-system", "crm-2", "guard", "frozen-files.json");
const CRM_CSS = "src/app/(app)/crm.css";

/**
 * Archivos sueltos congelados. Es la clausura transitiva de imports de: la landing, el layout raíz, /login,
 * /recuperar, /definir-clave, el proxy y las rutas /auth/* (más globals.css e icon.svg, que no se importan desde TS).
 * Motivo de cada grupo: design-system/crm-2/README.md. Si un archivo nuevo entra a esa clausura, agregarlo acá.
 */
const ARCHIVOS = [
  // Landing y raíz compartida
  "src/app/page.tsx",
  "src/app/layout.tsx",
  "src/app/globals.css",
  "src/app/icon.svg",
  "src/components/Logo.tsx",
  "src/lib/brand.ts",
  "src/lib/contacto.ts",
  "src/lib/utils.ts",
  // Lo que el layout raíz renderiza para toda ruta (Toast y Tooltip) y primitivos de las pantallas de acceso
  "src/components/ui/Toast.tsx",
  "src/components/ui/Tooltip.tsx",
  "src/components/ui/UIComponents.tsx",
  // Pantallas previas al ingreso (fuera de alcance) y su marco
  "src/app/login/page.tsx",
  "src/app/login/LoginForm.tsx",
  "src/app/login/actions.ts",
  "src/app/recuperar/page.tsx",
  "src/app/recuperar/RecuperarForm.tsx",
  "src/app/recuperar/actions.ts",
  "src/app/definir-clave/page.tsx",
  "src/app/definir-clave/DefinirClaveForm.tsx",
  "src/app/definir-clave/actions.ts",
  "src/components/AuthCard.tsx",
  "src/components/Cancha.tsx",
  // Rutas de autenticación, proxy y lo que importan (sesión, permisos, Supabase, correo de acceso)
  "src/proxy.ts",
  "src/app/auth/confirm/route.ts",
  "src/app/auth/signout/route.ts",
  "src/lib/sesion.ts",
  "src/lib/permisos.ts",
  "src/lib/cuentas.ts",
  "src/lib/supabase/server.ts",
  "src/lib/supabase/middleware.ts",
  "src/lib/supabase/admin.ts",
  "src/lib/supabase/types.ts",
  "src/lib/email/enviar.ts",
  "src/lib/email/layout.ts",
  "src/lib/email/logo.ts",
  "src/lib/email/plantillas.ts",
];
/** Carpetas congeladas completas (cada archivo que tengan, recursivamente). */
const CARPETAS = ["src/components/landing/"];

const posix = (p) => p.split(path.sep).join("/");

function sha256(archivo) {
  const texto = fs.readFileSync(path.join(RAIZ, archivo), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(texto).digest("hex");
}

function listar(carpeta) {
  const out = [];
  const visitar = (dir) => {
    for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
      const rel = posix(path.join(dir, e.name));
      if (e.isDirectory()) visitar(rel);
      else out.push(rel);
    }
  };
  visitar(carpeta.replace(/\/$/, ""));
  return out;
}

function archivosActuales() {
  return [...new Set([...ARCHIVOS, ...CARPETAS.flatMap(listar)])].sort();
}

const esCongelado = (ruta) => ARCHIVOS.includes(ruta) || CARPETAS.some((c) => ruta.startsWith(c));

function git(...args) {
  return execFileSync("git", args, { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
const lineas = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function resolverRef(ref) {
  try {
    return git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`).trim();
  } catch {
    return null;
  }
}

function leerManifiesto() {
  return JSON.parse(fs.readFileSync(MANIFIESTO, "utf8"));
}

/**
 * crm.css solo puede tener selectores bajo [data-crm] (o `.dark [data-crm]`) y at-rules que no sean globales:
 * @media/@supports (con selectores bajo [data-crm] adentro) y @keyframes con prefijo `crm-`.
 * Prohibidos: @theme, @layer, @property, @font-face, @import, @tailwind, @apply, @keyframes sin `crm-`.
 */
function revisarCrmCss() {
  const errores = [];
  const ruta = path.join(RAIZ, CRM_CSS);
  if (!fs.existsSync(ruta)) return [`FALTA       ${CRM_CSS}`];
  const css = fs.readFileSync(ruta, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const bajoCrm = (sel) => sel.split(",").every((s) => /^(\.dark\s+)?\[data-crm\](?![\w-])/.test(s.trim()));
  const recorrer = (texto, dentroDeKeyframes) => {
    let i = 0;
    while (i < texto.length) {
      const abre = texto.indexOf("{", i);
      const punto = texto.indexOf(";", i);
      if (abre === -1) break;
      if (punto !== -1 && punto < abre) {
        const at = texto.slice(i, punto).trim();
        if (at.startsWith("@")) errores.push(`CRM-CSS     at-rule global no permitido: ${at.split(/\s/)[0]}`);
        i = punto + 1;
        continue;
      }
      let prof = 1;
      let j = abre + 1;
      while (j < texto.length && prof) {
        if (texto[j] === "{") prof++;
        else if (texto[j] === "}") prof--;
        j++;
      }
      const prelude = texto.slice(i, abre).trim();
      const cuerpo = texto.slice(abre + 1, j - 1);
      if (prelude.startsWith("@")) {
        const nombre = prelude.split(/\s/)[0];
        if (nombre === "@keyframes") {
          if (!/^@keyframes\s+crm-/.test(prelude)) errores.push(`CRM-CSS     ${prelude}: los @keyframes deben llamarse crm-*`);
        } else if (nombre === "@media" || nombre === "@supports") recorrer(cuerpo, false);
        else errores.push(`CRM-CSS     at-rule no permitido: ${nombre}`);
      } else if (!dentroDeKeyframes && !bajoCrm(prelude)) errores.push(`CRM-CSS     selector fuera de [data-crm]: ${prelude.slice(0, 60)}`);
      i = j;
    }
  };
  recorrer(css, false);
  return errores;
}

if (process.argv.includes("--update")) {
  const previo = fs.existsSync(MANIFIESTO) ? leerManifiesto() : {};
  let base = previo.base ?? null;
  if (process.env.GUARD_BASE) {
    base = resolverRef(process.env.GUARD_BASE);
    if (!base) {
      console.error(`[frozen-files] GUARD_BASE=${process.env.GUARD_BASE} no se puede resolver a un commit.`);
      process.exit(1);
    }
  }
  const archivos = Object.fromEntries(archivosActuales().map((f) => [f, sha256(f)]));
  fs.mkdirSync(path.dirname(MANIFIESTO), { recursive: true });
  const salida = { algoritmo: "sha256 (saltos de línea normalizados a LF)", ...(base ? { base } : {}), archivos };
  fs.writeFileSync(MANIFIESTO, JSON.stringify(salida, null, 2) + "\n");
  console.log(`[frozen-files] Manifiesto regenerado: ${Object.keys(archivos).length} archivos${base ? `, base ${base.slice(0, 10)}` : ""}.`);
  console.log("[frozen-files] Recordá: esto solo corresponde a un cambio deliberado y aprobado de un archivo congelado.");
  process.exit(0);
}

const errores = [];

// 1 y 2: hashes y altas/bajas.
if (!fs.existsSync(MANIFIESTO)) {
  console.error(`[frozen-files] Falta el manifiesto ${posix(path.relative(RAIZ, MANIFIESTO))}.`);
  process.exit(1);
}
const manifiesto = leerManifiesto();
const esperado = manifiesto.archivos;
const actuales = archivosActuales();
for (const f of Object.keys(esperado)) {
  if (!fs.existsSync(path.join(RAIZ, f))) errores.push(`ELIMINADO   ${f}`);
  else if (sha256(f) !== esperado[f]) errores.push(`MODIFICADO  ${f}`);
}
for (const f of actuales) if (!(f in esperado)) errores.push(`NUEVO       ${f} (no está en el manifiesto)`);

// 3: git. Contra la base (main por defecto) y contra el árbol de trabajo. Sin base resoluble: falla (a prueba de fallos).
const rutasGit = new Set();
const baseNombre = process.env.GUARD_BASE || manifiesto.base || "main";
const permitirSinBase = process.env.GUARD_ALLOW_NO_BASE === "1";
let baseOk = false;
try {
  const candidatos = process.env.GUARD_BASE || manifiesto.base ? [baseNombre] : [baseNombre, `origin/${baseNombre}`];
  const base = candidatos.map(resolverRef).find(Boolean);
  if (base) {
    baseOk = true;
    for (const r of lineas(git("diff", "--name-only", `${base}...HEAD`))) rutasGit.add(r);
  } else if (permitirSinBase) {
    console.warn(`[frozen-files] Aviso: no se pudo resolver la base \`${baseNombre}\`; se omite el diff (GUARD_ALLOW_NO_BASE=1). Los hashes siguen valiendo.`);
  } else {
    errores.push(`SIN BASE    no se puede resolver \`${baseNombre}\` (¿checkout superficial?). Traerla (git fetch origin ${baseNombre}), fijar GUARD_BASE, o GUARD_ALLOW_NO_BASE=1 para omitir este chequeo.`);
  }
  for (const r of lineas(git("diff", "--name-only", "HEAD"))) rutasGit.add(r);
  for (const l of lineas(git("status", "--porcelain", "--untracked-files=all"))) rutasGit.add(l.slice(3).replace(/^"|"$/g, "").split(" -> ").pop());
} catch (e) {
  if (!permitirSinBase) errores.push(`GIT         no se pudo consultar git (${String(e.message).split("\n")[0]}); GUARD_ALLOW_NO_BASE=1 para omitir.`);
  else console.warn(`[frozen-files] Aviso: no se pudo consultar git; solo se verifican los hashes (GUARD_ALLOW_NO_BASE=1).`);
}
for (const r of [...rutasGit].sort()) if (esCongelado(r)) errores.push(`GIT         ${r} (tocado respecto de ${baseNombre} o sin commitear)`);

// 4: crm.css
errores.push(...revisarCrmCss());

if (errores.length) {
  console.error("[frozen-files] FALLA:");
  for (const e of errores) console.error("  " + e);
  console.error("[frozen-files] Si el cambio de un archivo congelado es deliberado y aprobado: ver el procedimiento en design-system/crm-2/README.md.");
  process.exit(1);
}
console.log(`[frozen-files] OK: ${actuales.length} archivos congelados intactos${baseOk ? ` (y ningún cambio respecto de ${baseNombre})` : ""}; crm.css solo bajo [data-crm].`);
