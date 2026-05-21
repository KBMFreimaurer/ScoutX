import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
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

  it("zeigt HRworks-Button und lässt Klick mit Hinweis zu, auch ohne Spiele", () => {
    const setErr = vi.fn();
    mockedUseScoutX.mockReturnValue(createBaseContext({ games: [], plannedGames: [], setErr }));

    render(<PlanPage />);

    const button = screen.getByRole("button", { name: /In HRworks importieren/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(setErr).toHaveBeenCalledWith(expect.stringMatching(/Keine Spiele im Plan/i));
  });

  it("öffnet HRworks-Review und blockiert Import bei fehlenden Pflichtdaten", () => {
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        startLocation: null,
        games: [
          {
            id: "game-1",
            home: "Team A",
            away: "Team B",
            priority: 5,
            dateObj: new Date("2026-04-10T00:00:00"),
            date: "2026-04-10",
            time: "14:00",
            venue: "Sportplatz A",
          },
        ],
      }),
    );

    render(<PlanPage />);

    fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));

    expect(screen.getByRole("dialog", { name: /HRworks-Import prüfen/i })).toBeInTheDocument();
    expect(screen.getByText(/Abfahrtsort fehlt/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Produktiv in HRworks speichern und abschließen/i })).toBeDisabled();
  });

  it("setzt Zweck und Bemerkung auf Heimmannschaften und erlaubt leeren Zielort", () => {
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        startLocation: { label: "Sternbuschweg 326" },
        routeOverview: {
          legs: [
            { from: "Sternbuschweg 326", to: "Sportplatz A", distanceKm: 10.2 },
            { from: "Sportplatz A", to: "Sternbuschweg 326", distanceKm: 10.1 },
          ],
          totalKm: 20.3,
          estimatedMinutes: 31,
        },
        games: [
          {
            id: "game-1",
            home: "Team A",
            away: "Team B",
            priority: 5,
            dateObj: new Date("2026-04-10T00:00:00"),
            date: "2026-04-10",
            time: "14:00",
            venue: "Sportplatz A",
          },
        ],
      }),
    );

    render(<PlanPage />);
    fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));

    expect(screen.getAllByText("Sichtung / (Team A)").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/Sichtung \/ \(Team A vs Team B\)/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Sternbuschweg 326 -> Sportplatz A \| Sportplatz A -> Sternbuschweg 326/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Zielort fehlt/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Produktiv in HRworks speichern und abschließen/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Ich bin in HRworks eingeloggt/i));
    expect(screen.getByRole("button", { name: /Produktiv in HRworks speichern und abschließen/i })).not.toBeDisabled();
  });

  it("verwendet Datum und Uhrzeit aus der Arbeitszeitdatei als bindende HRworks-Zeitdaten", async () => {
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        startLocation: { label: "Sternbuschweg 326" },
        routeOverview: {
          legs: [
            { from: "Sternbuschweg 326", to: "Sportplatz A", distanceKm: 10.2 },
            { from: "Sportplatz A", to: "Sternbuschweg 326", distanceKm: 10.1 },
          ],
        },
        games: [
          {
            id: "game-1",
            home: "Team A",
            away: "Team B",
            dateObj: new Date("2026-05-23T00:00:00"),
            date: "2026-05-23",
            time: "14:00",
            venue: "Sportplatz A",
          },
        ],
      }),
    );

    const { container } = render(<PlanPage />);
    const fileInput = container.querySelector("input[type='file']");
    const csv = [
      "Name;Datum;Beginn;Ende;Vermerk",
      "Onay Kirmizigül;11.04.2026;08:00;13:00;Sichtung",
    ].join("\n");
    const file = {
      name: "AEB April Onay.csv",
      async text() {
        return csv;
      },
    };

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /HRworks-Import prüfen/i })).toBeInTheDocument();
    });
    expect(screen.getByText("2026-04-11")).toBeInTheDocument();
    expect(screen.getByText("08:00")).toBeInTheDocument();
    expect(screen.getByText("13:00")).toBeInTheDocument();
    expect(screen.getByText(/XLSX-Datum ist bindend: 2026-04-11/i)).toBeInTheDocument();
    expect(screen.getAllByText("Sichtung / (Team A)").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/Sichtung \/ \(Team A vs Team B\)/)).not.toBeInTheDocument();
  });

  it("blockiert Importstart wenn Betriebsentscheidungen fehlen", () => {
    const setErr = vi.fn();
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        startLocation: { label: "Sternbuschweg 326" },
        setErr,
        games: [
          {
            id: "game-1",
            home: "Team A",
            away: "Team B",
            priority: 5,
            dateObj: new Date("2026-04-10T00:00:00"),
            date: "2026-04-10",
            time: "14:00",
            venue: "Sportplatz A",
          },
        ],
      }),
    );

    render(<PlanPage />);
    fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));
    fireEvent.click(screen.getByLabelText(/Ich bin in HRworks eingeloggt/i));
    fireEvent.click(screen.getByRole("button", { name: /Produktiv in HRworks speichern und abschließen/i }));

    expect(setErr).toHaveBeenCalledWith(expect.stringMatching(/HRworks-Setup unvollständig/i));
  });

  it("lässt nach einem Testlauf den produktiven HRworks-Start im Review aktiv", () => {
    const setErr = vi.fn();
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        startLocation: { label: "Sternbuschweg 326" },
        setErr,
        games: [
          {
            id: "game-1",
            home: "Team A",
            away: "Team B",
            priority: 5,
            dateObj: new Date("2026-04-10T00:00:00"),
            date: "2026-04-10",
            time: "14:00",
            venue: "Sportplatz A",
          },
        ],
      }),
    );
    window.localStorage.setItem("scoutx.hrworksPolicy.v1", JSON.stringify({
      defaultCostCenter: "Junioren allgemein (321000)",
      requireSaveConfirmation: true,
      aggregationMode: "per_day",
      finalSaveMode: "auto_save",
      requiredFields: {
        purpose: true,
        note: true,
        departureLocation: true,
        destinationLocation: false,
        costCenter: true,
      },
    }));

    render(<PlanPage />);
    fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));
    fireEvent.click(screen.getByLabelText(/Ich bin in HRworks eingeloggt/i));
    fireEvent.click(screen.getByRole("button", { name: /Testlauf \(kein Speichern\)/i }));

    expect(screen.getByRole("dialog", { name: /HRworks-Import prüfen/i })).toBeInTheDocument();
    expect(screen.getByText(/Testlauf abgeschlossen/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Produktiv in HRworks speichern/i })).not.toBeDisabled();
  });

  it("startet beim produktiven HRworks-Klick die lokale Automation-Bridge", async () => {
    const setErr = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return { ok: true, status: "completed", url: "https://ssl4.hrworks.de/k/travel-management/trips" };
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        startLocation: { label: "Sternbuschweg 326" },
        setErr,
        games: [
          {
            id: "game-1",
            home: "Team A",
            away: "Team B",
            priority: 5,
            dateObj: new Date("2026-04-10T00:00:00"),
            date: "2026-04-10",
            time: "14:00",
            venue: "Sportplatz A",
          },
        ],
      }),
    );
    window.localStorage.setItem("scoutx.hrworksPolicy.v1", JSON.stringify({
      defaultCostCenter: "Junioren allgemein (321000)",
      requireSaveConfirmation: true,
      aggregationMode: "per_day",
      finalSaveMode: "auto_save",
      requiredFields: {
        purpose: true,
        note: true,
        departureLocation: true,
        destinationLocation: false,
        costCenter: true,
      },
    }));

    render(<PlanPage />);
    fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));
    fireEvent.click(screen.getByLabelText(/Ich bin in HRworks eingeloggt/i));
    fireEvent.click(screen.getByRole("button", { name: /Produktiv in HRworks speichern/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8791/api/hrworks/import", expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"completeWorkflow\":true"),
      }));
    });
    await waitFor(() => {
      expect(setErr).toHaveBeenCalledWith(expect.stringMatching(/HRworks-Import.*abgeschlossen/i));
    });
  });

  it("zeigt sichtbare HRworks-Setup-Warnkarte bei fehlenden Entscheidungen", () => {
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
      }),
    );

    render(<PlanPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(/HRworks-Setup unvollständig/i);
    expect(screen.getByText(/Aggregation nicht festgelegt/i)).toBeInTheDocument();
    expect(screen.getByText(/Finaler Speichermodus nicht festgelegt/i)).toBeInTheDocument();
  });

  it("übernimmt empfohlenes HRworks-Setup und entfernt die Warnkarte", () => {
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
      }),
    );

    render(<PlanPage />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Empfohlenes HRworks Setup anwenden/i }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

  it("zeigt Audit-Export in der HRworks-Importhistorie", () => {
    window.localStorage.setItem("scoutx.hrworksImports.v1", JSON.stringify([
      {
        id: "hrw-1",
        planId: "D-Jugend-Duisburg",
        date: "2026-04-20",
        startTime: "08:00",
        endTime: "10:00",
        purpose: "Sichtung",
        hrworksStatus: "ready",
        importedAt: "2026-04-20T10:00:00.000Z",
        executedBy: "M*** M***",
        technicalResult: "Review bestätigt",
      },
    ]));

    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
      }),
    );

    render(<PlanPage />);

    expect(screen.getByText(/HRworks-Importhistorie/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Audit-Log exportieren/i })).toBeInTheDocument();
  });
});
