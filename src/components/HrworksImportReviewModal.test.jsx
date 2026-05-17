import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HrworksImportReviewModal } from "./HrworksImportReviewModal";

describe("HrworksImportReviewModal", () => {
  it("renders review fields and blocks confirm when errors exist", () => {
    const onCancel = vi.fn();
    const onEdit = vi.fn();
    const onConfirm = vi.fn();
    const onExportOnly = vi.fn();
    const onDryRun = vi.fn();

    render(
      <HrworksImportReviewModal
        open
        payload={{
          date: "2026-04-20",
          startTime: "08:00",
          endTime: "10:00",
          workHours: 2,
          purpose: "Sichtung",
          note: "Hinweis",
          departureLocation: "Start",
          destinationLocation: "Ziel",
          intermediateStops: ["Stopp"],
          costCenter: "321000",
          sourceGames: [{ home: "A", away: "B" }],
        }}
        warnings={[]}
        errors={["Fehler"]}
        onCancel={onCancel}
        onEdit={onEdit}
        onConfirm={onConfirm}
        onExportOnly={onExportOnly}
        onDryRun={onDryRun}
      />,
    );

    expect(screen.getByRole("dialog", { name: "HRworks-Import prüfen" })).toBeInTheDocument();
    expect(screen.getByText(/Fehler/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import starten" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    fireEvent.click(screen.getByRole("button", { name: "Daten bearbeiten" }));
    fireEvent.click(screen.getByRole("button", { name: "Nur Exportdatei erstellen" }));
    fireEvent.click(screen.getByRole("button", { name: "HRworks-Testlauf ohne Speichern" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onExportOnly).toHaveBeenCalledTimes(1);
    expect(onDryRun).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(0);
  });
});
