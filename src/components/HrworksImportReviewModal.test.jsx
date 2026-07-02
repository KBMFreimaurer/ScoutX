import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HrworksImportReviewModal } from "./HrworksImportReviewModal";

const PAYLOAD = {
  date: "2026-04-20",
  startTime: "08:00",
  endTime: "10:00",
  workHours: 2,
  purpose: "Sichtung / (A)",
  note: "Sichtung / (A)",
  departureLocation: "Start",
  costCenter: "Junioren allgemein (321000)",
  routeLegs: [{ from: "Zuhause", to: "Spiel" }, { from: "Spiel", to: "Zuhause" }],
  sourceGames: [{ home: "A", away: "B" }],
  importSource: "plan",
};

describe("HrworksImportReviewModal", () => {
  it("verlangt keinen Datei-Upload und zeigt die generierten Plan-Daten", () => {
    render(
      <HrworksImportReviewModal
        open
        payload={PAYLOAD}
        payloadCount={2}
        warnings={["Hinweis"]}
        errors={[]}
        onCancel={vi.fn()}
        onStartJob={vi.fn()}
        onRefreshJobStatus={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "HRworks-Import beauftragen" })).toBeInTheDocument();
    expect(screen.getByText(/ScoutX erzeugt die HRworks-Datei automatisch aus diesem Plan/i)).toBeInTheDocument();
    expect(screen.queryByText(/XLSX/i)).not.toBeInTheDocument();
    expect(screen.getByText(/2 Sichtungstage werden in einem Auftrag übertragen/i)).toBeInTheDocument();
    expect(screen.getByText("Sichtung / (A)")).toBeInTheDocument();
    expect(screen.getByLabelText(/Benutzername/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Passwort/i)).toBeInTheDocument();
  });

  it("startet den Auftrag erst mit Zugangsdaten und übergibt sie an onStartJob", () => {
    const onStartJob = vi.fn();
    render(
      <HrworksImportReviewModal
        open
        payload={PAYLOAD}
        warnings={[]}
        errors={[]}
        onCancel={vi.fn()}
        onStartJob={onStartJob}
        onRefreshJobStatus={vi.fn()}
      />,
    );

    const startButton = screen.getByRole("button", { name: "Importauftrag starten" });
    expect(startButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Benutzername/i), { target: { value: "scout@example.com" } });
    fireEvent.change(screen.getByLabelText(/Passwort/i), { target: { value: "geheim" } });
    expect(startButton).not.toBeDisabled();

    fireEvent.click(startButton);
    expect(onStartJob).toHaveBeenCalledWith({ baseUrl: "", username: "scout@example.com", password: "geheim" });
  });

  it("blockiert den Start bei Validierungsfehlern", () => {
    render(
      <HrworksImportReviewModal
        open
        payload={PAYLOAD}
        warnings={[]}
        errors={["Abfahrtsort fehlt"]}
        onCancel={vi.fn()}
        onStartJob={vi.fn()}
        onRefreshJobStatus={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Benutzername/i), { target: { value: "scout" } });
    fireEvent.change(screen.getByLabelText(/Passwort/i), { target: { value: "geheim" } });
    expect(screen.getByText("• Abfahrtsort fehlt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importauftrag starten" })).toBeDisabled();
  });

  it("zeigt den Jobstatus mit deutscher Beschriftung und Aktualisieren-Button", () => {
    const onRefreshJobStatus = vi.fn();
    render(
      <HrworksImportReviewModal
        open
        payload={PAYLOAD}
        warnings={[]}
        errors={[]}
        jobState={{ jobId: "job-1", status: "running", error: "", resultSummary: "" }}
        onCancel={vi.fn()}
        onStartJob={vi.fn()}
        onRefreshJobStatus={onRefreshJobStatus}
      />,
    );

    expect(screen.getByText("Wird ausgeführt")).toBeInTheDocument();
    const refreshButton = screen.getByRole("button", { name: "Status aktualisieren" });
    fireEvent.click(refreshButton);
    expect(onRefreshJobStatus).toHaveBeenCalledTimes(1);
  });

  it("zeigt abgeschlossene Aufträge mit Ergebnis und deaktiviert die Aktualisierung", () => {
    render(
      <HrworksImportReviewModal
        open
        payload={PAYLOAD}
        warnings={[]}
        errors={[]}
        jobState={{ jobId: "job-1", status: "completed", error: "", resultSummary: "HRworks-Import abgeschlossen: 2 Tag(e) übertragen." }}
        onCancel={vi.fn()}
        onStartJob={vi.fn()}
        onRefreshJobStatus={vi.fn()}
      />,
    );

    expect(screen.getByText("Abgeschlossen")).toBeInTheDocument();
    expect(screen.getByText(/2 Tag\(e\) übertragen/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Auftrag beendet" })).toBeDisabled();
  });

  it("zeigt needs_action mit deutschem Hinweis", () => {
    render(
      <HrworksImportReviewModal
        open
        payload={PAYLOAD}
        warnings={[]}
        errors={[]}
        jobState={{ jobId: "job-1", status: "needs_action", error: "HRworks verlangt eine Zwei-Faktor-Bestätigung.", resultSummary: "" }}
        onCancel={vi.fn()}
        onStartJob={vi.fn()}
        onRefreshJobStatus={vi.fn()}
      />,
    );

    expect(screen.getByText("Aktion erforderlich")).toBeInTheDocument();
    expect(screen.getByText("HRworks verlangt eine Zwei-Faktor-Bestätigung.")).toBeInTheDocument();
  });
});
