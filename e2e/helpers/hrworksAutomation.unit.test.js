import { describe, expect, it } from "vitest";
import { fillHrworksTravelExpenseForm } from "./hrworksAutomation";

class MockLocator {
  constructor(node) {
    this.node = node;
  }

  async count() {
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
      this.node.clicked = true;
    }
  }
}

function createMockPage({ missing = [], forcedValues = {} } = {}) {
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
    saveKilometersButton: { clicked: false },
    processRouteButton: { clicked: false },
    reportsButton: { clicked: false },
    completeReportsButton: { clicked: false },
    routeTextarea: { value: "" },
    saveButton: { clicked: false },
    travelExpenseButton: { clicked: false },
    newTravelExpenseButton: { clicked: false },
  };

  for (const key of missing) {
    fields[key] = null;
  }

  const selectorMap = {
    "input[name='purpose']": "purposeInput",
    "textarea[name='note']": "noteTextarea",
    "input[name='dateRange']": "dateRangeInput",
    "input[name='startTime']": "startTimeInput",
    "input[name='endTime']": "endTimeInput",
    "input[name='departureLocation']": "departureLocationSelect",
    "input[name='destinationLocation']": "destinationLocationSelect",
    "input[name='costCenter']": "costCenterSelect",
    "input[name='kilometers']": "kilometersInput",
    "button:has-text('Speichern')": "saveButton",
    "button:has-text('Kilometer speichern')": "saveKilometersButton",
    "button:has-text('Route abarbeiten')": "processRouteButton",
    "button:has-text('Berichte')": "reportsButton",
    "button:has-text('Abschließen')": "completeReportsButton",
    "textarea[name='route']": "routeTextarea",
  };

  return {
    fields,
    locator(selector) {
      return new MockLocator(fields[selectorMap[selector]] || null);
    },
    getByRole(_role, { name }) {
      if (String(name).includes("Reisekostenabrechnung") && String(name).includes("Neue")) {
        return new MockLocator(fields.newTravelExpenseButton);
      }
      if (String(name).includes("Reisekostenabrechnung")) {
        return new MockLocator(fields.travelExpenseButton);
      }
      return new MockLocator(null);
    },
  };
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
};

describe("hrworksAutomation", () => {
  it("does not save without explicit confirmation", async () => {
    const page = createMockPage();
    const result = await fillHrworksTravelExpenseForm(page, payload);
    expect(result.saved).toBe(false);
    expect(page.fields.saveButton.clicked).toBe(false);
  });

  it("aborts when required selector is missing", async () => {
    const page = createMockPage({ missing: ["purposeInput"] });
    await expect(fillHrworksTravelExpenseForm(page, payload)).rejects.toThrow(/Selector fehlt: purposeInput/);
  });

  it("aborts when dropdown value cannot be resolved", async () => {
    const page = createMockPage({ forcedValues: { costCenterSelect: "Andere" } });
    await expect(fillHrworksTravelExpenseForm(page, payload)).rejects.toThrow(/Dropdown-Wert nicht gefunden: costCenterSelect/);
  });

  it("saves only when explicit confirmation is enabled", async () => {
    const page = createMockPage();
    const result = await fillHrworksTravelExpenseForm(page, payload, { confirmBeforeSave: true });
    expect(result.saved).toBe(true);
    expect(page.fields.saveButton.clicked).toBe(true);
  });

  it("supports save without destination location", async () => {
    const page = createMockPage();
    const result = await fillHrworksTravelExpenseForm(page, { ...payload, destinationLocation: "" }, { confirmBeforeSave: true });
    expect(result.saved).toBe(true);
    expect(page.fields.destinationLocationSelect.value).toBe("");
  });

  it("runs kilometer, route and reports flow after save", async () => {
    const page = createMockPage();
    const result = await fillHrworksTravelExpenseForm(page, payload, { confirmBeforeSave: true, runRouteFlow: true });
    expect(result.routeFlowCompleted).toBe(true);
    expect(page.fields.kilometersInput.value).toBe("143");
    expect(page.fields.saveKilometersButton.clicked).toBe(true);
    expect(page.fields.processRouteButton.clicked).toBe(true);
    expect(page.fields.reportsButton.clicked).toBe(true);
    expect(page.fields.completeReportsButton.clicked).toBe(true);
    expect(page.fields.routeTextarea.value).toBe("Home -> Platz A | Platz A -> Home");
  });

  it("aborts when save selector is missing despite save confirmation", async () => {
    const page = createMockPage({ missing: ["saveButton"] });
    await expect(
      fillHrworksTravelExpenseForm(page, payload, { confirmBeforeSave: true }),
    ).rejects.toThrow(/Selector fehlt: saveButton/);
  });
});
