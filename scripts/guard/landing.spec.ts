import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Guarda visual de las pantallas públicas: `/` (landing, 3 anchos), `/login` y `/recuperar` (1440 y 390),
 * página completa, contra la baseline commiteada en design-system/crm-2/guard/landing/.
 * Tolerancia CERO: maxDiffPixels 0 y threshold 0 (ni un píxel, ni un matiz).
 * `/definir-clave` necesita sesión: solo lo cubren los hashes de frozen-files.
 *
 *   npm run guard:landing                          compara
 *   npx playwright test -c playwright.guard.config.ts --update-snapshots    regenera la baseline
 *                                                  (solo para un cambio deliberado y aprobado: README de design-system/crm-2/)
 *
 * Fuentes de no-determinismo y cómo se neutraliza cada una: README de design-system/crm-2/.
 */

const PANTALLAS = [
  {
    nombre: "landing",
    ruta: "/",
    viewports: [
      { ancho: 1440, alto: 900 },
      { ancho: 768, alto: 1024 },
      { ancho: 390, alto: 844 },
    ],
    // BallCursor agrega `ball-cursor` a <html> al montar: señal de que React hidrató.
    listo: (page: Page) => page.waitForFunction(() => document.documentElement.classList.contains("ball-cursor")),
    // El pie dice «© <año actual>»: cambia solo el 1 de enero. Es lo único dependiente del reloj.
    mascara: (page: Page) => [page.locator("footer p")],
  },
  {
    nombre: "login",
    ruta: "/login",
    viewports: [
      { ancho: 1440, alto: 900 },
      { ancho: 390, alto: 844 },
    ],
    listo: (page: Page) => page.locator('input[name="email"]').waitFor({ state: "visible" }),
    // El panel de marca (solo desktop) dice «© <año actual>».
    mascara: (page: Page) => [page.locator("p", { hasText: "©" })],
  },
  {
    nombre: "recuperar",
    ruta: "/recuperar",
    viewports: [
      { ancho: 1440, alto: 900 },
      { ancho: 390, alto: 844 },
    ],
    listo: (page: Page) => page.getByRole("button").first().waitFor({ state: "visible" }),
    mascara: () => [],
  },
] as const;

const HOJA = path.join(__dirname, "landing.css");

/** Recorre la página de punta a punta (dispara lo que aparezca al scrollear) y vuelve arriba. */
async function recorrer(page: Page) {
  await page.evaluate(async () => {
    const paso = Math.max(200, Math.floor(window.innerHeight * 0.6));
    const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let y = 0; y < document.documentElement.scrollHeight; y += paso) {
      window.scrollTo(0, y);
      await pausa(80);
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await pausa(150);
    window.scrollTo(0, 0);
    await pausa(150);
  });
}

for (const pantalla of PANTALLAS) {
  for (const { ancho, alto } of pantalla.viewports) {
    test(`${pantalla.nombre} ${ancho}x${alto}`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: alto });
      await page.goto(pantalla.ruta, { waitUntil: "load" });

      await pantalla.listo(page);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState("networkidle");

      await recorrer(page);
      await page.evaluate(() => document.fonts.ready);
      // Dos cuadros de animación para que el layout asiente tras volver arriba.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

      await expect(page).toHaveScreenshot(`${pantalla.nombre}-${ancho}.png`, {
        fullPage: true,
        animations: "disabled",
        caret: "hide",
        scale: "css",
        stylePath: HOJA,
        mask: [...pantalla.mascara(page)],
        maxDiffPixels: 0,
        threshold: 0,
      });
    });
  }
}
