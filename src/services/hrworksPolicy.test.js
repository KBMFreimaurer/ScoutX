import { describe, expect, it } from "vitest";
import {
  getAllowedHrworksPolicyValues,
  getDefaultHrworksPolicy,
  getMissingHrworksOperationalDecisions,
  writeHrworksPolicy,
} from "./hrworksPolicy";

describe("hrworksPolicy", () => {
  it("returns default policy", () => {
    const policy = getDefaultHrworksPolicy();
    expect(policy.defaultCostCenter).toMatch(/321000/);
    expect(policy.requiredFields.purpose).toBe(true);
    expect(policy.requireSaveConfirmation).toBe(true);
    expect(policy.allowDebugScreenshots).toBe(false);
  });

  it("reports missing operational decisions", () => {
    const missing = getMissingHrworksOperationalDecisions(getDefaultHrworksPolicy());
    expect(missing.length).toBeGreaterThanOrEqual(2);
  });

  it("normalizes invalid operational decision values to empty", () => {
    const policy = writeHrworksPolicy({
      aggregationMode: "invalid",
      finalSaveMode: "invalid",
    });
    expect(policy.aggregationMode).toBe("");
    expect(policy.finalSaveMode).toBe("");
  });

  it("exposes allowed operational decision values", () => {
    const values = getAllowedHrworksPolicyValues();
    expect(values.aggregationMode).toEqual(expect.arrayContaining(["per_day", "combined"]));
    expect(values.finalSaveMode).toEqual(expect.arrayContaining(["prefill_only", "auto_save"]));
  });
});
