import { describe, expect, it } from "vitest";
import { getWeekRange, normalizeAdapterEndpoint } from "./shared";

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
