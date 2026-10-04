import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Guarda visual de las pantallas públicas (CRM 2.0, Etapa 0): `/`, `/login` y `/recuperar`.
 * Cómo se usa y qué neutraliza: design-system/crm-2/README.md.
 *
 *   GUARD_BASE_URL       app ya levantada (build de producción). Si falta, este config hace
 *                        `next build` + `next start` en el puerto GUARD_PORT (3199 por defecto).
 *                        No puede verificar qué build es: es responsabilidad de quien la levantó.
 *   GUARD_SKIP_BUILD=1   solo `next start` (usa el .next que ya existe). Falla si ese build es más viejo que el
 *                        último cambio en src/ (GUARD_ALLOW_STALE=1 para permitirlo).
 *   GUARD_PORT           puerto del servidor propio. Si ya hay algo escuchando ahí, FALLA (no se reutiliza un
 *                        servidor que podría ser de otra versión) salvo GUARD_REUSE_SERVER=1.
 *
 * La landing pregunta a Supabase si hay sesión: hace falta el .env del proyecto (NEXT_PUBLIC_SUPABASE_URL y
 * la clave pública). Sin sesión la landing muestra «Ingresar»: esa es la versión que se fotografía.
 * Las imágenes baseline viven en design-system/crm-2/guard/landing/ y SE COMMITEAN.
 */
const port = process.env.GUARD_PORT ?? "3199";
const externa = process.env.GUARD_BASE_URL?.replace(/\/$/, "");
const baseURL = externa ?? `http://localhost:${port}`;
const saltearBuild = Boolean(process.env.GUARD_SKIP_BUILD);
const arranque = saltearBuild ? "" : "npm run build && ";

/** El mtime más reciente de un árbol de archivos (ms). */
function ultimoCambio(dir: string): number {
  let max = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    max = Math.max(max, e.isDirectory() ? ultimoCambio(p) : fs.statSync(p).mtimeMs);
  }
  return max;
}

// Sin build nuevo, el .next existente tiene que ser posterior al último cambio de src/: si no, la guarda
// fotografiaría código que ya no es el del árbol.
if (!externa && saltearBuild && process.env.GUARD_ALLOW_STALE !== "1") {
  const raiz = __dirname;
  const buildId = path.join(raiz, ".next", "BUILD_ID");
  if (!fs.existsSync(buildId)) throw new Error("[guard] GUARD_SKIP_BUILD=1 pero no hay .next: correr `npm run build` (o quitar GUARD_SKIP_BUILD).");
  const build = fs.statSync(buildId).mtimeMs;
  const fuente = ultimoCambio(path.join(raiz, "src"));
  if (fuente > build) {
    throw new Error(
      `[guard] El build de .next (${new Date(build).toISOString()}) es más viejo que el último cambio en src/ (${new Date(fuente).toISOString()}). ` +
        "Volver a construir (quitar GUARD_SKIP_BUILD) o GUARD_ALLOW_STALE=1 si es a propósito.",
    );
  }
}

export default defineConfig({
  testDir: "./scripts/guard",
  testMatch: "landing.spec.ts",
  snapshotPathTemplate: "design-system/crm-2/guard/landing/{arg}{ext}",
  outputDir: "test-results/guard",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"]],
  use: {
    baseURL,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    colorScheme: "dark",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
    trace: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], deviceScaleFactor: 1 } }],
  webServer: externa
    ? undefined
    : {
        command: `${arranque}npm run start -- -p ${port}`,
        url: baseURL,
        reuseExistingServer: process.env.GUARD_REUSE_SERVER === "1",
        timeout: 600_000,
      },
});
