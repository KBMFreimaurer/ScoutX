import { describe, expect, it } from "vitest";
import {
  HRWORKS_AUTOMATION_STEPS,
  advanceAutomationStep,
  canCaptureDebugScreenshot,
  canProceedAutomation,
  createAutomationRuntimeSession,
  failAutomationSession,
  toHrworksAutomationError,
} from "./hrworksAutomationRuntime";

describe("hrworksAutomationRuntime", () => {
  it("requires explicit wait_for_login step in automation sequence", () => {
    expect(HRWORKS_AUTOMATION_STEPS).toContain("wait_for_login");
    const openIndex = HRWORKS_AUTOMATION_STEPS.indexOf("open_hrworks");
    const loginIndex = HRWORKS_AUTOMATION_STEPS.indexOf("wait_for_login");
    expect(loginIndex).toBeGreaterThan(openIndex);
  });

  it("blocks run when prerequisites are missing", () => {
    const result = canProceedAutomation({
      isReachable: false,
      isLoggedIn: false,
      mappingReady: false,
      requireSaveConfirmation: false,
    });
    expect(result.ok).toBe(false);
    expect(result.failures.length).toBeGreaterThanOrEqual(4);
  });

  it("returns USER_NOT_LOGGED_IN when login precondition is false", () => {
    const result = canProceedAutomation({
      isReachable: true,
      isLoggedIn: false,
      mappingReady: true,
      requireSaveConfirmation: true,
    });
    const codes = result.failures.map((item) => item.code);
    expect(codes).toContain("USER_NOT_LOGGED_IN");
  });

  it("creates and advances runtime session", () => {
    const created = createAutomationRuntimeSession({ planId: "plan-1" });
    expect(created.currentStep).toBe("open_hrworks");

    const next = advanceAutomationStep(created, "fill_form");
    expect(next.status).toBe("running");
    expect(next.currentStep).toBe("fill_form");
  });

  it("session state stores no credentials from payload input", () => {
    const created = createAutomationRuntimeSession({
      planId: "plan-1",
      username: "user@example.com",
      password: "secret",
      token: "abc123",
    });
    expect(created).not.toHaveProperty("username");
    expect(created).not.toHaveProperty("password");
    expect(created).not.toHaveProperty("token");
  });

  it("fails session on invalid step", () => {
    const created = createAutomationRuntimeSession({ planId: "plan-1" });
    const failed = advanceAutomationStep(created, "invalid_step");
    expect(failed.status).toBe("failed");
  });

  it("converts known errors", () => {
    const error = toHrworksAutomationError("COST_CENTER_NOT_FOUND");
    expect(error.message).toMatch(/Kostenstelle/);
  });

  it("marks failure with structured error", () => {
    const created = createAutomationRuntimeSession({ planId: "plan-1" });
    const failed = failAutomationSession(created, "SAVE_FAILED", "Button disabled");
    expect(failed.status).toBe("failed");
    const lastEvent = failed.events[failed.events.length - 1];
    expect(lastEvent.error.code).toBe("SAVE_FAILED");
  });

  it("allows debug screenshot only with policy and user consent", () => {
    expect(canCaptureDebugScreenshot({ allowDebugScreenshots: false, userConsent: true })).toBe(false);
    expect(canCaptureDebugScreenshot({ allowDebugScreenshots: true, userConsent: false })).toBe(false);
    expect(canCaptureDebugScreenshot({ allowDebugScreenshots: true, userConsent: true })).toBe(true);
  });
});
