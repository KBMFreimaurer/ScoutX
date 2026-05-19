import fs from "node:fs";
import path from "node:path";

const selectors = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "config/hrworks.selectors.json"), "utf-8"),
);

async function fillRequired(page, selector, value, label) {
  const locator = page.locator(selector);
  if ((await locator.count()) === 0) {
    throw new Error(`Selector fehlt: ${label}`);
  }
  await locator.first().fill(String(value || ""));
}

async function fillOptionRequired(page, selector, value, label) {
  const locator = page.locator(selector);
  if ((await locator.count()) === 0) {
    throw new Error(`Selector fehlt: ${label}`);
  }

  const target = String(value || "").trim();
  if (!target) {
    throw new Error(`Dropdown-Wert fehlt: ${label}`);
  }

  const first = locator.first();
  await first.fill(target);
  const current = String(await first.inputValue()).trim();
  if (current !== target) {
    throw new Error(`Dropdown-Wert nicht gefunden: ${label} (${target})`);
  }
}

async function fillOptional(page, selector, value) {
  const target = String(value || "").trim();
  if (!target) {
    return;
  }
  const locator = page.locator(selector);
  if ((await locator.count()) === 0) {
    return;
  }
  await locator.first().fill(target);
}

async function clickOptional(page, selector) {
  const locator = page.locator(selector);
  if ((await locator.count()) === 0) {
    return false;
  }
  await locator.first().click();
  return true;
}

export async function fillHrworksTravelExpenseForm(page, payload, options = {}) {
  const shouldSave = Boolean(options?.confirmBeforeSave);
  const runRouteFlow = Boolean(options?.runRouteFlow);
  await page.getByRole("button", { name: "Reisekostenabrechnung" }).click();
  await page.getByRole("button", { name: "Neue Reisekostenabrechnung" }).click();

  await fillRequired(page, selectors.purposeInput, payload.purpose, "purposeInput");
  await fillRequired(page, selectors.noteTextarea, payload.note, "noteTextarea");
  await fillRequired(page, selectors.dateRangeInput, `${payload.date} - ${payload.date}`, "dateRangeInput");
  await fillRequired(page, selectors.startTimeInput, payload.startTime, "startTimeInput");
  await fillRequired(page, selectors.endTimeInput, payload.endTime, "endTimeInput");
  await fillOptionRequired(page, selectors.departureLocationSelect, payload.departureLocation, "departureLocationSelect");
  await fillOptionRequired(page, selectors.costCenterSelect, payload.costCenter, "costCenterSelect");
  await fillOptional(page, selectors.destinationLocationSelect, payload.destinationLocation);
  await fillOptional(
    page,
    selectors.routeTextarea,
    Array.isArray(payload?.intermediateStops) ? payload.intermediateStops.join(" | ") : "",
  );

  if (!shouldSave) {
    return { saved: false };
  }

  const saveButton = page.locator(selectors.saveButton);
  if ((await saveButton.count()) === 0) {
    throw new Error("Selector fehlt: saveButton");
  }
  await saveButton.first().click();
  if (!runRouteFlow) {
    return { saved: true };
  }

  await fillOptional(page, selectors.kilometersInput, payload.kilometers);
  await clickOptional(page, selectors.saveKilometersButton);
  await clickOptional(page, selectors.processRouteButton);
  await clickOptional(page, selectors.reportsButton);
  await clickOptional(page, selectors.completeReportsButton);

  return { saved: true, routeFlowCompleted: true };
}
