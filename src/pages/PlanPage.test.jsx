import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanPage } from "./PlanPage";
import { useScoutX } from "../context/ScoutXContext";

vi.mock("../context/ScoutXContext", () => ({
  useScoutX: vi.fn(),
}));

const mockedUseScoutX = vi.mocked(useScoutX);

function createBaseContext(overrides = {}) {
  return {
    games: [],
    plan: "",
    kreis: { label: "Duisburg" },
    jugend: { label: "D-Jugend" },
    isMobile: false,
    cfg: {
      kreisLabel: "Duisburg",
      jugendLabel: "D-Jugend",
      jugendAlter: "11-12",
      fromDate: "2026-04-05",
      focus: "Allgemein",
    },
    routeOverview: null,
    startLocation: null,
    onBackGames: vi.fn(),
    onResetSoft: vi.fn(),
    onResetHard: vi.fn(),
    ...overrides,
  };
}

describe("PlanPage", () => {
  beforeEach(() => {
    mockedUseScoutX.mockReset();
  });

  it("zeigt den Plan-Text", () => {
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "VALIDIERUNG\nSpiel 1: Team A vs Team B",
      }),
    );

    render(<PlanPage />);

    expect(screen.getByText(/VALIDIERUNG/i)).toBeInTheDocument();
    expect(screen.getByText(/Team A vs Team B/i)).toBeInTheDocument();
  });

  it("deaktiviert den PDF-Button wenn kein Plan vorhanden ist", () => {
    mockedUseScoutX.mockReturnValue(createBaseContext({ plan: "" }));

    render(<PlanPage />);

    expect(screen.getByRole("button", { name: /PDF herunterladen/i })).toBeDisabled();
  });

  it("zeigt Routenübersicht mit Gesamtstrecke und Fahrzeit", () => {
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        startLocation: { label: "Mönchengladbach" },
        routeOverview: {
          legs: [
            { from: "Mönchengladbach", to: "Team A vs Team B", distanceKm: 14.6 },
            { from: "Team A vs Team B", to: "Mönchengladbach", distanceKm: 8.1 },
          ],
          totalKm: 22.7,
          estimatedMinutes: 27,
        },
      }),
    );

    render(<PlanPage />);

    expect(screen.getByText(/Routenübersicht/i)).toBeInTheDocument();
    expect(screen.getByText(/Start: Mönchengladbach/i)).toBeInTheDocument();
    expect(screen.getByText(/Gesamtstrecke: 23 km · Fahrzeit ca\. 27 Min/i)).toBeInTheDocument();
  });
});
