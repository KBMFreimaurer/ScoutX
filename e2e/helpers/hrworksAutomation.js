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
  const tagName = typeof first.evaluate === "function"
    ? String(await first.evaluate((el) => el.tagName || "")).toLowerCase()
    : "";
  if (tagName === "select" && typeof first.selectOption === "function") {
    await first.selectOption({ label: target });
    const selectedLabel = String(await first.evaluate((el) => el.selectedOptions?.[0]?.textContent || "")).trim();
    if (selectedLabel !== target) {
      throw new Error(`Dropdown-Wert nicht gefunden: ${label} (${target})`);
    }
    return;
  } else {
    await first.fill(target);
  }
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

async function clearOptional(page, selector) {
  if (!selector) {
    return;
  }
  const locator = page.locator(selector);
  if ((await locator.count()) === 0) {
    return;
  }
  await locator.first().fill("");
}

async function clickOptional(page, selector) {
  const locator = page.locator(selector);
  if ((await locator.count()) === 0) {
    return false;
  }
  await locator.first().click();
  return true;
}

async function clickRequired(page, selector, label) {
  const locator = page.locator(selector);
  if ((await locator.count()) === 0) {
    throw new Error(`Selector fehlt: ${label}`);
  }
  await locator.first().click();
}

async function fillKilometerLeg(page, leg, payload) {
  await clickRequired(page, selectors.newKilometerEntryButton, "newKilometerEntryButton");
  await fillRequired(page, selectors.mileageFromInput, leg.from, "mileageFromInput");
  await fillRequired(page, selectors.mileageToInput, leg.to, "mileageToInput");
  await fillRequired(page, selectors.mileageDateInput, payload.date, "mileageDateInput");
  await clearOptional(page, selectors.mileageNoteInput);
  if (Number.isFinite(Number(leg.distanceKm))) {
    await fillRequired(page, selectors.mileageKilometersInput, String(leg.distanceKm), "mileageKilometersInput");
  } else {
    await fillOptional(page, selectors.mileageKilometersInput, payload.kilometers);
  }
  await clickRequired(page, selectors.saveKilometerEntryButton, "saveKilometerEntryButton");
}

export async function fillHrworksTravelExpenseForm(page, payload, options = {}) {
  const shouldSave = Boolean(options?.confirmBeforeSave);
  const runRouteFlow = Boolean(options?.runRouteFlow);
  const completeWorkflow = Boolean(options?.completeWorkflow);
  await page.getByRole("button", { name: "Reisekostenabrechnung", exact: true }).click();
  await page.getByRole("button", { name: "Neue Reisekostenabrechnung", exact: true }).click();

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
  await clickOptional(page, selectors.confirmMissingIntermediateStopsButton);
  if (!runRouteFlow) {
    return { saved: true };
  }

  const routeLegs = Array.isArray(payload?.routeLegs) ? payload.routeLegs : [];
  for (const leg of routeLegs) {
    await fillKilometerLeg(page, leg, payload);
  }
  await clickOptional(page, selectors.reportsButton);
  if (!completeWorkflow) {
    return { saved: true, routeFlowCompleted: true, kilometerEntriesCreated: routeLegs.length, reportsCompleted: false };
  }
  await clickRequired(page, selectors.completeReportsButton, "completeReportsButton");
  const clickedFinalComplete = await clickOptional(page, selectors.finalCompleteReportsButton);
  if (!clickedFinalComplete) {
    await clickOptional(page, selectors.completeReportsButton);
  }
  const clickedFinalConfirm = await clickOptional(page, selectors.confirmFinalReportSubmitButton);
  if (!clickedFinalConfirm) {
    await clickOptional(page, selectors.confirmMissingIntermediateStopsButton);
  }

  return { saved: true, routeFlowCompleted: true, kilometerEntriesCreated: routeLegs.length, reportsCompleted: true };
}
