import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HrworksImportReviewModal } from "./HrworksImportReviewModal";

describe("HrworksImportReviewModal", () => {
  it("shows only step 1 before an xlsx file has been uploaded", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const onPickFile = vi.fn();
    const onOpenLogin = vi.fn();
    const onLoginConfirmedChange = vi.fn();

    render(
      <HrworksImportReviewModal
        open
        payload={{
          date: "2026-04-20",
          startTime: "08:00",
          endTime: "10:00",
          purpose: "Sichtung / (A)",
          note: "Sichtung / (A)",
          departureLocation: "Start",
          routeLegs: [{ from: "Zuhause", to: "Spiel" }, { from: "Spiel", to: "Zuhause" }],
          sourceGames: [{ home: "A", away: "B" }],
          importSource: "plan",
        }}
        warnings={["Bitte zuerst XLSX hochladen"]}
        errors={["Abfahrtsort fehlt"]}
        uploadedFileName=""
        loginConfirmed={false}
        onLoginConfirmedChange={onLoginConfirmedChange}
        onCancel={onCancel}
        onConfirm={onConfirm}
        onPickFile={onPickFile}
        onOpenLogin={onOpenLogin}
      />,
    );

    expect(screen.getByRole("dialog", { name: "HRworks-Import prüfen" })).toBeInTheDocument();
    expect(screen.getByText(/STEP 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/STEP 2/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/STEP 3/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /XLSX-Datei per Drag-and-Drop hochladen/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "HRworks öffnen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "HRworks importieren" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /XLSX-Datei per Drag-and-Drop hochladen/i }));
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));

    expect(onPickFile).toHaveBeenCalledTimes(1);
    expect(onOpenLogin).toHaveBeenCalledTimes(0);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(0);
    expect(onLoginConfirmedChange).toHaveBeenCalledTimes(0);
  });

  it("accepts a dropped xlsx file in step 1", () => {
    const onDropFile = vi.fn();
    const file = { name: "AEB Mai Onay.xlsx" };

    render(
      <HrworksImportReviewModal
        open
        payload={{
          date: "2026-04-20",
          startTime: "08:00",
          endTime: "10:00",
          purpose: "Sichtung / (A)",
          note: "Sichtung / (A)",
          departureLocation: "Start",
          routeLegs: [{ from: "Zuhause", to: "Spiel" }, { from: "Spiel", to: "Zuhause" }],
          sourceGames: [{ home: "A", away: "B" }],
          importSource: "plan",
        }}
        warnings={[]}
        errors={[]}
        uploadedFileName=""
        loginConfirmed={false}
        onLoginConfirmedChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        onPickFile={vi.fn()}
        onDropFile={onDropFile}
        onOpenLogin={vi.fn()}
      />,
    );

    fireEvent.drop(screen.getByRole("button", { name: /XLSX-Datei per Drag-and-Drop hochladen/i }), {
      dataTransfer: { files: [file] },
    });

    expect(onDropFile).toHaveBeenCalledTimes(1);
    expect(onDropFile).toHaveBeenCalledWith(file);
  });

  it("shows step 2 after an xlsx file is available and keeps step 3 hidden until login is confirmed", () => {
    render(
      <HrworksImportReviewModal
        open
        payload={{
          date: "2026-04-20",
          startTime: "08:00",
          endTime: "10:00",
          purpose: "Sichtung / (A)",
          note: "Sichtung / (A)",
          departureLocation: "Start",
          routeLegs: [],
          sourceGames: [],
          importSource: "timesheet",
        }}
        warnings={[]}
        errors={[]}
        uploadedFileName="AEB Mai Onay.xlsx"
        loginConfirmed={false}
        onLoginConfirmedChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        onPickFile={vi.fn()}
        onOpenLogin={vi.fn()}
      />,
    );

    expect(screen.getByText(/STEP 1/i)).toBeInTheDocument();
    expect(screen.getByText(/STEP 2/i)).toBeInTheDocument();
    expect(screen.queryByText(/STEP 3/i)).not.toBeInTheDocument();
    expect(screen.getByText(/AEB Mai Onay.xlsx/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HRworks öffnen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "HRworks importieren" })).not.toBeInTheDocument();
  });

  it("enables the final import button once xlsx and login are both confirmed", () => {
    render(
      <HrworksImportReviewModal
        open
        payload={{
          date: "2026-04-20",
          startTime: "08:00",
          endTime: "10:00",
          purpose: "Sichtung / (A)",
          note: "Sichtung / (A)",
          departureLocation: "Start",
          routeLegs: [],
          sourceGames: [],
          importSource: "timesheet",
        }}
        warnings={[]}
        errors={[]}
        uploadedFileName="AEB Mai Onay.xlsx"
        wizardNotice="Empfohlenes HRworks-Setup wurde automatisch angewendet."
        loginConfirmed
        onLoginConfirmedChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        onPickFile={vi.fn()}
        onOpenLogin={vi.fn()}
      />,
    );

    expect(screen.getByText(/Empfohlenes HRworks-Setup wurde automatisch angewendet/i)).toBeInTheDocument();
    expect(screen.getByText(/AEB Mai Onay.xlsx/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "XLSX erneut hochladen" })).toBeInTheDocument();
    expect(screen.getByText(/STEP 3/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HRworks importieren" })).not.toBeDisabled();
  });
});
