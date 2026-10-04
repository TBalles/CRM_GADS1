import { expect, test } from "@playwright/test";
import { SEED, entrar, requerirCredenciales } from "./helpers";

test.describe("listas, búsqueda global y presupuesto (solo lectura)", () => {
  requerirCredenciales("admin");

  test.beforeEach(async ({ page }) => {
    await entrar(page, "admin");
  });

  test("la lista pagina en el servidor y la página queda en la URL", async ({ page }) => {
    await page.goto("/empresas?pageSize=10");
    await expect(page.getByText(/^Mostrando 1–10 de \d+$/)).toBeVisible();

    await page.getByRole("link", { name: "Página 2", exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/^Mostrando 11–\d+ de \d+$/)).toBeVisible();

    // Un link directo a la página 2 anda igual (la URL es el estado).
    await page.goto("/empresas?pageSize=10&page=2");
    await expect(page.getByText(/^Mostrando 11–\d+ de \d+$/)).toBeVisible();
  });

  test("buscar filtra y deja el texto en la URL", async ({ page }) => {
    await page.goto("/empresas");
    await page.getByRole("textbox", { name: "Buscar empresa o contacto" }).fill(SEED.empresa(8));
    await expect(page).toHaveURL(/q=E2E(\+|%20)Club(\+|%20)08/);
    await expect(page.getByRole("link", { name: SEED.empresa(8), exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: SEED.empresa(9), exact: true })).toHaveCount(0);

    // Y el mismo filtro por link directo.
    await page.goto(`/empresas?q=${encodeURIComponent(SEED.empresa(9))}`);
    await expect(page.getByRole("link", { name: SEED.empresa(9), exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: SEED.empresa(8), exact: true })).toHaveCount(0);
  });

  test("Ctrl+K abre la búsqueda global y navega al resultado", async ({ page }) => {
    await page.goto("/oportunidades");
    await page.keyboard.press("Control+K");
    const dialogo = page.getByRole("dialog", { name: "Buscar en el CRM" });
    await expect(dialogo).toBeVisible();

    await dialogo.getByRole("combobox", { name: "Buscar" }).fill(SEED.empresa(3));
    await dialogo.getByRole("option", { name: new RegExp(SEED.empresa(3)) }).first().click();
    await expect(page).toHaveURL(/\/empresas\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: SEED.empresa(3) })).toBeVisible();
  });

  test("el presupuesto muestra el encabezado del proveedor y los totales, y en papel no sale el menú", async ({ page }) => {
    await page.goto(`/oportunidades/${SEED.oportunidadPresupuesto}`);
    await page.getByRole("link", { name: "Presupuesto", exact: true }).click();
    await expect(page).toHaveURL(/\/presupuesto$/);

    const hoja = page.getByRole("article");
    await expect(hoja.getByText(SEED.razonSocial)).toBeVisible();
    // Es el documento del proveedor: la marca de la plataforma no aparece.
    await expect(hoja).not.toContainText(/Tuco\s*&\s*Nito/i);
    await expect(page.getByTestId("numero-presupuesto")).toHaveText(/Borrador|N° \d{6}/);

    // La oportunidad del seed trae una línea; se agrega otra y los totales siguen la regla del IVA (proveedor
    // Responsable Inscripto: precios netos, IVA 21 %).
    await page.getByRole("button", { name: "Agregar línea libre" }).click();
    await page.locator('input[id$="-descripcion"]').last().fill("Línea de prueba E2E");
    await page.locator('input[id$="-precio"]').last().fill("1000");
    // El seed deja la oportunidad en $50.000 (una línea) y se suman $1.000: neto $51.000, IVA 21 % = $10.710, total $61.710.
    const importe = async (id: string) => Number((await page.getByTestId(id).innerText()).replace(/[^d,]/g, "").replace(",", "."));
    expect(await importe("neto")).toBe(51000);
    expect(await importe("iva")).toBe(10710);
    expect(await importe("total")).toBe(61710);

    // En papel (@media print) el shell desaparece y queda la hoja.
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("navigation", { name: "Secciones" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Imprimir / Guardar PDF" })).toBeHidden();
    await expect(hoja).toBeVisible();
  });
});
