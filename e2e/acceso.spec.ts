import { expect, test } from "@playwright/test";
import { SEED, entrar, requerirCredenciales, totalMostrado } from "./helpers";

test.describe("acceso y aislamiento por rol", () => {
  requerirCredenciales("admin", "vendedor");

  test("sin sesión, una pantalla del CRM lleva al login", async ({ page }) => {
    await page.goto("/empresas");
    await expect(page).toHaveURL(/\/login/);
  });

  test("una contraseña equivocada no entra y avisa", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(process.env.E2E_EMAIL ?? "");
    await page.locator('input[name="password"]').fill("clave-equivocada-e2e");
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ }).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("el Administrador entra y llega a una pantalla del CRM", async ({ page }) => {
    await entrar(page, "admin");
    await expect(page).not.toHaveURL(/\/login/);
    // Ve la administración: Usuarios y Configuración.
    await expect(page.getByRole("link", { name: "Configuración", exact: true })).toBeVisible();
  });

  test("el Vendedor entra y no ve la administración", async ({ page }) => {
    await entrar(page, "vendedor");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("link", { name: "Configuración", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Usuarios", exact: true })).toHaveCount(0);
  });

  test("el Vendedor ve menos empresas que el Administrador (cartera propia)", async ({ browser }) => {
    const admin = await browser.newPage();
    await entrar(admin, "admin");
    await admin.goto("/empresas");
    const deAdmin = await totalMostrado(admin);
    await admin.close();

    const vendedor = await browser.newPage();
    await entrar(vendedor, "vendedor");
    await vendedor.goto("/empresas");
    const deVendedor = await totalMostrado(vendedor);

    expect(deVendedor).toBeGreaterThan(0);
    expect(deVendedor).toBeLessThan(deAdmin);

    // Una empresa del Administrador no aparece ni buscándola por su nombre.
    await vendedor.goto(`/empresas?q=${encodeURIComponent(SEED.empresa(1))}`);
    await expect(vendedor.getByRole("heading", { name: "Empresas" }).first()).toBeVisible();
    await expect(vendedor.getByRole("link", { name: SEED.empresa(1), exact: true })).toHaveCount(0);
    // Y una propia sí.
    await vendedor.goto(`/empresas?q=${encodeURIComponent(SEED.empresa(7))}`);
    await expect(vendedor.getByRole("link", { name: SEED.empresa(7), exact: true })).toBeVisible();
    await vendedor.close();
  });
});
