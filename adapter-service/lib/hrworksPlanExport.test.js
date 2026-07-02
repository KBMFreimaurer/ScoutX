import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { buildHrworksTimesheetRows, writeHrworksTimesheetXlsx } from "./hrworksPlanExport.js";

const PAYLOADS = [
  {
    planId: "plan-2026-07-04",
    employeeName: "Onay Kirmizigül",
    date: "2026-07-04",
    startTime: "09:00",
    endTime: "13:00",
    workHours: 4,
    purpose: "Sichtung / (MSV Duisburg)",
  },
  {
    planId: "plan-2026-07-11",
    date: "2026-07-11",
    startTime: "10:30",
    endTime: "16:00",
    workHours: 5.5,
    purpose: "Sichtung / (RWE)",
  },
];

describe("hrworksPlanExport", () => {
  it("baut das MiLoG-Layout der Beispieldatei nach", () => {
    const { rows, monthName, totalHours } = buildHrworksTimesheetRows(PAYLOADS, { employeeName: "Onay Kirmizigül" });

    expect(rows[0][0]).toBe("Arbeitszeitdokumentation gemäß MiLoG");
    expect(rows[3][0]).toBe("Name: ");
    expect(rows[3][1]).toBe("Onay Kirmizigül");
    expect(rows[3][5]).toBe("Monat:");
    expect(monthName).toBe("Juli");
    expect(rows[6]).toEqual(["Tag", "Datum", "Beginn", "Ende", "von", "bis", "Stunden", "Vermerk"]);

    const dayRows = rows.slice(7, -6);
    // Juli 2026: Mo 29.06. bis So 02.08. => volle Wochen
    expect(dayRows[0][0]).toBe("Mo");
    expect(dayRows.at(-1)[0]).toBe("So");

    const filled = dayRows.filter((row) => row[6] !== "");
    expect(filled).toHaveLength(2);
    expect(filled[0][2]).toBe("9:00");
    expect(filled[0][3]).toBe("13:00");
    expect(filled[0][6]).toBe("4.00");
    expect(filled[0][7]).toContain("MSV Duisburg");
    expect(totalHours).toBe(9.5);

    const totalRow = rows.find((row) => row[4] === "Gesamtstunden");
    expect(totalRow[6]).toBe("9.5");
    expect(rows.at(-1)[0]).toBe("Unterschrift Mitarbeiter");
    expect(rows.at(-1)[4]).toBe("Unterschrift Abteilungsleiter");
  });

  it("schreibt eine lesbare XLSX-Datei", () => {
    const target = join(mkdtempSync(join(tmpdir(), "hrworks-xlsx-")), "timesheet.xlsx");
    const result = writeHrworksTimesheetXlsx(target, PAYLOADS, { employeeName: "Onay Kirmizigül" });
    expect(result.filePath).toBe(target);

    const workbook = XLSX.readFile(target);
    expect(workbook.SheetNames).toContain("Tabelle1");
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Tabelle1, { header: 1, raw: false, defval: "" });
    expect(rows[0][0]).toBe("Arbeitszeitdokumentation gemäß MiLoG");
    expect(rows[6][7]).toBe("Vermerk");
    expect(rows.some((row) => row[7]?.includes?.("MSV Duisburg"))).toBe(true);
  });

  it("wirft bei fehlenden Datumsangaben einen deutschen Fehler", () => {
    expect(() => buildHrworksTimesheetRows([{ date: "" }])).toThrow(/Plan-Tage/);
  });
});
