import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  parseHrworksTimesheetFile,
  parseHrworksTimesheetRows,
  parseHrworksTimesheetText,
  toTimeHHmm,
  validateHrworksTimesheetFile,
} from "./hrworksExcelParser";

describe("hrworksExcelParser", () => {
  it("converts excel time to HH:mm", () => {
    expect(toTimeHHmm(8 / 24)).toBe("08:00");
  });

  it("parses valid rows and ignores empty rows", () => {
    const { entries } = parseHrworksTimesheetRows([
      { Name: "Scout", Datum: "20.04.2026", Beginn: "08:00", Ende: "10:00", Vermerk: "Sichtung" },
      { Name: "Scout", Datum: "", Beginn: "", Ende: "", Vermerk: "" },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].note).toBe("Sichtung");
  });

  it("warns for total mismatch", () => {
    const { warnings } = parseHrworksTimesheetRows([
      { Name: "Scout", Datum: "20.04.2026", Beginn: "08:00", Ende: "10:00", Gesamtstunden: "5" },
    ]);

    expect(warnings.join(" ")).toMatch(/Gesamtstundenabweichung/);
  });

  it("parses semicolon text export", () => {
    const text = [
      "Name;Datum;Beginn;Ende;Vermerk",
      "Scout;20.04.2026;08:00;10:00;Sichtung",
    ].join("\n");
    const { entries, warnings } = parseHrworksTimesheetText(text);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe("2026-04-20");
    expect(warnings).toHaveLength(0);
  });

  it("accepts xlsx files", () => {
    const result = validateHrworksTimesheetFile({ name: "arbeitszeit.xlsx" });
    expect(result.ok).toBe(true);
    expect(result.message).toBe("");
  });

  it("parses AZE-style xlsx sheets and extracts Sichtung rows", async () => {
    const worksheetRows = [
      ["Arbeitszeitdokumentation gemäß MiLoG"],
      [],
      [],
      ["Name: ", "Onay Kirmizigül", "", "", "", "Monat:", "April"],
      [],
      ["", "", "", "", "Ruhezeit", "", "Arbeits-"],
      ["Tag", "Datum", "Beginn", "Ende", "von", "bis", "Stunden", "Vermerk"],
      ["Fr", new Date("2026-04-10"), "", "", "", "", "", ""],
      ["Sa", new Date("2026-04-11"), new Date("2026-04-11T09:00:00"), new Date("2026-04-11T14:00:00"), "", "", 5, "Sichtung"],
      ["So", new Date("2026-04-12"), new Date("2026-04-12T08:00:00"), new Date("2026-04-12T10:00:00"), "", "", 2, "Sichtung"],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tabelle1");
    const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

    const fileLike = {
      name: "AEB April Onay.xlsx",
      async arrayBuffer() {
        return arrayBuffer;
      },
      async text() {
        return "";
      },
    };
    const result = await parseHrworksTimesheetFile(fileLike);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      employeeName: "Onay Kirmizigül",
      month: "April",
      date: "2026-04-11",
      startTime: "09:00",
      endTime: "14:00",
      workHours: 5,
      note: "Sichtung",
    });
    expect(result.entries[1]).toMatchObject({
      date: "2026-04-12",
      startTime: "08:00",
      endTime: "10:00",
      workHours: 2,
    });
  });
});
