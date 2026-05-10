import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/share", () => ({
  Share: {
    share: vi.fn(),
  },
}));

vi.mock("@capacitor/filesystem", () => ({
  Directory: {
    Cache: "CACHE",
  },
  Filesystem: {
    writeFile: vi.fn(),
  },
}));

describe("native/share", () => {
  beforeEach(() => {
    delete window.Capacitor;
    vi.restoreAllMocks();

    if (typeof URL.createObjectURL !== "function") {
      URL.createObjectURL = vi.fn(() => "blob:test");
    } else {
      vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test");
    }

    if (typeof URL.revokeObjectURL !== "function") {
      URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    }
  });

  it("nutzt im nativen iOS-Runtime den Share-Flow", async () => {
    const { Share } = await import("@capacitor/share");
    const { Filesystem } = await import("@capacitor/filesystem");
    Share.share.mockResolvedValue(undefined);
    Filesystem.writeFile.mockResolvedValue({ uri: "file:///tmp/ScoutX.pdf" });
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "ios",
    };

    const { shareOrDownloadBlob } = await import("./share");
    const result = await shareOrDownloadBlob(new Blob(["pdf"]), "ScoutX.pdf", "ScoutX Export");

    expect(Filesystem.writeFile).toHaveBeenCalledTimes(1);
    expect(Share.share).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      method: "share-file",
      fallbackUsed: false,
    });
  });

  it("liefert bei Share-Fehler einen Download-Fallback mit klarer Fehlermeldung", async () => {
    const { Share } = await import("@capacitor/share");
    const { Filesystem } = await import("@capacitor/filesystem");
    Filesystem.writeFile.mockRejectedValue(new Error("Write failed"));
    Share.share.mockRejectedValue(new Error("Share failed"));
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "ios",
    };

    const clicked = vi.fn();
    const fakeLink = { href: "", download: "", click: clicked };
    vi.spyOn(document, "createElement").mockImplementation(() => fakeLink);

    const { shareOrDownloadBlob } = await import("./share");
    const result = await shareOrDownloadBlob(new Blob(["pdf"]), "ScoutX.pdf", "ScoutX Export");

    expect(clicked).toHaveBeenCalledTimes(1);
    expect(result?.ok).toBe(false);
    expect(result?.method).toBe("download");
    expect(result?.fallbackUsed).toBe(true);
    expect(String(result?.error || "")).toContain("Download");
  });
});
