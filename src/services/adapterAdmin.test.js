import { describe, expect, it } from "vitest";
import { resolveAdapterAdminUrl, resolveAdapterHealthUrl } from "./adapterAdmin";

describe("adapterAdmin URL resolver", () => {
  it("builds relative admin URL from /api/games", () => {
    expect(resolveAdapterAdminUrl("/api/games", "status")).toBe("/api/admin/status");
    expect(resolveAdapterAdminUrl("/api/games", "refresh")).toBe("/api/admin/refresh");
  });

  it("builds absolute admin URL from absolute adapter endpoint", () => {
    expect(resolveAdapterAdminUrl("http://127.0.0.1:8787/api/games", "status")).toBe(
      "http://127.0.0.1:8787/api/admin/status",
    );
  });

  it("strips query/hash from absolute endpoint", () => {
    expect(resolveAdapterAdminUrl("https://example.test/api/games?x=1#anchor", "refresh")).toBe(
      "https://example.test/api/admin/refresh",
    );
  });

  it("falls back to default admin URL when endpoint is invalid", () => {
    expect(resolveAdapterAdminUrl("not-a-url", "status")).toBe("/api/admin/status");
  });

  it("resolves health URL from adapter endpoint", () => {
    expect(resolveAdapterHealthUrl("/api/games")).toBe("/health");
    expect(resolveAdapterHealthUrl("https://api.example.test/api/games")).toBe("https://api.example.test/health");
  });
});
