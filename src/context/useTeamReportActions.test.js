import { describe, expect, it } from "vitest";
import { normalizeReportTargetId } from "./useTeamReportActions";

describe("useTeamReportActions helpers", () => {
  it("normalizes report ids for analysis actions", () => {
    expect(normalizeReportTargetId(" report-123 ")).toBe("report-123");
    expect(normalizeReportTargetId("")).toBe("");
    expect(normalizeReportTargetId(null)).toBe("");
  });
});
