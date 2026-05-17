import { describe, expect, it } from "vitest";
import { parseHrworksTimesheetRows, parseHrworksTimesheetText, toTimeHHmm, validateHrworksTimesheetFile } from "./hrworksExcelParser";

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

  it("rejects xlsx files with explicit message", () => {
    const result = validateHrworksTimesheetFile({ name: "arbeitszeit.xlsx" });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/CSV exportieren/);
  });
});
