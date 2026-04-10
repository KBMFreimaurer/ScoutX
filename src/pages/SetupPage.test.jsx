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

    fireEvent.change(screen.getByLabelText(/Verein hinzuf/i), {
      target: { value: "TSV Heimaterde" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Vereinsfeld hinzuf/i }));

    expect(screen.getByText(/Alle löschen/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Kreis Duisburg auswählen/i }));

    expect(screen.queryByText(/Alle löschen/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Keine Vereinsparameter gesetzt/i)).toBeInTheDocument();
  });

  it("pflegt Favoritenliste im Setup", () => {
    renderSetupPage();

    expect(screen.getByLabelText(/Startort \/ Abfahrtsadresse/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Beobachtete Teams/i), {
      target: { value: "TSV Heimaterde" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Favorit \+/i }));

    expect(screen.getByRole("button", { name: /★ TSV Heimaterde/i })).toBeInTheDocument();
  });

  it("ignoriert persistierte localStorage-Defaults und startet frisch", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.setup,
      JSON.stringify({
        kreisId: "duisburg",
        jugendId: "d-jugend",
        selTeams: ["TSV Heimaterde"],
        fromDate: "2026-05-12",
        focus: "Innenverteidiger",
        adapterEndpoint: "https://example.com/api/games",
      }),
    );

    renderSetupPage();

    expect(screen.getByLabelText(/Scout-Fokus/i)).toHaveValue("");
    expect(screen.queryByDisplayValue("TSV Heimaterde")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kreis wählen/i })).toBeDisabled();
  });
});
