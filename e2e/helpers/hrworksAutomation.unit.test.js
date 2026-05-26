import { describe, expect, it } from "vitest";
import { fillHrworksTravelExpenseForm } from "./hrworksAutomation";

class MockLocator {
  constructor(node, options = {}) {
    this.node = node;
    this.options = options;
  }

  async count() {
    if (typeof this.options.countValue === "number") {
      return this.options.countValue;
    }
    return this.node ? 1 : 0;
  }

  first() {
    return this;
  }

  async fill(value) {
    if (!this.node) {
      return;
    }
    this.node.value = String(value || "");
  }

  async inputValue() {
    if (!this.node) {
      return "";
    }
    return String(this.node.forcedValue ?? this.node.value ?? "");
  }

  async click() {
    if (this.node) {
      if (this.node.clickThrows) {
        throw new Error(String(this.node.clickThrows));
      }
      if (typeof this.node.click === "function") {
        return this.node.click();
      }
      this.node.clicked = true;
      this.node.clickCount = Number(this.node.clickCount || 0) + 1;
    }
  }

  async evaluate(callback, value) {
    if (!this.node) {
      return undefined;
    }
    return callback(this.node, value);
  }

  async press(key) {
    if (!this.node) {
      return;
    }
    this.node.pressedKeys = [...(this.node.pressedKeys || []), String(key || "")];
  }
}

function createMockPage({
  missing = [],
  forcedValues = {},
  missingSelectors = [],
  saveKilometerPersists = true,
  saveKilometerIncrementsCount = true,
  saveBaseDataPersists = true,
  travelExpenseTargetUrl = "https://ssl4.hrworks.de/k/travel-management/trip/66/base-data",
} = {}) {
  const baseDataUrl = "https://ssl4.hrworks.de/k/travel-management/trip/66/base-data";
  const fields = {
    purposeInput: { value: "" },
    noteTextarea: { value: "" },
    dateRangeInput: { value: "" },
    startTimeInput: { value: "" },
    endTimeInput: { value: "" },
    departureLocationSelect: { value: "", forcedValue: forcedValues.departureLocationSelect },
    destinationLocationSelect: { value: "", forcedValue: forcedValues.destinationLocationSelect },
    costCenterSelect: { value: "", forcedValue: forcedValues.costCenterSelect },
    kilometersInput: { value: "" },
    mileageFromInput: { value: "" },
    mileageToInput: { value: "" },
    mileageDateInput: { value: "" },
    mileageNoteInput: { value: "Alttext" },
    mileageKilometersInput: { value: "" },
    newKilometerEntryButton: { clicked: false, clickCount: 0 },
    saveKilometerEntryButton: { clicked: false, clickCount: 0 },
    saveKilometersButton: { clicked: false },
    processRouteButton: { clicked: false },
    reportsButton: { clicked: false },
    completeReportsButton: { clicked: false },
    finalCompleteReportsButton: { clicked: false },
    confirmFinalReportSubmitButton: { clicked: false },
    routeTextarea: { value: "" },
    saveButton: { clicked: false },
    travelExpenseButton: { clicked: false },
    newTravelExpenseButton: { clicked: false },
  };
  const state = {
    kilometerLinkCount: 3,
    savedDateRangeValue: "",
    savedKilometerSummaries: [],
  };

  for (const key of missing) {
    fields[key] = null;
  }

  if (fields.saveKilometerEntryButton) {
    fields.saveKilometerEntryButton.click = function clickFallback() {
      this.clicked = true;
      this.clickCount = Number(this.clickCount || 0) + 1;
      if (saveKilometerPersists) {
        const from = String(fields.mileageFromInput?.value || "").trim();
        const to = String(fields.mileageToInput?.value || "").trim();
        if (from && to) {
          state.savedKilometerSummaries = [...state.savedKilometerSummaries, `${from} - ${to}`];
        }
        if (saveKilometerIncrementsCount) {
          state.kilometerLinkCount += 2;
        }
      }
    };
  }

  if (fields.saveButton) {
    fields.saveButton.click = function clickFallback() {
      this.clicked = true;
      this.clickCount = Number(this.clickCount || 0) + 1;
      if (saveBaseDataPersists) {
        state.savedDateRangeValue = fields.dateRangeInput?.value || "";
      }
    };
  }

  const selectorMap = {
    "input[name='purpose']": "purposeInput",
    "xpath=(//*[normalize-space(.)='Zweck']/following::input[not(@type='hidden') and not(@aria-hidden='true') and not(contains(@class,'tt-hint'))])[1]": "purposeInput",
    "textarea[name='note']": "noteTextarea",
    "xpath=(//*[normalize-space(.)='Bemerkung']/following::textarea)[1]": "noteTextarea",
    "input[name='dateRange']": "dateRangeInput",
    "xpath=(//*[normalize-space(.)='Zeitraum']/following::input[not(@type='hidden')])[1]": "dateRangeInput",
    "input[name='startTime']": "startTimeInput",
    "xpath=(//*[normalize-space(.)='Beginn Uhrzeit']/following::input[not(@type='hidden')])[1]": "startTimeInput",
    "input[name='endTime']": "endTimeInput",
    "xpath=(//*[normalize-space(.)='Ende Uhrzeit']/following::input[not(@type='hidden')])[1]": "endTimeInput",
    "input[name='departureLocation']": "departureLocationSelect",
    "xpath=(//*[normalize-space(.)='Abfahrtsort']/following::input[(contains(@class,'tt-input') or @name='departureLocation') and not(@type='hidden') and not(@aria-hidden='true')])[1]": "departureLocationSelect",
    "input[name='destinationLocation']": "destinationLocationSelect",
    "xpath=(//*[normalize-space(.)='Zielort']/following::input[(contains(@class,'tt-input') or @name='destinationLocation') and not(@type='hidden') and not(@aria-hidden='true')])[1]": "destinationLocationSelect",
    "input[name='costCenter']": "costCenterSelect",
    "xpath=(//*[normalize-space(.)='Kostenstelle']/following::select)[1]": "costCenterSelect",
    "input[name='kilometers']": "kilometersInput",
    "input[name='mileageFrom']": "mileageFromInput",
    "xpath=(//*[normalize-space(.)='Kilometerangabe']/following::*[normalize-space(.)='Abfahrtsort']/following::input[(contains(@class,'tt-input') or @name='mileageFrom') and not(@type='hidden') and not(@aria-hidden='true')])[1]": "mileageFromInput",
    "input[name='mileageTo']": "mileageToInput",
    "xpath=(//*[normalize-space(.)='Kilometerangabe']/following::*[normalize-space(.)='Zielort']/following::input[(contains(@class,'tt-input') or @name='mileageTo') and not(@type='hidden') and not(@aria-hidden='true')])[1]": "mileageToInput",
    "input[name='mileageDate']": "mileageDateInput",
    "xpath=(//*[normalize-space(.)='Kilometerangabe']/following::*[normalize-space(.)='Datum']/following::input[not(@type='hidden')])[1]": "mileageDateInput",
    "input[name='mileageNote']": "mileageNoteInput",
    "xpath=(//*[normalize-space(.)='Kilometerangabe']/following::*[normalize-space(.)='Bemerkung']/following::input[not(@type='hidden') and not(@disabled)])[1]": "mileageNoteInput",
    "input[name='mileageKilometers']": "mileageKilometersInput",
    "xpath=(//*[normalize-space(.)='Kilometerangabe']/following::*[normalize-space(.)='Kilometer']/following::input[not(@type='hidden') and not(@disabled)])[1]": "mileageKilometersInput",
    "xpath=(//a[normalize-space(.)='Neue Kilometerangabe'] | //button[contains(normalize-space(.),'Neue Kilometerangabe') or normalize-space(.)='Neu' or .//span[normalize-space(.)='Neu']])[1]": "newKilometerEntryButton",
    "xpath=(//*[normalize-space(.)='Kilometerangabe']/following::a[normalize-space(.)='Speichern'] | //*[normalize-space(.)='Kilometerangabe']/following::button[contains(normalize-space(.),'Speichern') or contains(normalize-space(.),'speichern')])[1]": "saveKilometerEntryButton",
    "xpath=(//*[normalize-space(.)='Kilometerangabe']/following::button[contains(normalize-space(.),'Speichern') or contains(normalize-space(.),'speichern')])[1]": "saveKilometerEntryButton",
    "button:has-text('Speichern')": "saveButton",
    "button:has-text('Kilometer speichern')": "saveKilometersButton",
    "button:has-text('Route abarbeiten')": "processRouteButton",
    "button:has-text('Berichte')": "reportsButton",
    "button:has-text('Abschließen')": "completeReportsButton",
    "button:has-text('Final abschließen')": "finalCompleteReportsButton",
    "button:has-text('Ja, abschließen')": "confirmFinalReportSubmitButton",
    "textarea[name='route']": "routeTextarea",
    "xpath=(//*[normalize-space(.)='Zwischenorte']/following::input[not(@type='hidden')])[1]": "routeTextarea",
  };

  const page = {
    fields,
    currentUrl: baseDataUrl,
    reloadCount: 0,
    waitForLoadStateCount: 0,
    waitForTimeoutCount: 0,
    url() {
      return this.currentUrl;
    },
    async goto(nextUrl) {
      this.currentUrl = String(nextUrl || this.currentUrl);
    },
    async reload() {
      this.reloadCount += 1;
      if (/\/k\/travel-management\/trip\/\d+\/base-data/.test(this.currentUrl)) {
        fields.dateRangeInput.value = state.savedDateRangeValue;
      }
    },
    async waitForLoadState() {
      this.waitForLoadStateCount += 1;
    },
    async waitForTimeout() {
      this.waitForTimeoutCount += 1;
    },
    async waitForURL(matcher) {
      const url = String(this.currentUrl || "");
      const matched = matcher instanceof RegExp
        ? matcher.test(url)
        : typeof matcher === "function"
          ? Boolean(matcher(url))
          : url === String(matcher || "");
      if (!matched) {
        throw new Error(`waitForURL timeout: ${url}`);
      }
    },
    locator(selector) {
      if (/^a\[href\*="\/k\/travel-management\/trip\/\d+\/kilometers"\]$/.test(selector)) {
        return new MockLocator(null, { countValue: state.kilometerLinkCount });
      }
      if (selector.startsWith("text=")) {
        const summary = selector.slice(5);
        return new MockLocator(null, {
          countValue: state.savedKilometerSummaries.includes(summary) ? 1 : 0,
        });
      }
      if (missingSelectors.includes(selector)) {
        return new MockLocator(null);
      }
      return new MockLocator(fields[selectorMap[selector]] || null);
    },
    getByRole(role, { name }) {
      if (String(name).includes("Reisekostenabrechnung") && String(name).includes("Neue")) {
        return new MockLocator(fields.newTravelExpenseButton);
      }
      if (String(name).includes("Reisekostenabrechnung")) {
        return new MockLocator(fields.travelExpenseButton);
      }
      if (role === "link" && /speichern/i.test(String(name))) {
        return new MockLocator(fields.saveKilometerEntryButton);
      }
      if (role === "button" && /kilometerangabe speichern|speichern/i.test(String(name))) {
        return new MockLocator(fields.saveKilometerEntryButton);
      }
      return new MockLocator(null);
    },
    getByText(value) {
      const source = value instanceof RegExp ? value : new RegExp(String(value || ""), "i");
      const matched = state.savedKilometerSummaries.some((summary) => source.test(summary));
      return new MockLocator(null, { countValue: matched ? 1 : 0 });
    },
  };

  if (fields.travelExpenseButton) {
    fields.travelExpenseButton.click = function clickFallback() {
      this.clicked = true;
      this.clickCount = Number(this.clickCount || 0) + 1;
      page.currentUrl = travelExpenseTargetUrl;
    };
  }

  if (fields.newTravelExpenseButton) {
    fields.newTravelExpenseButton.click = function clickFallback() {
      this.clicked = true;
      this.clickCount = Number(this.clickCount || 0) + 1;
      page.currentUrl = baseDataUrl;
    };
  }

  return page;
}

const payload = {
  purpose: "Sichtung",
  note: "Notiz",
  date: "2026-04-20",
  startTime: "08:00",
  endTime: "17:00",
  departureLocation: "Start",
  destinationLocation: "Ziel",
  costCenter: "Junioren allgemein (321000)",
  kilometers: "143",
  intermediateStops: ["Home -> Platz A", "Platz A -> Home"],
  routeLegs: [
    { from: "Home", to: "Platz A", distanceKm: 10 },
    { from: "Platz A", to: "Home", distanceKm: 12 },
  ],
};

describe("hrworksAutomation", () => {
  it("does not save without explicit confirmation", async () => {
    const page = createMockPage();
    const result = await fillHrworksTravelExpenseForm(page, payload, { skipOpenNewTravelExpense: true });
    expect(result.saved).toBe(false);
    expect(page.fields.saveButton.clicked).toBe(false);
  });

  it("aborts when required selector is missing", async () => {
    const page = createMockPage({ missing: ["purposeInput"] });
    await expect(fillHrworksTravelExpenseForm(page, payload, { skipOpenNewTravelExpense: true })).rejects.toThrow(/Selector fehlt: purposeInput/);
  });

  it("aborts when dropdown value cannot be resolved", async () => {
    const page = createMockPage({ forcedValues: { costCenterSelect: "Andere" } });
    await expect(fillHrworksTravelExpenseForm(page, payload, { skipOpenNewTravelExpense: true })).rejects.toThrow(/Dropdown-Wert nicht gefunden: costCenterSelect/);
  });

  it("saves only when explicit confirmation is enabled", async () => {
    const page = createMockPage();
    const result = await fillHrworksTravelExpenseForm(page, payload, { confirmBeforeSave: true });
    expect(result.saved).toBe(true);
    expect(page.fields.saveButton.clicked).toBe(true);
    expect(page.reloadCount).toBeGreaterThan(0);
    expect(result.metrics.steps.some((step) => step.step === "base_data_persisted")).toBe(true);
  });

  it("aborts when the single-day XLSX date is not persisted in HRworks", async () => {
    const page = createMockPage({ saveBaseDataPersists: false });
    await expect(fillHrworksTravelExpenseForm(page, payload, {
      confirmBeforeSave: true,
    })).rejects.toThrow(/HRworks-Reisedatum nicht als einzelner Sichtungstag gespeichert/);
  });

  it("falls back to the trips page when the dashboard travel expense button is missing", async () => {
    const page = createMockPage({ missing: ["travelExpenseButton"] });
    page.currentUrl = "https://ssl4.hrworks.de/k/dashboard";
    const result = await fillHrworksTravelExpenseForm(page, payload, { confirmBeforeSave: true });
    expect(result.saved).toBe(true);
    expect(page.fields.newTravelExpenseButton.clicked).toBe(true);
  });

  it("continues from the dashboard tile to the new-expense button when HRworks lands on trips first", async () => {
    const page = createMockPage({ travelExpenseTargetUrl: "https://ssl4.hrworks.de/k/travel-management/trips" });
    page.currentUrl = "https://ssl4.hrworks.de/k/dashboard";
    const result = await fillHrworksTravelExpenseForm(page, payload, { confirmBeforeSave: true });
    expect(result.saved).toBe(true);
    expect(page.fields.travelExpenseButton.clicked).toBe(true);
    expect(page.fields.newTravelExpenseButton.clicked).toBe(true);
    expect(result.metrics.steps.some((step) => step.step === "travel_entry_clicked_new")).toBe(true);
  });

  it("supports save without destination location", async () => {
    const page = createMockPage();
    const result = await fillHrworksTravelExpenseForm(page, { ...payload, destinationLocation: "" }, { confirmBeforeSave: true, skipOpenNewTravelExpense: true });
    expect(result.saved).toBe(true);
    expect(page.fields.destinationLocationSelect.value).toBe("");
  });

  it("creates a separate kilometer entry for each route leg and does not complete reports", async () => {
    const page = createMockPage();
    const result = await fillHrworksTravelExpenseForm(page, payload, { confirmBeforeSave: true, runRouteFlow: true, skipOpenNewTravelExpense: true });
    expect(result.routeFlowCompleted).toBe(true);
    expect(result.kilometerEntriesCreated).toBe(2);
    expect(page.fields.newKilometerEntryButton.clickCount).toBe(2);
    expect(page.fields.saveKilometerEntryButton.clickCount).toBe(2);
    expect(page.fields.mileageFromInput.value).toBe("Platz A");
    expect(page.fields.mileageToInput.value).toBe("Home");
    expect(page.fields.mileageFromInput.pressedKeys).toEqual(expect.arrayContaining(["ArrowDown", "Enter", "Tab"]));
    expect(page.fields.mileageToInput.pressedKeys).toEqual(expect.arrayContaining(["ArrowDown", "Enter", "Tab"]));
    expect(page.fields.dateRangeInput.value).toBe("20.04.2026 - 20.04.2026");
    expect(page.fields.mileageDateInput.value).toBe("20.04.2026");
    expect(page.fields.mileageNoteInput.value).toBe("");
    expect(page.fields.mileageKilometersInput.value).toBe("12,00");
    expect(page.fields.reportsButton.clicked).toBe(false);
    expect(page.fields.completeReportsButton.clicked).toBe(false);
    expect(page.fields.routeTextarea.value).toBe("");
    expect(page.waitForLoadStateCount).toBe(1);
    expect(result.metrics.steps.some((step) => step.step === "leg_persisted")).toBe(true);
    expect(result.metrics.steps.some((step) => step.step === "reports_opened")).toBe(true);
  });

  it("completes reports only in explicit complete workflow mode", async () => {
    const page = createMockPage();
    const result = await fillHrworksTravelExpenseForm(page, payload, {
      confirmBeforeSave: true,
      runRouteFlow: true,
      completeWorkflow: true,
      skipOpenNewTravelExpense: true,
    });
    expect(result.routeFlowCompleted).toBe(true);
    expect(result.reportsCompleted).toBe(true);
    expect(page.fields.reportsButton.clicked).toBe(false);
    expect(page.fields.completeReportsButton.clicked).toBe(true);
    expect(page.fields.finalCompleteReportsButton.clicked).toBe(true);
    expect(page.fields.confirmFinalReportSubmitButton.clicked).toBe(true);
  });

  it("normalizes meter-like kilometer values before filling HRworks", async () => {
    const page = createMockPage();
    await fillHrworksTravelExpenseForm(page, {
      ...payload,
      routeLegs: [{ from: "Home", to: "Platz A", distanceKm: 127633 }],
    }, {
      confirmBeforeSave: true,
      runRouteFlow: true,
      skipOpenNewTravelExpense: true,
    });
    expect(page.fields.mileageKilometersInput.value).toBe("127,63");
  });

  it("rejects mismatched HRworks typeahead selections instead of accepting any non-empty value", async () => {
    const page = createMockPage({
      forcedValues: {
        departureLocationSelect: "Start",
        mileageFromInput: "Home",
        mileageToInput: "Sternbuschweg 326",
      },
    });
    await expect(fillHrworksTravelExpenseForm(page, payload, {
      confirmBeforeSave: true,
      runRouteFlow: true,
      skipOpenNewTravelExpense: true,
    })).rejects.toThrow(/Dropdown-Wert nicht gefunden: mileageToInput/);
  });

  it("uses a role-based fallback when the kilometer save xpath is missing", async () => {
    const page = createMockPage({
      missingSelectors: ["xpath=(//*[normalize-space(.)='Kilometerangabe']/following::a[normalize-space(.)='Speichern'] | //*[normalize-space(.)='Kilometerangabe']/following::button[contains(normalize-space(.),'Speichern') or contains(normalize-space(.),'speichern')])[1]"],
    });
    const result = await fillHrworksTravelExpenseForm(page, payload, {
      confirmBeforeSave: true,
      runRouteFlow: true,
      skipOpenNewTravelExpense: true,
    });
    expect(result.routeFlowCompleted).toBe(true);
    expect(page.fields.saveKilometerEntryButton.clickCount).toBe(2);
  });

  it("falls back to DOM click when the Playwright click on kilometer save fails", async () => {
    const page = createMockPage();
    page.fields.saveKilometerEntryButton.clickThrows = "Element is outside of the viewport";
    const result = await fillHrworksTravelExpenseForm(page, payload, {
      confirmBeforeSave: true,
      runRouteFlow: true,
      skipOpenNewTravelExpense: true,
    });
    expect(result.routeFlowCompleted).toBe(true);
    expect(page.fields.saveKilometerEntryButton.clickCount).toBe(2);
  });

  it("accepts a saved kilometer leg when HRworks keeps the same list size but shows the saved summary", async () => {
    const page = createMockPage({ saveKilometerIncrementsCount: false });
    const result = await fillHrworksTravelExpenseForm(page, payload, {
      confirmBeforeSave: true,
      runRouteFlow: true,
      skipOpenNewTravelExpense: true,
    });
    expect(result.routeFlowCompleted).toBe(true);
    expect(page.fields.saveKilometerEntryButton.clickCount).toBe(2);
  });

  it("aborts when a kilometer leg is not persisted as a saved HRworks entry", async () => {
    const page = createMockPage({ saveKilometerPersists: false });
    await expect(fillHrworksTravelExpenseForm(page, payload, {
      confirmBeforeSave: true,
      runRouteFlow: true,
      skipOpenNewTravelExpense: true,
    })).rejects.toThrow(/Kilometerangabe wurde nicht gespeichert/);
  });

  it("aborts when save selector is missing despite save confirmation", async () => {
    const page = createMockPage({ missing: ["saveButton"] });
    await expect(
      fillHrworksTravelExpenseForm(page, payload, { confirmBeforeSave: true, skipOpenNewTravelExpense: true }),
    ).rejects.toThrow(/Selector fehlt: saveButton/);
  });
});
