import { describe, expect, it } from "vitest";
import {
  HRWORKS_IMPORT_STATUSES,
  appendHrworksImportLog,
  buildHrworksImportPayload,
  readHrworksImportLog,
  validateHrworksImportPayload,
} from "./hrworksImport";

describe("hrworksImport", () => {
  it("stores logs with data minimization", () => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem("scoutx.hrworksImports.v1");
    appendHrworksImportLog({
      planId: "p1",
      date: "2026-04-20",
      startTime: "08:00",
      endTime: "10:00",
      purpose: "Sehr lange Zweckbeschreibung mit potenziell unnötigen Details",
      hrworksStatus: "ready",
      sourceType: "timesheet",
      executedBy: "Max Mustermann",
      technicalResult: "Review bestätigt und Übergabe vorbereitet",
    });
    const logs = readHrworksImportLog();
    expect(logs[0].executedBy).toMatch(/M\*\*\* M\*\*\*/);
    expect(logs[0].purpose.length).toBeLessThanOrEqual(121);
    expect(logs[0].sourceType).toBe("timesheet");
  });

  it("does not persist raw credential-like content in technical log fields", () => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem("scoutx.hrworksImports.v1");
    appendHrworksImportLog({
      planId: "p2",
      date: "2026-04-20",
      startTime: "08:00",
      endTime: "10:00",
      purpose: "Importlauf",
      executedBy: "Scout User",
      technicalResult: "Auth flow completed with bearer token abcdefghijklmnopqrstuvwxyz",
      errorMessage: "password=supersecret",
    });
    const logs = readHrworksImportLog();
    expect(logs[0].technicalResult).not.toMatch(/abcdefghijklmnopqrstuvwxyz/);
    expect(logs[0].errorMessage).not.toMatch(/supersecret/);
  });

  it("supports required status values", () => {
    expect(HRWORKS_IMPORT_STATUSES).toEqual(
      expect.arrayContaining(["draft", "ready", "imported", "failed", "skipped", "needs_review"]),
    );
  });

  it("builds valid payload", () => {
    const payload = buildHrworksImportPayload({
      planId: "plan-1",
      employeeName: "Max Scout",
      games: [
        { id: "g1", date: "2026-04-20", time: "08:00", venue: "A", home: "H1", away: "A1" },
        { id: "g2", date: "2026-04-20", time: "13:00", venue: "B", home: "H2", away: "A2" },
      ],
      startLocation: "Start",
      costCenter: "Junioren allgemein (321000)",
      routeLegs: [
        { from: "Start", to: "A", distanceKm: 10 },
        { from: "A", to: "B", distanceKm: 5 },
        { from: "B", to: "Start", distanceKm: 12 },
      ],
    });

    const result = validateHrworksImportPayload(payload, []);
    expect(result.isValid).toBe(true);
    expect(payload.purpose).toMatch(/Sichtung \/ Route des Arbeitstages/);
    expect(payload.note).toBe(payload.purpose);
    expect(payload.routeLegs).toHaveLength(3);
    expect(payload.routeLegs[2].to).toBe("Start");
  });

  it("detects missing fields", () => {
    const result = validateHrworksImportPayload({
      planId: "p1",
      date: "",
      startTime: "",
      endTime: "",
      workHours: null,
      purpose: "",
      note: "",
      departureLocation: "",
      destinationLocation: "",
      costCenter: "",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(4);
  });

  it("detects end before start", () => {
    const result = validateHrworksImportPayload({
      planId: "p1",
      date: "2026-04-20",
      startTime: "10:00",
      endTime: "09:00",
      workHours: -1,
      purpose: "X",
      note: "Y",
      departureLocation: "A",
      destinationLocation: "B",
      costCenter: "C",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Beginn muss vor Ende/);
  });

  it("detects duplicates", () => {
    const payload = {
      planId: "p1",
      date: "2026-04-20",
      startTime: "08:00",
      endTime: "10:00",
      workHours: 2,
      purpose: "X",
      note: "Y",
      departureLocation: "A",
      destinationLocation: "B",
      costCenter: "C",
    };

    const result = validateHrworksImportPayload(payload, [{ ...payload, importedAt: "2026-04-20T10:00:00Z" }]);
    expect(result.isValid).toBe(false);
    expect(result.duplicate).toBeTruthy();
  });

  it("detects duplicate on same plan/day with changed times", () => {
    const payload = {
      planId: "p1",
      date: "2026-04-20",
      startTime: "12:00",
      endTime: "14:00",
      workHours: 2,
      purpose: "X",
      note: "Y",
      departureLocation: "A",
      destinationLocation: "B",
      costCenter: "C",
    };

    const result = validateHrworksImportPayload(payload, [{
      ...payload,
      startTime: "08:00",
      endTime: "10:00",
      importedAt: "2026-04-20T10:00:00Z",
    }]);
    expect(result.isValid).toBe(false);
    expect(result.duplicate).toBeTruthy();
  });

  it("allows disabled required fields via policy options", () => {
    const result = validateHrworksImportPayload({
      planId: "p1",
      date: "2026-04-20",
      startTime: "08:00",
      endTime: "10:00",
      workHours: 2,
      purpose: "",
      note: "",
      departureLocation: "",
      destinationLocation: "B",
      costCenter: "",
    }, [], {
      requiredFields: {
        purpose: false,
        note: false,
        departureLocation: false,
        costCenter: false,
      },
    });
    expect(result.isValid).toBe(true);
  });
});
