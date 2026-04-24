import { describe, expect, it } from "vitest";
import { getRangeToNextSunday, getWeekRange, normalizeAdapterEndpoint } from "./shared";

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

  it("nutzt fallback endpoint wenn kein endpoint gesetzt ist", () => {
    expect(normalizeAdapterEndpoint("", "/api/games")).toBe("/api/games");
  });

  it("behaelt localhost-endpoint auf lokalem Host", () => {
    expect(normalizeAdapterEndpoint("http://localhost:8787/api/games", "/api/games")).toBe(
      "http://localhost:8787/api/games",
    );
  });
});

describe("shared getRangeToNextSunday", () => {
  it("returns the same date through the next sunday", () => {
    expect(getRangeToNextSunday("2026-04-24")).toEqual({
      fromDate: "2026-04-24",
      toDate: "2026-04-26",
    });
  });

  it("keeps sunday as the range end when the start is already sunday", () => {
    expect(getRangeToNextSunday("2026-04-26")).toEqual({
      fromDate: "2026-04-26",
      toDate: "2026-04-26",
    });
  });
});
