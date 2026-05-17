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

export async function fillHrworksTravelExpenseForm(page, payload, options = {}) {
  const shouldSave = Boolean(options?.confirmBeforeSave);
  await page.getByRole("button", { name: "Reisekostenabrechnung" }).click();
  await page.getByRole("button", { name: "Neue Reisekostenabrechnung" }).click();

  await fillRequired(page, selectors.purposeInput, payload.purpose, "purposeInput");
  await fillRequired(page, selectors.noteTextarea, payload.note, "noteTextarea");
  await fillRequired(page, selectors.dateRangeInput, `${payload.date} - ${payload.date}`, "dateRangeInput");
  await fillRequired(page, selectors.startTimeInput, payload.startTime, "startTimeInput");
  await fillRequired(page, selectors.endTimeInput, payload.endTime, "endTimeInput");
  await fillOptionRequired(page, selectors.departureLocationSelect, payload.departureLocation, "departureLocationSelect");
  await fillOptionRequired(page, selectors.destinationLocationSelect, payload.destinationLocation, "destinationLocationSelect");
  await fillOptionRequired(page, selectors.costCenterSelect, payload.costCenter, "costCenterSelect");

  if (!shouldSave) {
    return { saved: false };
  }

  const saveButton = page.locator(selectors.saveButton);
  if ((await saveButton.count()) === 0) {
    throw new Error("Selector fehlt: saveButton");
  }
  await saveButton.first().click();
  return { saved: true };
}
