import { describe, expect, it, vi } from "vitest";
import { exportHrworksAuditLog } from "./hrworksAuditExport";
import * as nativeShare from "../native/share";

describe("hrworksAuditExport", () => {
  it("builds downloadable json blob", async () => {
    const spy = vi.spyOn(nativeShare, "shareOrDownloadBlob").mockResolvedValue({ ok: true, method: "download" });
    const result = await exportHrworksAuditLog([{ id: "1", status: "ready" }]);
    expect(result?.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
