import { describe, expect, it } from "vitest";
import { getWeekRange } from "./shared";

describe("shared getWeekRange", () => {
  it("returns monday-to-sunday for valid date", () => {
    expect(getWeekRange("2026-04-07")).toEqual({
      fromDate: "2026-04-06",
      toDate: "2026-04-12",
    });
  });

  it("throws for invalid date input", () => {
    expect(() => getWeekRange("")).toThrow("Ungültiges Startdatum");
    expect(() => getWeekRange("2026-02-31")).toThrow("Ungültiges Startdatum");
  });
});
