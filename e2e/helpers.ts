import { expect, test, type Page } from "@playwright/test";

/**
 * Ayudas compartidas de las pruebas E2E. Detalle de cómo correrlas: docs/pruebas.md.
 *
 * Las pruebas corren contra una organización DEDICADA ("E2E Tuco & Nito", supabase/seeds/e2e_tests.sql),
 * nunca contra la demo. Como el CRM no borra nada (baja lógica), lo que crean queda en esa organización,
 * con nombres únicos `E2E <timestamp>` para que una corrida no choque con la anterior.
 */

export type Rol = "admin" | "vendedor";

const CREDENCIALES: Record<Rol, { email?: string; password?: string; vars: string }> = {
  admin: { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD, vars: "E2E_EMAIL y E2E_PASSWORD" },
  vendedor: {
    email: process.env.E2E_EMAIL_VENDEDOR,
    password: process.env.E2E_PASSWORD_VENDEDOR,
    vars: "E2E_EMAIL_VENDEDOR y E2E_PASSWORD_VENDEDOR",
  },
};

/** Ids fijos del seed (supabase/seeds/e2e_tests.sql). */
export const SEED = {
  /** Oportunidad con la que se prueba la hoja del presupuesto. */
  oportunidadPresupuesto: "e2e0b1b1-0000-0000-0000-000000000001",
  razonSocial: "E2E Equipamiento Deportivo SRL",
  /** "E2E Club 01" a "E2E Club 12": del 01 al 06 son del Administrador y del 07 al 12 del Vendedor. */
  empresa: (n: number) => `E2E Club ${String(n).padStart(2, "0")}`,
};

/** Salta TODO el archivo (con un mensaje claro) si faltan las credenciales de los roles pedidos. */
export function requerirCredenciales(...roles: Rol[]) {
  const faltan = roles.filter((r) => !CREDENCIALES[r].email || !CREDENCIALES[r].password);
  test.skip(
    faltan.length > 0,
    `Faltan variables de entorno para las pruebas E2E: ${faltan.map((r) => CREDENCIALES[r].vars).join(" y ")}. Ver docs/pruebas.md.`,
  );
}

/** Entra con el formulario de /login, como lo haría una persona. */
export async function entrar(page: Page, rol: Rol) {
  const { email, password } = CREDENCIALES[rol];
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email ?? "");
  await page.locator('input[name="password"]').fill(password ?? "");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
  await expect(page.getByRole("navigation", { name: "Secciones" })).toBeVisible();
}

/** El total que dice "Mostrando 1–20 de 134" (la paginación del servidor). */
export async function totalMostrado(page: Page): Promise<number> {
  const texto = await page.getByText(/^Mostrando \d+–\d+ de \d+$/).first().innerText();
  return Number(/de (\d+)$/.exec(texto)?.[1]);
}
