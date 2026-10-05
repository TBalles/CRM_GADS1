import { expect, test } from "@playwright/test";
import { entrar, requerirCredenciales } from "./helpers";

/**
 * La demo de la consigna de punta a punta, como el Administrador de la organización E2E:
 * empresa -> contacto -> oportunidad -> etapas -> perdida (con motivo) -> historial.
 *
 * Es una secuencia (cada paso usa lo que creó el anterior), por eso corre en serie. Los nombres llevan la
 * hora de la corrida: no hay borrado, así que una segunda corrida tiene que poder convivir con la primera.
 * La oportunidad termina cerrada (perdida) y la empresa queda activa en la organización de pruebas.
 */
test.describe.serial("demo: empresa, contacto, oportunidad y embudo", () => {
  requerirCredenciales("admin");

  const corrida = `E2E ${Date.now()}`;
  const empresa = `${corrida} Club`;
  const oportunidad = `${corrida} Recambio de redes`;

  test.beforeEach(async ({ page }) => {
    await entrar(page, "admin");
  });

  test("crear una empresa", async ({ page }) => {
    await page.goto("/empresas");
    await page.getByRole("button", { name: "Nueva empresa" }).click();
    const panel = page.getByRole("dialog", { name: "Nueva empresa" });
    await panel.locator("#nombre").fill(empresa);
    await panel.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Empresa creada.")).toBeVisible();

    // Persiste: se la encuentra por la URL (la búsqueda del servidor) después de recargar.
    await page.goto(`/empresas?q=${encodeURIComponent(empresa)}`);
    await expect(page.getByRole("link", { name: empresa, exact: true })).toBeVisible();
  });

  test("agregarle un contacto desde su ficha", async ({ page }) => {
    await page.goto(`/empresas?q=${encodeURIComponent(empresa)}`);
    await page.getByRole("link", { name: empresa, exact: true }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: empresa })).toBeVisible();

    await page.getByRole("button", { name: "Agregar", exact: true }).first().click();
    const panel = page.getByRole("dialog", { name: "Nuevo contacto" });
    await panel.locator("#nombre").fill("Contacto");
    await panel.locator("#apellido").fill(corrida);
    await panel.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Contacto creado.")).toBeVisible();
    await expect(page.getByRole("link", { name: `Contacto ${corrida}`, exact: true })).toBeVisible();
  });

  test("crear la oportunidad y verla en el embudo", async ({ page }) => {
    await page.goto("/oportunidades");
    await page.getByRole("button", { name: "Nueva oportunidad" }).click();
    const panel = page.getByRole("dialog", { name: "Nueva oportunidad" });
    await panel.locator("#titulo").fill(oportunidad);
    await panel.locator("#empresa_id").click();
    await page.getByRole("option", { name: empresa }).click();
    await panel.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Oportunidad creada.")).toBeVisible();

    // Queda en la primera etapa del tablero y sobrevive a un reload.
    await page.reload();
    await expect(page.getByRole("button", { name: `Acciones de ${oportunidad}` })).toBeVisible();
  });

  test("moverla de etapa con «Cambiar etapa» (sirve sin arrastrar)", async ({ page }) => {
    await page.goto("/oportunidades");
    for (const [etapa, nota] of [
      ["Relevamiento de cancha", `${corrida} paso 1`],
      ["Negociación", `${corrida} paso 2`],
    ]) {
      await page.getByRole("button", { name: `Acciones de ${oportunidad}` }).click();
      await page.getByRole("menuitem", { name: "Cambiar etapa" }).click();
      const modal = page.getByRole("dialog", { name: "Cambiar de etapa" });
      await modal.locator("#cambio_etapa").click();
      await page.getByRole("option", { name: etapa }).click();
      await modal.locator("#cambio_observacion").fill(nota);
      await modal.getByRole("button", { name: "Mover" }).click();
      await expect(page.getByText(`pasó a «${etapa}»`)).toBeVisible();
      await expect(modal).toBeHidden();
    }
  });

  test("marcarla perdida exige el motivo, y el historial lo muestra", async ({ page }) => {
    await page.goto("/oportunidades");
    await page.getByRole("button", { name: `Acciones de ${oportunidad}` }).click();
    await page.getByRole("menuitem", { name: "Ver detalle" }).click();
    await expect(page.getByRole("heading", { level: 1, name: oportunidad })).toBeVisible();

    await page.getByRole("button", { name: "Marcar perdida" }).click();
    const modal = page.getByRole("dialog", { name: "Marcar como perdida" });

    // Sin motivo: la interfaz lo frena (y la base también lo exige).
    await modal.getByRole("button", { name: "Marcar perdida" }).click();
    await expect(modal.getByText("Elegí el motivo de pérdida.")).toBeVisible();
    await expect(modal).toBeVisible();

    // Con motivo: se cierra.
    await modal.locator("#motivo_perdida").click();
    await page.getByRole("option").first().click();
    await modal.locator("#cambio_observacion").fill(`${corrida} cierre`);
    await modal.getByRole("button", { name: "Marcar perdida" }).click();
    await expect(page.getByText("quedó perdida")).toBeVisible();
    await expect(modal).toBeHidden();

    // El historial del detalle trae los cambios de etapa con sus observaciones.
    await expect(page.getByRole("status").filter({ hasText: /Perdida el \d{2}\/\d{2}\/\d{4}/ })).toBeVisible();
    await expect(page.getByText(`${corrida} paso 1`)).toBeVisible();
    await expect(page.getByText(`${corrida} paso 2`)).toBeVisible();
    await expect(page.getByText(`${corrida} cierre`)).toBeVisible();

    // Sigue ahí después de recargar, y ya no está en el tablero (que muestra solo las abiertas).
    await page.reload();
    await expect(page.getByText(`${corrida} paso 2`)).toBeVisible();
    await page.goto("/oportunidades");
    await expect(page.getByRole("button", { name: `Acciones de ${oportunidad}` })).toHaveCount(0);
  });
});
