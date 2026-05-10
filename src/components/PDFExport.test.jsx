import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PDFExport } from "./PDFExport";

vi.mock("../native/deepLinks", () => ({
  isNativeCapacitorRuntime: vi.fn(),
}));

vi.mock("../services/pdf", () => ({
  openScoutPdf: vi.fn(),
}));

describe("PDFExport", () => {
  beforeEach(() => {
    delete window.Capacitor;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.Capacitor;
  });

  it("nutzt im Web bei confirmBeforeDownload den Preview-Flow", async () => {
    const { isNativeCapacitorRuntime } = await import("../native/deepLinks");
    const { openScoutPdf } = await import("../services/pdf");
    isNativeCapacitorRuntime.mockReturnValue(false);

    const previewDownload = vi.fn();
    const previewRevoke = vi.fn();
    openScoutPdf.mockResolvedValue({
      ok: true,
      previewUrl: "blob:preview-url",
      fileName: "ScoutX-Test.pdf",
      download: previewDownload,
      revoke: previewRevoke,
    });

    render(<PDFExport games={[]} plan="Test" cfg={{}} confirmBeforeDownload label="PDF herunterladen" />);
    fireEvent.click(screen.getByRole("button", { name: /PDF herunterladen/i }));

    await waitFor(() => expect(openScoutPdf).toHaveBeenCalledTimes(1));
    const callArgs = openScoutPdf.mock.calls[0];
    expect(callArgs[5]).toEqual({ mode: "preview" });
    expect(screen.getByRole("dialog", { name: /PDF Vorschau/i })).toBeInTheDocument();
  });

  it("nutzt auf nativem iOS bei confirmBeforeDownload direkt den Export ohne Preview", async () => {
    const { isNativeCapacitorRuntime } = await import("../native/deepLinks");
    const { openScoutPdf } = await import("../services/pdf");
    isNativeCapacitorRuntime.mockReturnValue(true);
    window.Capacitor = {
      getPlatform: () => "ios",
    };

    const onExportSuccess = vi.fn();
    openScoutPdf.mockResolvedValue({
      ok: true,
      delivery: "share",
    });

    render(
      <PDFExport
        games={[]}
        plan="Test"
        cfg={{}}
        confirmBeforeDownload
        label="PDF herunterladen"
        onExportSuccess={onExportSuccess}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /PDF herunterladen/i }));

    await waitFor(() => expect(openScoutPdf).toHaveBeenCalled());
    const callArgs = openScoutPdf.mock.calls.at(-1);
    expect(callArgs[5]).toBeNull();
    await waitFor(() => expect(onExportSuccess).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: /PDF Vorschau/i })).not.toBeInTheDocument();
  });
});
