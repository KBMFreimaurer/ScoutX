import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveHrworksAutomationEndpoint, startHrworksAutomation } from "./hrworksAutomationClient";

describe("hrworksAutomationClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the local automation bridge by default", () => {
    expect(resolveHrworksAutomationEndpoint()).toBe("http://127.0.0.1:8791/api/hrworks/import");
  });

  it("sends the full HRworks workflow request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return { ok: true, status: "completed" };
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await startHrworksAutomation({ planId: "p1" }, { endpoint: "http://127.0.0.1:8791/custom" });

    expect(result.status).toBe("completed");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8791/custom", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"completeWorkflow\":true"),
    }));
  });

  it("explains how to start the bridge when localhost is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(startHrworksAutomation({ planId: "p1" })).rejects.toThrow(/npm run hrworks:bridge/);
  });
});
