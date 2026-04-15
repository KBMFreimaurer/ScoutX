import { fireEvent, render, screen } from "@testing-library/react";
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
    plannedGames: [],
    plan: "",
    kreis: { label: "Duisburg" },
    jugend: { label: "D-Jugend" },
    isMobile: false,
    cfg: {
      kreisLabel: "Duisburg",
      jugendLabel: "D-Jugend",
      jugendAlter: "11-12",
      fromDate: "2026-04-05",
    },
    routeOverview: null,
    planHistory: [],
    activeHistoryEntry: null,
    startLocation: null,
    dataSourceUsed: "adapter",
    adapterEndpoint: "/api/games",
    adapterToken: "",
    kreisId: "duisburg",
    jugendId: "d-jugend",
    activeTeams: [],
    fromDate: "2026-04-05",
    toDate: "2026-04-11",
    setGames: vi.fn(),
    setErr: vi.fn(),
    onOpenPlanHistory: vi.fn(),
    onDeletePlanHistory: vi.fn(),
    onClearPlanHistory: vi.fn(),
    onUpdatePlanHistoryPresence: vi.fn(),
    onUpdatePlanHistoryGames: vi.fn(),
    onBackGames: vi.fn(),
    onResetSoft: vi.fn(),
    onResetHard: vi.fn(),
    ...overrides,
  };
}

describe("PlanPage", () => {
  beforeEach(() => {
    mockedUseScoutX.mockReset();
    vi.restoreAllMocks();
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

  it("zeigt fussball.de-Direktlink im Scoutplan-Review", () => {
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        plannedGames: [],
        games: [
          {
            id: "game-1",
            home: "Team A",
            away: "Team B",
            priority: 5,
            dateObj: new Date("2026-04-10T00:00:00"),
            time: "14:00",
            matchUrl: "https://www.fussball.de/spiel/team-a-team-b/-/spiel/02U0CT5KV4000000VS5489BTVUFLAKGJ",
          },
        ],
      }),
    );

    render(<PlanPage />);

    expect(screen.getByText(/Alle 1 Spiele/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Zum Spiel auf fussball.de für Team A gegen Team B/i })).toHaveAttribute(
      "href",
      "https://www.fussball.de/spiel/team-a-team-b/-/spiel/02U0CT5KV4000000VS5489BTVUFLAKGJ",
    );
  });

  it("zeigt manuelle Arbeitszeiterfassung in der Fahrtkosten-Sektion", () => {
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        games: [
          {
            id: "game-1",
            home: "Team A",
            away: "Team B",
            priority: 5,
            dateObj: new Date("2026-04-10T00:00:00"),
            time: "14:00",
            venue: "Sportplatz A",
            distanceKm: 11.2,
          },
        ],
      }),
    );

    render(<PlanPage />);

    expect(screen.getByText(/Arbeitszeiterfassung \(manuell\)/i)).toBeInTheDocument();
  });

  it("zeigt Plan-Historie und lädt einen historischen Plan", () => {
    const onOpenPlanHistory = vi.fn();
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        planHistory: [
          {
            id: "hist-1",
            createdAt: "2026-04-13T10:20:00.000Z",
            meta: {
              kreisLabel: "Duisburg",
              jugendLabel: "D-Jugend",
              fromDate: "2026-04-10",
              toDate: "2026-04-13",
            },
          },
        ],
        onOpenPlanHistory,
      }),
    );

    render(<PlanPage />);

    const openButton = screen.getByRole("button", { name: /Historischen Plan .* öffnen/i });
    fireEvent.click(openButton);

    expect(onOpenPlanHistory).toHaveBeenCalledWith("hist-1");
  });

  it("fragt vor dem Leeren der Historie nach Bestätigung", () => {
    const onClearPlanHistory = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        planHistory: [
          {
            id: "hist-1",
            createdAt: "2026-04-13T10:20:00.000Z",
            meta: { kreisLabel: "Duisburg", jugendLabel: "D-Jugend", fromDate: "2026-04-10", toDate: "2026-04-13" },
          },
        ],
        onClearPlanHistory,
      }),
    );

    render(<PlanPage />);
    fireEvent.click(screen.getByRole("button", { name: /Historie leeren/i }));

    expect(onClearPlanHistory).not.toHaveBeenCalled();
  });

  it("fragt vor dem Entfernen eines historischen Plans nach Bestätigung", () => {
    const onDeletePlanHistory = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        planHistory: [
          {
            id: "hist-1",
            createdAt: "2026-04-13T10:20:00.000Z",
            meta: { kreisLabel: "Duisburg", jugendLabel: "D-Jugend", fromDate: "2026-04-10", toDate: "2026-04-13" },
          },
        ],
        onDeletePlanHistory,
      }),
    );

    render(<PlanPage />);
    fireEvent.click(screen.getByRole("button", { name: /Historischen Plan .* entfernen/i }));

    expect(onDeletePlanHistory).not.toHaveBeenCalled();
  });
});
