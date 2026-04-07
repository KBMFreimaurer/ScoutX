import { describe, expect, it } from "vitest";
import { resolveGameWeatherDate } from "./GamesContext";

describe("GamesContext weather date resolution", () => {
  it("uses ISO date when present", () => {
    expect(resolveGameWeatherDate({ date: "2026-04-07", dateObj: new Date(2026, 3, 8) })).toBe("2026-04-07");
  });

  it("falls back to dateObj when date is missing", () => {
    expect(resolveGameWeatherDate({ dateObj: new Date(2026, 3, 7) })).toBe("2026-04-07");
  });

  it("parses German date string fallback", () => {
    expect(resolveGameWeatherDate({ date: "07.04.2026" })).toBe("2026-04-07");
  });

  it("returns null for invalid input", () => {
    expect(resolveGameWeatherDate({ date: "invalid", dateObj: "also-invalid" })).toBeNull();
  });
});
