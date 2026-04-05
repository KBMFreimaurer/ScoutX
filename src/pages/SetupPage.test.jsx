import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ScoutXProvider } from "../context/ScoutXContext";
import { SetupProvider } from "../context/SetupContext";
import { GamesProvider } from "../context/GamesContext";
import { PlanProvider } from "../context/PlanContext";
import { SetupPage } from "./SetupPage";

function renderSetupPage() {
  return render(
    <MemoryRouter initialEntries={["/setup"]}>
      <SetupProvider defaultAdapterEndpoint="/api/games">
        <GamesProvider>
          <PlanProvider defaultLlmEndpoint="/ollama">
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
});
