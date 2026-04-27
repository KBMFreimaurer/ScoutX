import { expect, test } from "@playwright/test";

test("setup shows bundesland step and filters regions by selected state", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/setup");

  await expect(page.getByRole("heading", { name: "Scouting-Plan konfigurieren" })).toBeVisible();
  await expect(page.getByText("Bundesland", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Region & Kreis", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Mannschaften (optional)", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Bundesland Bayern auswählen" }).click();
  await page.getByRole("button", { name: "Weiter zum nächsten Schritt" }).click();
  await expect(page.getByText("München", { exact: true })).toBeVisible();
  await expect(page.getByText("Duisburg", { exact: true })).toHaveCount(0);
});
