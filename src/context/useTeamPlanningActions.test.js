import { describe, expect, it } from "vitest";
import { createBackendFallbackState } from "./useTeamPlanningActions";

describe("useTeamPlanningActions helpers", () => {
  it("builds local fallback backend state", () => {
    expect(createBackendFallbackState("Fehler")).toEqual({
      status: "local",
      error: "Fehler",
    });
  });
});
