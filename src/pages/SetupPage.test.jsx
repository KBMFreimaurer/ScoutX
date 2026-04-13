import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ScoutXProvider } from "../context/ScoutXContext";
import { SetupProvider } from "../context/SetupContext";
import { GamesProvider } from "../context/GamesContext";
import { PlanProvider } from "../context/PlanContext";
import { SetupPage } from "./SetupPage";
import { STORAGE_KEYS } from "../config/storage";

function renderSetupPage() {
  return render(
    <MemoryRouter
      initialEntries={["/setup"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <SetupProvider defaultAdapterEndpoint="/api/games">
        <GamesProvider>
          <PlanProvider>
            <ScoutXProvider>
              <SetupPage />
            </ScoutXProvider>
          </PlanProvider>
        </GamesProvider>
      </SetupProvider>
    </MemoryRouter>,
  );
}

function clickNextStep() {
  fireEvent.click(screen.getByRole("button", { name: /Weiter zum nächsten Schritt/i }));
}

function clickBackStep() {
  fireEvent.click(screen.getByRole("button", { name: /Zurück zum vorherigen Schritt/i }));
}

function goToStepWithRequiredSelections(step) {
  if (step <= 1) {
    return;
  }

  fireEvent.click(screen.getAllByRole("button", { name: /Kreis .* auswählen/i })[0]);
  clickNextStep();

  if (step <= 2) {
    return;
  }

  fireEvent.click(screen.getByRole("button", { name: /D-Jugend auswählen/i }));
  clickNextStep();

  if (step <= 3) {
    return;
  }

  clickNextStep();
  if (step <= 4) {
    return;
  }

  clickNextStep();
  if (step <= 5) {
    return;
  }

  clickNextStep();
}

describe("SetupPage", () => {
  beforeEach(() => {
    if (typeof window.localStorage?.clear === "function") {
      window.localStorage.clear();
    }
    if (typeof window.sessionStorage?.clear === "function") {
      window.sessionStorage.clear();
    }
    vi.restoreAllMocks();
  });

  it("setzt Vereins-Parameter bei Kreiswechsel zurueck", () => {
    renderSetupPage();

    fireEvent.click(screen.getAllByRole("button", { name: /Kreis .* auswählen/i })[0]);
    clickNextStep();
    fireEvent.click(screen.getByRole("button", { name: /D-Jugend auswählen/i }));
    clickNextStep();

    fireEvent.change(screen.getByLabelText(/Verein hinzuf/i), {
      target: { value: "TSV Heimaterde" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Vereinsfeld hinzuf/i }));

    expect(screen.getByText(/Alle löschen/i)).toBeInTheDocument();

    clickBackStep();
    clickBackStep();
    fireEvent.click(screen.getByRole("button", { name: /Kreis Duisburg auswählen/i }));
    clickNextStep();
    clickNextStep();

    expect(screen.queryByText(/Alle löschen/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Keine Vereinsparameter gesetzt/i)).toBeInTheDocument();
  });

  it("zeigt nur den Tatort-Block ohne Favoriten-Eingabe", () => {
    renderSetupPage();
    goToStepWithRequiredSelections(5);

    expect(screen.getByLabelText(/Tatort \/ Einsatzadresse/i)).toBeInTheDocument();
    expect(screen.getByText(/Routen-API:/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Beobachtete Teams/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Favorit \+/i })).not.toBeInTheDocument();
  });

  it("zeigt Unterstufen-Auswahl fuer Jugendklassen ausser Bambini", () => {
    renderSetupPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Kreis .* auswählen/i })[0]);
    clickNextStep();

    fireEvent.click(screen.getByRole("button", { name: /D-Jugend auswählen/i }));
    const d1Chip = screen.getByRole("button", { name: /D I auswählen/i });
    fireEvent.click(d1Chip);

    expect(d1Chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Unterstufen entfernen/i)).toBeInTheDocument();
  });

  it("zeigt bei Bambini keinen Unterstufen-Parameter", () => {
    renderSetupPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Kreis .* auswählen/i })[0]);
    clickNextStep();

    fireEvent.click(screen.getByRole("button", { name: /Bambini auswählen/i }));

    expect(screen.getByText(/Für Bambini gibt es keine Unterstufen-Parameter/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /BAM I auswählen/i })).not.toBeInTheDocument();
  });

  it("ignoriert persistierte localStorage-Defaults und startet frisch", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.setup,
      JSON.stringify({
        kreisId: "duisburg",
        jugendId: "d-jugend",
        selTeams: ["TSV Heimaterde"],
        fromDate: "2026-05-12",
        adapterEndpoint: "https://example.com/api/games",
      }),
    );

    renderSetupPage();

    expect(screen.queryByLabelText(/Scout-Fokus/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("TSV Heimaterde")).not.toBeInTheDocument();
    const nextButton = screen.getByRole("button", { name: /Weiter zum nächsten Schritt/i });
    expect(nextButton).toBeDisabled();
    expect(nextButton).toHaveTextContent(/Kreis auswählen/i);
  });

  it("öffnet die Kalenderauswahl und übernimmt ein Datum", () => {
    renderSetupPage();
    goToStepWithRequiredSelections(4);

    const dateToggle = screen.getByRole("button", { name: /Scouting-Datum auswählen/i });
    fireEvent.click(dateToggle);

    expect(screen.getByRole("dialog", { name: /Kalenderauswahl/i })).toBeInTheDocument();

    const dayButtons = screen.getAllByRole("button", { name: /Datum .* auswählen/i });
    const enabledDay = dayButtons.find((button) => !button.hasAttribute("disabled"));
    expect(enabledDay).toBeDefined();

    const selectedLabel = String(enabledDay?.getAttribute("aria-label") || "");
    const selectedDateText = selectedLabel.replace(/^Datum\s+/i, "").replace(/\s+auswählen$/i, "");

    if (enabledDay) {
      fireEvent.click(enabledDay);
    }

    expect(screen.queryByRole("dialog", { name: /Kalenderauswahl/i })).not.toBeInTheDocument();
    expect(dateToggle).toHaveTextContent(selectedDateText);
  });

  it("erlaubt Leerzeichen im Scout-Namen", () => {
    renderSetupPage();
    goToStepWithRequiredSelections(6);

    const scoutNameInput = screen.getByLabelText(/Scout-Name \(für Abrechnung\)/i);
    fireEvent.change(scoutNameInput, { target: { value: "Ayoub El Idrissi" } });

    expect(scoutNameInput).toHaveValue("Ayoub El Idrissi");
  });
});
