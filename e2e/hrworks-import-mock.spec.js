import { expect, test } from "@playwright/test";
import { fillHrworksTravelExpenseForm } from "./helpers/hrworksAutomation";

test("fills mock HRworks form via selector mapping", async ({ page }) => {
  await page.goto("/mock/hrworks-travel-form.html");

  await fillHrworksTravelExpenseForm(page, {
    purpose: "Sichtung / (Spiel 1 - Spiel 2)",
    note: "Sichtung / (Spiel 1 → Spiel 2)",
    date: "2026-04-20",
    startTime: "08:00",
    endTime: "17:00",
    departureLocation: "Sternbuschweg 326",
    destinationLocation: "Sportplatz A",
    costCenter: "Junioren allgemein (321000)",
  });

  await expect(page.locator("input[name='purpose']")).toHaveValue("Sichtung / (Spiel 1 - Spiel 2)");
  await expect(page.locator("input[name='costCenter']")).toHaveValue("Junioren allgemein (321000)");
});
