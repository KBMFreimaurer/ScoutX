import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../config/storage";
import { bootstrapStorageRetention } from "./storageRetention";

describe("storageRetention", () => {
  it("removes expired entries according to TTL", () => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    const now = Date.UTC(2026, 4, 19, 10, 0, 0);
    const old = now - 31 * 24 * 60 * 60 * 1000;

    window.localStorage.setItem(STORAGE_KEYS.hrworksImports, JSON.stringify([{ id: "old-import" }]));
    window.localStorage.setItem(
      "scoutx.storageMeta.v1",
      JSON.stringify({
        [STORAGE_KEYS.hrworksImports]: old,
      }),
    );

    bootstrapStorageRetention(now);

    expect(window.localStorage.getItem(STORAGE_KEYS.hrworksImports)).toBeNull();
  });

  it("keeps durable keys without TTL", () => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    const now = Date.UTC(2026, 4, 19, 10, 0, 0);
    const veryOld = now - 900 * 24 * 60 * 60 * 1000;

    window.localStorage.setItem(STORAGE_KEYS.setup, JSON.stringify({ team: "scoutx" }));
    window.localStorage.setItem(
      "scoutx.storageMeta.v1",
      JSON.stringify({
        [STORAGE_KEYS.setup]: veryOld,
      }),
    );

    bootstrapStorageRetention(now);

    expect(window.localStorage.getItem(STORAGE_KEYS.setup)).toContain("scoutx");
  });

  it("touches metadata when managed keys are updated", () => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    const now = Date.UTC(2026, 4, 19, 10, 0, 0);
    bootstrapStorageRetention(now);

    window.localStorage.setItem(STORAGE_KEYS.planHistory, JSON.stringify([{ id: 1 }]));

    const meta = JSON.parse(window.localStorage.getItem("scoutx.storageMeta.v1") || "{}");
    expect(Number.isFinite(Number(meta[STORAGE_KEYS.planHistory]))).toBe(true);
    expect(Number(meta[STORAGE_KEYS.planHistory])).toBeGreaterThanOrEqual(now);
  });
});

