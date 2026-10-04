import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas E2E del CRM (F6). Cómo correrlas y qué variables hacen falta: docs/pruebas.md.
 *
 *   E2E_BASE_URL                      a dónde apuntan (por defecto http://localhost:3000)
 *   E2E_EMAIL / E2E_PASSWORD          el Administrador de la organización de pruebas
 *   E2E_EMAIL_VENDEDOR / E2E_PASSWORD_VENDEDOR   el Vendedor de esa misma organización
 *   E2E_WEB_SERVER                    opcional: comando que levanta la app (p. ej. "npm run start"); si no está,
 *                                     la app tiene que estar corriendo en E2E_BASE_URL
 *
 * Sin las credenciales las pruebas se saltan con un mensaje claro (no fallan): ver e2e/helpers.ts.
 * Corren contra la organización "E2E Tuco & Nito" (supabase/seeds/e2e_tests.sql), nunca contra la demo.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const enCI = Boolean(process.env.CI);

// El reporter `list` no imprime el motivo de un salto: se avisa una vez, acá.
if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) {
  console.warn(
    "[e2e] Faltan E2E_EMAIL / E2E_PASSWORD (y E2E_EMAIL_VENDEDOR / E2E_PASSWORD_VENDEDOR): las pruebas se saltan. Ver docs/pruebas.md.",
  );
}

export default defineConfig({
  testDir: "./e2e",
  // La demo es una secuencia sobre datos compartidos: un trabajador y en orden.
  fullyParallel: false,
  workers: 1,
  retries: enCI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: enCI,
  // En CI: nada de HTML (embebe las trazas). Solo la consola y un junit.xml chico, que el workflow limpia de secretos
  // antes de subirlo (ver .github/workflows/ci.yml). El repositorio es publico: un artefacto con credenciales las filtra.
  reporter: enCI ? [["github"], ["list"], ["junit", { outputFile: "test-results/junit.xml" }]] : [["list"]],
  use: {
    baseURL,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    // Las trazas y las capturas guardan lo que se escribe en los campos (el login incluido). En CI quedan apagadas;
    // localmente la traza solo se arma en un reintento y queda en test-results/ (ignorada por git).
    trace: enCI ? "off" : "on-first-retry",
    screenshot: enCI ? "off" : "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_WEB_SERVER
    ? { command: process.env.E2E_WEB_SERVER, url: baseURL, reuseExistingServer: true, timeout: 180_000 }
    : undefined,
});
