import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GamesPage } from "./GamesPage";
import { useScoutX } from "../context/ScoutXContext";
import { useScoutXProduct } from "../context/ScoutXProductContext";

vi.mock("../context/ScoutXContext", () => ({
  useScoutX: vi.fn(),
}));

vi.mock("../context/ScoutXProductContext", () => ({
  useScoutXProduct: vi.fn(),
}));

const mockedUseScoutX = vi.mocked(useScoutX);
const mockedUseScoutXProduct = vi.mocked(useScoutXProduct);

function createGame(overrides = {}) {
  return {
    id: "game-1",
    home: "Team A",
    away: "Team B",
    priority: 5,
    dateObj: new Date("2026-05-01T00:00:00"),
    dateLabel: "Fr, 01.05.2026",
    time: "14:00",
    venue: "Platz A",
    ...overrides,
  };
}

function createScoutXContext(overrides = {}) {
  return {
    games: [createGame()],
    jugend: { label: "D-Jugend" },
    kreis: { label: "Duisburg" },
    kreisLabel: "Duisburg",
    activeTeams: [],
    startLocation: null,
    teamValidation: null,
    enrichingGames: false,
    gameNotes: {},
    selectedGameIds: {},
    selectedGameCount: 0,
    pdfExporting: false,
    isMobile: false,
    onSetGameNote: vi.fn(),
    onTogglePlannedGame: vi.fn(),
    onSelectAllPlannedGames: vi.fn(),
    onClearPlannedGames: vi.fn(),
    onBackSetup: vi.fn(),
    onGeneratePlanPdf: vi.fn(),
    ...overrides,
  };
}

describe("GamesPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockedUseScoutX.mockReturnValue(createScoutXContext());
    mockedUseScoutXProduct.mockReturnValue({
      activeUser: { id: "user-scout", name: "Scout", role: "scout" },
      getGameObservationMap: () => ({
        "game-1": {
          label: "im Plan von Koordination",
          plannedByOtherScouts: ["Koordination"],
          plannedBy: [{ scoutId: "user-coordinator", scoutName: "Koordination", status: "planned" }],
        },
      }),
    });
  });

  it("fragt vor erneuter Auswahl eines fremd verplanten Spiels nach Bestätigung", () => {
    const onTogglePlannedGame = vi.fn();
    mockedUseScoutX.mockReturnValue(createScoutXContext({ onTogglePlannedGame }));
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<GamesPage />);

    fireEvent.click(screen.getAllByRole("checkbox", { name: /Spiel auswählen: Team A gegen Team B/i })[0]);

    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/Koordination/));
    expect(onTogglePlannedGame).not.toHaveBeenCalled();
  });

  it("übernimmt die Auswahl nach Bestätigung", () => {
    const onTogglePlannedGame = vi.fn();
    mockedUseScoutX.mockReturnValue(createScoutXContext({ onTogglePlannedGame }));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<GamesPage />);

    fireEvent.click(screen.getAllByRole("checkbox", { name: /Spiel auswählen: Team A gegen Team B/i })[0]);

    expect(onTogglePlannedGame).toHaveBeenCalledWith("game-1");
  });
});
