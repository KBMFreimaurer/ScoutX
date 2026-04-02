import { describe, expect, it } from "vitest";
import { buildWeekCacheKey, getWeekRange, isDateInRange, shouldRefreshWeek } from "./week";

describe("week utils", () => {
  it("builds monday-based week range", () => {
    const range = getWeekRange("2026-04-04"); // Saturday
    expect(range.fromDate).toBe("2026-03-30");
    expect(range.toDate).toBe("2026-04-05");
  });

  it("checks date in range", () => {
    const range = { fromDate: "2026-03-30", toDate: "2026-04-05" };
    expect(isDateInRange("2026-04-04", range)).toBe(true);
    expect(isDateInRange("2026-04-07", range)).toBe(false);
  });

  it("computes cache keys and ttl refresh", () => {
    const key = buildWeekCacheKey({ kreisId: "duesseldorf", jugendId: "d-jugend" }, { weekKey: "2026-03-30_2026-04-05" });
    expect(key).toBe("duesseldorf|d-jugend|2026-03-30_2026-04-05");

    expect(shouldRefreshWeek(0, Date.now(), 300)).toBe(true);
    expect(shouldRefreshWeek(Date.now() - 1000, Date.now(), 300)).toBe(false);
  });
});
