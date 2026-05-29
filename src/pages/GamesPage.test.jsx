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
    providerWarnings: [],
    includeTournaments: false,
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

  it("warnt vor Planabschluss bei Konflikten und bricht ohne Bestätigung ab", () => {
    const onGeneratePlanPdf = vi.fn();
    mockedUseScoutX.mockReturnValue(
      createScoutXContext({
        games: [
          createGame({ id: "game-1", date: "2026-09-01", time: "10:00" }),
          createGame({ id: "game-2", home: "Team C", away: "Team D", date: "2026-09-01", time: "10:30" }),
        ],
        selectedGameIds: { "game-1": true, "game-2": true },
        selectedGameCount: 2,
        onGeneratePlanPdf,
      }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<GamesPage />);
    fireEvent.click(screen.getByRole("button", { name: /Plan öffnen/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/Konfliktwarnung vor Planabschluss/i);
    expect(window.confirm).toHaveBeenCalled();
    expect(onGeneratePlanPdf).not.toHaveBeenCalled();
  });

  it("lässt Planabschluss nach Konfliktwarnung und Bestätigung zu", () => {
    const onGeneratePlanPdf = vi.fn();
    mockedUseScoutX.mockReturnValue(
      createScoutXContext({
        games: [
          createGame({ id: "game-1", date: "2026-09-01", time: "10:00" }),
          createGame({ id: "game-2", home: "Team C", away: "Team D", date: "2026-09-01", time: "10:30" }),
        ],
        selectedGameIds: { "game-1": true, "game-2": true },
        selectedGameCount: 2,
        onGeneratePlanPdf,
      }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<GamesPage />);
    fireEvent.click(screen.getByRole("button", { name: /Plan öffnen/i }));

    expect(onGeneratePlanPdf).toHaveBeenCalledTimes(1);
  });

  it("zeigt geladene Turniere und Turnier-Warnungen getrennt von normalen Spielen", () => {
    mockedUseScoutX.mockReturnValue(
      createScoutXContext({
        includeTournaments: true,
        providerWarnings: ["Keine passenden Turniere von meinturnierplan.de geladen."],
        games: [
          createGame({ id: "game-1", home: "Team A", away: "Team B" }),
          createGame({
            id: "tournament-1",
            home: "U12 Cup Duisburg",
            away: "Turnier",
            turnier: true,
            source: "tournament",
            provider: "meinturnierplan.de",
          }),
        ],
      }),
    );

    render(<GamesPage />);

    expect(screen.getByText(/2 Spiele · 1 Turnier · 0 Team-Parameter/i)).toBeInTheDocument();
    expect(screen.getByText(/Keine passenden Turniere von meinturnierplan\.de geladen\./i)).toBeInTheDocument();
    expect(screen.getAllByText("Turnier").length).toBeGreaterThan(0);
  });
});
