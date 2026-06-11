import { describe, expect, it } from "vitest";
import {
  getScoutXCompanionInstallOptions,
  resolveScoutXCompanionInstallTarget,
} from "./scoutXCompanionInstall";

describe("scoutXCompanionInstall", () => {
  it("detects macOS and returns the macOS companion package", () => {
    const target = resolveScoutXCompanionInstallTarget({
      platform: "MacIntel",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6)",
    });

    expect(target.platform).toBe("macos");
    expect(target.primaryDownload.label).toBe("Companion für macOS herunterladen");
    expect(target.primaryDownload.href).toBe("/downloads/scoutx-companion-macos.zip");
  });

  it("detects Windows and returns the Windows companion package", () => {
    const target = resolveScoutXCompanionInstallTarget({
      platform: "Win32",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });

    expect(target.platform).toBe("windows");
    expect(target.primaryDownload.label).toBe("Companion für Windows herunterladen");
    expect(target.primaryDownload.href).toBe("/downloads/scoutx-companion-windows.zip");
  });

  it("returns both downloads for unsupported platforms", () => {
    const target = resolveScoutXCompanionInstallTarget({
      platform: "Linux x86_64",
      userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
    });

    expect(target.platform).toBe("unknown");
    expect(target.primaryDownload).toBeNull();
    expect(target.downloads.map((download) => download.platform)).toEqual(["macos", "windows"]);
  });

  it("exposes stable install options for both supported desktop platforms", () => {
    expect(getScoutXCompanionInstallOptions()).toEqual([
      expect.objectContaining({ platform: "macos", href: "/downloads/scoutx-companion-macos.zip" }),
      expect.objectContaining({ platform: "windows", href: "/downloads/scoutx-companion-windows.zip" }),
    ]);
  });
});
