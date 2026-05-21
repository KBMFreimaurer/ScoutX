import { expect, test } from "@playwright/test";
import { fillHrworksTravelExpenseForm } from "./helpers/hrworksAutomation";

test("fills mock HRworks form via selector mapping", async ({ page }) => {
  await page.goto("/mock/hrworks-travel-form.html");

  await fillHrworksTravelExpenseForm(page, {
    purpose: "Sichtung / Route des Arbeitstages",
    note: "Sichtung / Route des Arbeitstages",
    date: "2026-04-20",
    startTime: "08:00",
    endTime: "17:00",
    departureLocation: "Sternbuschweg 326",
    destinationLocation: "",
    costCenter: "Junioren allgemein (321000)",
  });

  await expect(page.locator("input[name='purpose']")).toHaveValue("Sichtung / Route des Arbeitstages");
  await expect(page.locator("select[name='costCenter']")).toHaveValue("Junioren allgemein (321000)");
});

test("creates kilometer entries without completing reports", async ({ page }) => {
  await page.goto("/mock/hrworks-travel-form.html");

  const result = await fillHrworksTravelExpenseForm(page, {
    purpose: "Sichtung / (Spiel1 - Spiel2)",
    note: "Sichtung / (Spiel1 - Spiel2)",
    date: "2026-05-23",
    startTime: "10:00",
    endTime: "15:00",
    departureLocation: "Sternbuschweg 326",
    destinationLocation: "",
    costCenter: "Junioren allgemein (321000)",
    routeLegs: [
      { from: "Sternbuschweg 326", to: "Spiel1", distanceKm: 1.09 },
      { from: "Spiel1", to: "Spiel2", distanceKm: 11.89 },
    ],
  }, { confirmBeforeSave: true, runRouteFlow: true });

  expect(result.kilometerEntriesCreated).toBe(2);
  await expect(page.locator("input[name='mileageFrom']")).toHaveValue("Spiel1");
  await expect(page.locator("input[name='mileageTo']")).toHaveValue("Spiel2");
  await expect(page.locator("input[name='mileageNote']")).toHaveValue("");
  await expect(page.locator("input[name='mileageKilometers']")).toHaveValue("11.89");
  await expect(page.locator("#workflow-status")).toHaveText("route-only");
});

test("creates kilometer entries and completes the full HRworks workflow", async ({ page }) => {
  await page.goto("/mock/hrworks-travel-form.html");

  const result = await fillHrworksTravelExpenseForm(page, {
    purpose: "Sichtung / (GSG Duisburg II - DSC Preussen Duisburg III)",
    note: "Sichtung / (GSG Duisburg II - DSC Preussen Duisburg III)",
    date: "2026-04-25",
    startTime: "08:00",
    endTime: "13:00",
    departureLocation: "Sternbuschweg 326",
    destinationLocation: "",
    costCenter: "Junioren allgemein (321000)",
    routeLegs: [
      { from: "Sternbuschweg 326", to: "GSG Duisburg II", distanceKm: 5.4 },
      { from: "GSG Duisburg II", to: "DSC Preussen Duisburg III", distanceKm: 9.3 },
      { from: "DSC Preussen Duisburg III", to: "Sternbuschweg 326", distanceKm: 4.1 },
    ],
  }, { confirmBeforeSave: true, runRouteFlow: true, completeWorkflow: true });

  expect(result.kilometerEntriesCreated).toBe(3);
  expect(result.reportsCompleted).toBe(true);
  await expect(page.locator("#workflow-status")).toHaveText("completed");
  await expect(page.locator("#warning-confirmed")).toHaveText("yes");
});
