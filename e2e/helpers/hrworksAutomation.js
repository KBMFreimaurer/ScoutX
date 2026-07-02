import fs from "node:fs";
import path from "node:path";

const selectors = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "config/hrworks.selectors.json"), "utf-8"),
);

function createRunMetrics(now = () => Date.now()) {
  const startedAtMs = now();
  const steps = [];

  return {
    mark(step, detail = "") {
      const atMs = now();
      const entry = {
        step: String(step || "").trim() || "unknown_step",
        detail: String(detail || "").trim(),
        at: new Date(atMs).toISOString(),
        elapsedMs: Math.max(0, atMs - startedAtMs),
      };
      steps.push(entry);
      const detailText = entry.detail ? `: ${entry.detail}` : "";
      console.log(`[HRworks][${entry.at}][+${entry.elapsedMs}ms] ${entry.step}${detailText}`);
      return entry;
    },
    finish(extra = {}) {
      const finishedAtMs = now();
      return {
        startedAt: new Date(startedAtMs).toISOString(),
        finishedAt: new Date(finishedAtMs).toISOString(),
        durationMs: Math.max(0, finishedAtMs - startedAtMs),
        steps: [...steps],
        ...(extra || {}),
      };
    },
  };
}

async function resolveField(locator) {
  const count = await locator.count();
  if (count === 0) {
    return null;
  }
  if (count === 1 || typeof locator.nth !== "function") {
    return locator.first();
  }
  return locator.nth(count - 1);
}

async function fillRequired(page, selector, value, label) {
  const locator = page.locator(selector);
  const first = await resolveField(locator);
  if (!first) {
    throw new Error(`Selector fehlt: ${label}`);
  }
  await first.click().catch(() => {});
  await first.fill(String(value || ""));
  await first.press("Tab").catch(() => {});
}

async function setControlledInputValue(page, selector, value, label, options = {}) {
  const locator = page.locator(selector);
  const first = await resolveField(locator);
  if (!first) {
    throw new Error(`Selector fehlt: ${label}`);
  }
  const targetValue = String(value || "");
  const clickFirst = options?.clickFirst !== false;
  const pressTab = options?.pressTab !== false;
  const attempts = Math.max(1, Number(options?.attempts || 1));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (clickFirst) {
      await first.click().catch(() => {});
    }
    await first.evaluate((element, nextValue) => {
      const isTextarea = typeof HTMLTextAreaElement !== "undefined" && element instanceof HTMLTextAreaElement;
      const isInput = typeof HTMLInputElement !== "undefined" && element instanceof HTMLInputElement;
      const prototype = isTextarea ? HTMLTextAreaElement.prototype : isInput ? HTMLInputElement.prototype : null;
      const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, "value") : null;
      if (descriptor?.set && prototype) {
        descriptor.set.call(element, nextValue);
      } else {
        element.value = nextValue;
      }
      if (typeof element.dispatchEvent === "function") {
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.dispatchEvent(new Event("blur", { bubbles: true }));
      }
    }, targetValue);
    if (pressTab) {
      await first.press("Tab").catch(() => {});
    }
    const currentValue = String(await first.inputValue()).trim();
    if (currentValue === targetValue.trim()) {
      return;
    }
  }
  throw new Error(`Wert konnte nicht gesetzt werden: ${label} (${targetValue})`);
}

async function fillOptionRequired(page, selector, value, label) {
  const locator = page.locator(selector);
  const first = await resolveField(locator);
  if (!first) {
    throw new Error(`Selector fehlt: ${label}`);
  }

  const target = String(value || "").trim();
  if (!target) {
    throw new Error(`Dropdown-Wert fehlt: ${label}`);
  }

  const normalizeOptionText = (input) => String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  const isLooseTypeaheadMatch = (actualValue, expectedValue) => {
    const actual = normalizeOptionText(actualValue);
    const expected = normalizeOptionText(expectedValue);
    if (!actual || !expected) {
      return false;
    }
    if (actual === expected || actual.includes(expected) || expected.includes(actual)) {
      return true;
    }
    const expectedTokens = expected.split(" ").filter(Boolean);
    return expectedTokens.length > 0 && expectedTokens.every((token) => actual.includes(token));
  };

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
    const isTypeaheadField = /LocationSelect|mileageFromInput|mileageToInput/.test(String(label || ""));
    const attempts = isTypeaheadField ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await first.click().catch(() => {});
      await first.fill(target);
      await page.waitForTimeout?.(150).catch(() => {});
      try {
        await first.press("ArrowDown", { timeout: 1000 });
        await first.press("Enter", { timeout: 1000 });
        await first.press("Tab", { timeout: 1000 });
      } catch {
        // Some HRworks inputs are plain text fields; in that case filling is enough.
      }
      const currentValue = String(await first.inputValue()).trim();
      if (isTypeaheadField ? isLooseTypeaheadMatch(currentValue, target) : currentValue === target) {
        break;
      }
      if (attempt === attempts - 1) {
        throw new Error(`Dropdown-Wert nicht gefunden: ${label} (${target})`);
      }
    }
  }
  const current = String(await first.inputValue()).trim();
  if (!current) {
    throw new Error(`Dropdown-Wert nicht gefunden: ${label} (${target})`);
  }
  const acceptsCanonicalizedTypeaheadValue = /LocationSelect|mileageFromInput|mileageToInput/.test(String(label || ""));
  if (acceptsCanonicalizedTypeaheadValue && !isLooseTypeaheadMatch(current, target)) {
    throw new Error(`Dropdown-Wert nicht gefunden: ${label} (${target})`);
  }
  if (!acceptsCanonicalizedTypeaheadValue && current !== target) {
    throw new Error(`Dropdown-Wert nicht gefunden: ${label} (${target})`);
  }
}

async function fillOptional(page, selector, value) {
  const target = String(value || "").trim();
  if (!target) {
    return;
  }
  const locator = page.locator(selector);
  const first = await resolveField(locator);
  if (!first) {
    return;
  }
  await first.fill(target);
}

async function clearOptional(page, selector) {
  if (!selector) {
    return;
  }
  const locator = page.locator(selector);
  const first = await resolveField(locator);
  if (!first) {
    return;
  }
  await first.fill("");
}

async function readInputValue(page, selector, label) {
  const locator = page.locator(selector);
  const first = await resolveField(locator);
  if (!first) {
    throw new Error(`Selector fehlt: ${label}`);
  }
  return String(await first.inputValue()).trim();
}

async function clickOptional(page, selector) {
  const locator = page.locator(selector);
  try {
    await locator.first().click({ timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function buildClickFallbackLocators(page, label) {
  switch (String(label || "")) {
    case "travelExpenseButton":
      return [
        page.getByRole?.("button", { name: /Reisekostenabrechnung/i }),
        page.getByRole?.("link", { name: /Reisekostenabrechnung/i }),
        page.locator?.("text=Reisekostenabrechnung"),
      ].filter(Boolean);
    case "newTravelExpenseButton":
      return [
        page.getByRole?.("button", { name: /Neue Reisekostenabrechnung/i }),
        page.getByRole?.("link", { name: /Neue Reisekostenabrechnung/i }),
        page.locator?.("text=Neue Reisekostenabrechnung"),
      ].filter(Boolean);
    case "saveKilometerEntryButton":
      return [
        page.getByRole?.("link", { name: /^Speichern$/i }),
        page.getByRole?.("button", { name: /Kilometerangabe speichern|^Speichern$/i }),
        page.locator?.("text=Speichern"),
      ].filter(Boolean);
    default:
      return [];
  }
}

async function findClickableTarget(page, selector, label) {
  const locator = page.locator(selector);
  let target = await resolveField(locator);
  if (!target) {
    for (const fallback of buildClickFallbackLocators(page, label)) {
      target = await resolveField(fallback);
      if (target) {
        break;
      }
    }
  }
  return target;
}

async function clickRequired(page, selector, label) {
  const target = await findClickableTarget(page, selector, label);
  if (!target) {
    throw new Error(`Selector fehlt: ${label}`);
  }
  try {
    await target.scrollIntoViewIfNeeded?.().catch(() => {});
    await target.click({ timeout: 15000 });
    return;
  } catch (error) {
    try {
      await target.evaluate((element) => {
        if (typeof element?.click === "function") {
          element.click();
          return;
        }
        throw new Error("Kein DOM-Klick verfügbar.");
      });
      return;
    } catch {
      // Fall through to keyboard fallback when DOM click is not possible.
    }
    try {
      await target.press?.("Enter");
      return;
    } catch {
      // The selector exists but neither click strategy succeeded.
    }
    throw new Error(`Klick fehlgeschlagen: ${label} (${String(error?.message || error || "unbekannt")})`);
  }
}

async function clickIfPresent(page, selector, label) {
  const target = await findClickableTarget(page, selector, label);
  if (!target) {
    return false;
  }
  try {
    await target.click({ timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

function formatGermanDate(date) {
  const value = String(date || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatHrworksKilometers(distanceValue) {
  const parsed = Number(distanceValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "";
  }
  const normalizedKm = parsed > 1000 ? parsed / 1000 : parsed;
  return normalizedKm.toFixed(2).replace(".", ",");
}

function currentTripId(page) {
  const match = /\/k\/travel-management\/trip\/(\d+)(?:\/|$)/.exec(String(page.url() || ""));
  return match?.[1] || "";
}

async function waitForSettledPage(page, options = {}) {
  const timeout = Math.max(1000, Number(options?.timeout || 5000));
  const fallbackMs = Math.max(0, Number(options?.fallbackMs || 0));
  await page.waitForLoadState("networkidle", { timeout }).catch(async () => {
    if (fallbackMs > 0) {
      await page.waitForTimeout?.(fallbackMs).catch(() => {});
    }
  });
}

async function gotoWithRetry(page, url, label, options = {}) {
  const attempts = Math.max(1, Number(options?.attempts || 2));
  const waitUntil = options?.waitUntil || "domcontentloaded";
  const timeout = Math.max(5000, Number(options?.timeout || 30000));
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.goto(url, { waitUntil, timeout });
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) {
        break;
      }
      console.warn(`Navigation retry ${attempt + 1}/${attempts - 1} for ${label}: ${String(error?.message || error)}`);
      await page.waitForTimeout?.(1200).catch(() => {});
    }
  }
  throw lastError;
}

async function waitForTripBaseData(page, timeout = 20000) {
  const matcher = /\/k\/travel-management\/trip\/\d+\/base-data/;
  try {
    await page.waitForURL(matcher, { timeout });
    return true;
  } catch {
    return matcher.test(String(page.url() || ""));
  }
}

async function reloadCurrentPage(page, label) {
  if (typeof page.reload === "function") {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    return;
  }
  await gotoWithRetry(page, String(page.url() || ""), label);
}

async function openNewTravelExpense(page, tracker) {
  if (/\/k\/travel-management\/trip\/\d+\/base-data/.test(String(page.url() || ""))) {
    tracker?.mark("travel_entry_reused_existing_trip", String(page.url() || ""));
    return;
  }
  tracker?.mark("travel_entry_open_dashboard");
  await gotoWithRetry(page, "https://ssl4.hrworks.de/k/dashboard", "HRworks dashboard");
  await waitForSettledPage(page, { timeout: 10000, fallbackMs: 600 });
  const openedFromDashboard = await clickIfPresent(page, selectors.travelExpenseButton, "travelExpenseButton");
  if (openedFromDashboard) {
    tracker?.mark("travel_entry_clicked_dashboard");
    if (await waitForTripBaseData(page, 6000)) {
      tracker?.mark("travel_entry_ready", currentTripId(page) || String(page.url() || ""));
      return;
    }
  }

  const alreadyOnTripsPage = /\/k\/travel-management\/trips(?:\/|$)/.test(String(page.url() || ""));
  if (!alreadyOnTripsPage) {
    tracker?.mark("travel_entry_open_trips");
    await gotoWithRetry(page, "https://ssl4.hrworks.de/k/travel-management/trips", "HRworks travel management trips");
  } else {
    tracker?.mark("travel_entry_reused_trips_page");
  }
  await waitForSettledPage(page, { timeout: 10000, fallbackMs: 600 });
  const openedFromTrips = await clickIfPresent(page, selectors.newTravelExpenseButton, "newTravelExpenseButton");
  if (!openedFromTrips) {
    throw new Error("Selector fehlt: newTravelExpenseButton");
  }
  tracker?.mark("travel_entry_clicked_new");
  if (!(await waitForTripBaseData(page, 20000))) {
    throw new Error(`Neue Reisekostenabrechnung wurde nicht geöffnet (${String(page.url() || "unbekannt")}).`);
  }
  tracker?.mark("travel_entry_ready", currentTripId(page) || String(page.url() || ""));
}

async function gotoTripSection(page, section, label) {
  const tripId = currentTripId(page);
  if (!tripId) {
    throw new Error(`HRworks-Reise-ID fehlt vor Navigation zu ${label}.`);
  }
  await gotoWithRetry(page, `https://ssl4.hrworks.de/k/travel-management/trip/${tripId}/${section}`, label);
}

async function countKilometerPageLinks(page) {
  const tripId = currentTripId(page);
  if (!tripId) {
    return 0;
  }
  return page.locator(`a[href*="/k/travel-management/trip/${tripId}/kilometers"]`).count();
}

async function hasSavedKilometerSummary(page, leg) {
  const summaryPattern = new RegExp(`${escapeRegex(leg.from)}\\s*-\\s*${escapeRegex(leg.to)}`, "i");
  const textLocator = page.getByText?.(summaryPattern) || page.locator?.(`text=${leg.from} - ${leg.to}`);
  if (!textLocator || typeof textLocator.count !== "function") {
    return false;
  }
  return (await textLocator.count()) > 0;
}

async function detectKilometerPersistence(page, leg, beforeLinkCount) {
  const [linkCount, summarySaved] = await Promise.all([
    countKilometerPageLinks(page),
    hasSavedKilometerSummary(page, leg),
  ]);
  return {
    persisted: linkCount > beforeLinkCount || summarySaved,
    linkCount,
    summarySaved,
  };
}

async function waitForKilometerPersistenceSignal(page, leg, beforeLinkCount, options = {}) {
  const pollAttempts = Math.max(1, Number(options?.pollAttempts || 10));
  const pollIntervalMs = Math.max(50, Number(options?.pollIntervalMs || 150));
  const settleTimeoutMs = Math.max(0, Number(options?.settleTimeoutMs || 1200));

  let status = await detectKilometerPersistence(page, leg, beforeLinkCount);
  if (status.persisted) {
    return { ...status, mode: "immediate" };
  }

  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    await page.waitForTimeout?.(pollIntervalMs).catch(() => {});
    status = await detectKilometerPersistence(page, leg, beforeLinkCount);
    if (status.persisted) {
      return { ...status, mode: "signal_poll" };
    }
  }

  if (settleTimeoutMs > 0) {
    await waitForSettledPage(page, { timeout: settleTimeoutMs, fallbackMs: 0 });
    status = await detectKilometerPersistence(page, leg, beforeLinkCount);
    if (status.persisted) {
      return { ...status, mode: "settled_page" };
    }
  }

  return { ...status, mode: "missing" };
}

async function saveBaseDataAndVerifySingleDay(page, payload, hrworksDate, tracker, options = {}) {
  const useMockNavigation = options?.useMockNavigation === true;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const saveButton = page.locator(selectors.saveButton);
    if ((await saveButton.count()) === 0) {
      throw new Error("Selector fehlt: saveButton");
    }
    tracker?.mark("base_data_save_attempt", `Versuch ${attempt + 1}`);
    await saveButton.first().click();
    await clickOptional(page, selectors.confirmMissingIntermediateStopsButton);
    await waitForSettledPage(page, { timeout: 5000, fallbackMs: 400 });

    if (useMockNavigation) {
      tracker?.mark("base_data_persisted", "Mock-Navigation");
      return;
    }

    await gotoTripSection(page, "base-data", "Reisedaten");
    await reloadCurrentPage(page, "Reisedaten Reload");
    await waitForSettledPage(page, { timeout: 5000, fallbackMs: 400 });
    const actualDateRange = await readInputValue(page, selectors.dateRangeInput, "dateRangeInput");
    const expectedDateRange = `${hrworksDate} - ${hrworksDate}`;
    if (actualDateRange === expectedDateRange) {
      tracker?.mark("base_data_persisted", actualDateRange);
      return;
    }
    if (attempt === 1) {
      throw new Error(`HRworks-Reisedatum nicht als einzelner Sichtungstag gespeichert (${actualDateRange || "leer"}).`);
    }
    console.warn(`HRworks date range mismatch after save attempt ${attempt + 1}: ${actualDateRange || "leer"}`);
    await setControlledInputValue(page, selectors.dateRangeInput, expectedDateRange, "dateRangeInput", {
      clickFirst: true,
      pressTab: true,
      attempts: 2,
    });
    await setControlledInputValue(page, selectors.startTimeInput, payload.startTime, "startTimeInput", {
      clickFirst: true,
      pressTab: true,
      attempts: 2,
    });
    await setControlledInputValue(page, selectors.endTimeInput, payload.endTime, "endTimeInput", {
      clickFirst: true,
      pressTab: true,
      attempts: 2,
    });
    tracker?.mark("base_data_retry_required", actualDateRange || "leer");
  }
}

async function fillKilometerLeg(page, leg, payload, tracker, progress = {}, options = {}) {
  const useMockNavigation = options?.useMockNavigation === true;
  const current = Number(progress.current || 0);
  const total = Number(progress.total || 0);
  const prefix = current > 0 && total > 0 ? `Leg ${current}/${total}` : "Leg";
  console.log(`[HRworks] ${prefix}: ${leg.from} -> ${leg.to}`);
  tracker?.mark("leg_open", `${prefix} ${leg.from} -> ${leg.to}`);
  const beforeLinkCount = await countKilometerPageLinks(page);
  await clickRequired(page, selectors.newKilometerEntryButton, "newKilometerEntryButton");
  await fillOptionRequired(page, selectors.mileageFromInput, leg.from, "mileageFromInput");
  await fillOptionRequired(page, selectors.mileageToInput, leg.to, "mileageToInput");
  await setControlledInputValue(page, selectors.mileageDateInput, formatGermanDate(payload.date), "mileageDateInput");
  await clearOptional(page, selectors.mileageNoteInput);
  if (Number.isFinite(Number(leg.distanceKm))) {
    await fillRequired(page, selectors.mileageKilometersInput, formatHrworksKilometers(leg.distanceKm), "mileageKilometersInput");
  } else {
    await fillOptional(page, selectors.mileageKilometersInput, formatHrworksKilometers(payload.kilometers));
  }
  tracker?.mark("leg_filled", `${prefix} ${leg.from} -> ${leg.to}`);
  console.log(`[HRworks] ${prefix}: Speichern`);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    tracker?.mark("leg_save_attempt", `${prefix} Versuch ${attempt + 1}`);
    await clickRequired(page, selectors.saveKilometerEntryButton, "saveKilometerEntryButton");
    const persistence = await waitForKilometerPersistenceSignal(page, leg, beforeLinkCount, {
      pollAttempts: 10,
      pollIntervalMs: 150,
      settleTimeoutMs: 1200,
    });
    if (persistence.persisted) {
      console.log(`[HRworks] ${prefix}: gespeichert`);
      tracker?.mark("leg_persisted", `${prefix} ${persistence.mode}`);
      return;
    }
    if (!useMockNavigation) {
      await gotoTripSection(page, "kilometers", "Kilometerangaben");
      const refreshedPersistence = await detectKilometerPersistence(page, leg, beforeLinkCount);
      if (refreshedPersistence.persisted) {
        console.log(`[HRworks] ${prefix}: gespeichert`);
        tracker?.mark("leg_persisted", `${prefix} nach Re-Navigation erkannt`);
        return;
      }
    }
    if (attempt === 1) {
      throw new Error(`Kilometerangabe wurde nicht gespeichert: ${leg.from} -> ${leg.to}`);
    }
    console.warn(`[HRworks] ${prefix}: kein gespeicherter Eintrag erkannt, Speichern wird wiederholt`);
  }
}

// Serverseitiger Login mit pro Auftrag übergebenen Credentials.
// Credentials werden nur an die Seite übergeben, nie geloggt oder zurückgegeben.
export async function loginToHrworks(page, credentials, options = {}) {
  const activeSelectors = { ...selectors, ...(options?.selectors || {}) };
  const username = String(credentials?.username || "").trim();
  const password = String(credentials?.password || "");
  if (!username || !password) {
    const error = new Error("HRworks-Zugangsdaten fehlen (Benutzername/Passwort).");
    error.kind = "needs_action";
    throw error;
  }

  const usernameField = await resolveField(page.locator(activeSelectors.loginUsernameInput));
  const passwordField = await resolveField(page.locator(activeSelectors.loginPasswordInput));
  if (!usernameField || !passwordField) {
    const error = new Error("HRworks-Loginformular wurde nicht erkannt (Selector-Problem oder geänderte Loginseite).");
    error.kind = "needs_action";
    throw error;
  }
  await usernameField.fill(username);
  await passwordField.fill(password);
  const submitButton = await resolveField(page.locator(activeSelectors.loginSubmitButton));
  if (!submitButton) {
    const error = new Error("HRworks-Login-Button wurde nicht gefunden.");
    error.kind = "needs_action";
    throw error;
  }
  await submitButton.click();
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(Number(options?.settleMs ?? 1500)).catch(() => {});

  const mfaVisible = await page
    .locator(activeSelectors.loginMfaHint)
    .first()
    .isVisible()
    .catch(() => false);
  if (mfaVisible) {
    return { loggedIn: false, mfaRequired: true };
  }

  const passwordStillVisible = await page
    .locator(activeSelectors.loginPasswordInput)
    .first()
    .isVisible()
    .catch(() => false);
  if (passwordStillVisible) {
    const error = new Error("HRworks-Login fehlgeschlagen. Bitte Zugangsdaten prüfen.");
    error.kind = "auth";
    throw error;
  }
  return { loggedIn: true, mfaRequired: false };
}

export async function fillHrworksTravelExpenseForm(page, payload, options = {}) {
  const tracker = options?.tracker || createRunMetrics();
  const shouldSave = Boolean(options?.confirmBeforeSave);
  const runRouteFlow = Boolean(options?.runRouteFlow);
  const completeWorkflow = Boolean(options?.completeWorkflow);
  const useMockNavigation = options?.skipOpenNewTravelExpense === true;
  tracker.mark("workflow_start", payload?.planId || payload?.date || "unbekannt");
  if (!useMockNavigation) {
    await openNewTravelExpense(page, tracker);
  }

  await fillRequired(page, selectors.purposeInput, payload.purpose, "purposeInput");
  await fillRequired(page, selectors.noteTextarea, payload.note, "noteTextarea");
  const hrworksDate = formatGermanDate(payload.date);
  await setControlledInputValue(page, selectors.dateRangeInput, `${hrworksDate} - ${hrworksDate}`, "dateRangeInput", {
    clickFirst: false,
    pressTab: false,
    attempts: 3,
  });
  await setControlledInputValue(page, selectors.startTimeInput, payload.startTime, "startTimeInput", {
    clickFirst: false,
    pressTab: false,
    attempts: 2,
  });
  await setControlledInputValue(page, selectors.endTimeInput, payload.endTime, "endTimeInput", {
    clickFirst: false,
    pressTab: false,
    attempts: 2,
  });
  await fillOptionRequired(page, selectors.departureLocationSelect, payload.departureLocation, "departureLocationSelect");
  await fillOptionRequired(page, selectors.costCenterSelect, payload.costCenter, "costCenterSelect");
  await clearOptional(page, selectors.destinationLocationSelect);
  await clearOptional(page, selectors.routeTextarea);
  tracker.mark("base_data_filled", hrworksDate);

  if (!shouldSave) {
    return { saved: false, metrics: tracker.finish({ saved: false }) };
  }

  await saveBaseDataAndVerifySingleDay(page, payload, hrworksDate, tracker, { useMockNavigation });
  if (!runRouteFlow) {
    tracker.mark("workflow_saved_base_data_only");
    return { saved: true, metrics: tracker.finish({ saved: true }) };
  }

  if (!useMockNavigation) {
    await gotoTripSection(page, "kilometers", "Kilometerangaben");
  }
  const routeLegs = Array.isArray(payload?.routeLegs) ? payload.routeLegs : [];
  for (let index = 0; index < routeLegs.length; index += 1) {
    await fillKilometerLeg(page, routeLegs[index], payload, tracker, { current: index + 1, total: routeLegs.length }, { useMockNavigation });
  }
  if (useMockNavigation) {
    await clickOptional(page, selectors.reportsButton);
  } else {
    await gotoTripSection(page, "reports", "Berichte");
  }
  tracker.mark("reports_opened");
  if (!completeWorkflow) {
    tracker.mark("workflow_completed_route_only");
    return {
      saved: true,
      routeFlowCompleted: true,
      kilometerEntriesCreated: routeLegs.length,
      reportsCompleted: false,
      metrics: tracker.finish({
        saved: true,
        routeFlowCompleted: true,
        kilometerEntriesCreated: routeLegs.length,
        reportsCompleted: false,
      }),
    };
  }
  tracker.mark("reports_complete_attempt");
  await clickRequired(page, selectors.completeReportsButton, "completeReportsButton");
  const clickedFinalComplete = await clickOptional(page, selectors.finalCompleteReportsButton);
  if (!clickedFinalComplete) {
    await clickOptional(page, selectors.completeReportsButton);
  }
  const clickedFinalConfirm = await clickOptional(page, selectors.confirmFinalReportSubmitButton);
  if (!clickedFinalConfirm) {
    await clickOptional(page, selectors.confirmMissingIntermediateStopsButton);
  }
  tracker.mark("reports_completed");

  return {
    saved: true,
    routeFlowCompleted: true,
    kilometerEntriesCreated: routeLegs.length,
    reportsCompleted: true,
    metrics: tracker.finish({
      saved: true,
      routeFlowCompleted: true,
      kilometerEntriesCreated: routeLegs.length,
      reportsCompleted: true,
    }),
  };
}
