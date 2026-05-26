import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    expect(screen.getAllByText(/Sternbuschweg 326 -> Team A \| Team A -> Sternbuschweg 326/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Zielort fehlt/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Produktiv in HRworks speichern und abschließen/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Ich bin in HRworks eingeloggt/i));
    expect(screen.getByRole("button", { name: /Produktiv in HRworks speichern und abschließen/i })).not.toBeDisabled();
  });

  it("nutzt den Abfahrtsort aus der Plan-Historie für den HRworks-Import", () => {
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        startLocation: null,
        activeHistoryEntry: {
          id: "hist-1",
          meta: {
            startLocationLabel: "Sternbuschweg 326",
            kreisLabel: "Duisburg",
            jugendLabel: "D-Jugend",
          },
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

    expect(screen.getByText(/Abfahrtsort/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Sternbuschweg 326/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Abfahrtsort fehlt/i)).not.toBeInTheDocument();
  });

  it("verwendet für HRworks den gespeicherten Kurz-Abfahrtsort statt der langen Geocode-Adresse", () => {
    window.localStorage.setItem("scoutx.hrworksSmartDefaults.v1", JSON.stringify({
      "Onay Kirmizigül": {
        startLocation: "Sternbuschweg 326",
        costCenter: "Junioren allgemein (321000)",
      },
    }));
    const rawStart = "1, Geibelstraße, Neudorf-Süd, Duisburg-Mitte, Duisburg, Nordrhein-Westfalen, 47057, Deutschland";
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        scoutName: "Onay Kirmizigül",
        startLocation: { label: rawStart },
        routeOverview: {
          legs: [
            { from: rawStart, to: "Sportplatz A", distanceKm: 10.2 },
            { from: "Sportplatz A", to: rawStart, distanceKm: 10.1 },
          ],
        },
        games: [
          {
            id: "game-1",
            home: "Team A",
            away: "Team B",
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

    const dialog = screen.getByRole("dialog", { name: /HRworks-Import prüfen/i });
    expect(within(dialog).getAllByText(/Sternbuschweg 326/i).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(/Sternbuschweg 326 -> Team A \| Team A -> Sternbuschweg 326/i).length).toBeGreaterThan(0);
    expect(within(dialog).queryByText(new RegExp(rawStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).not.toBeInTheDocument();
  });

  it("zeigt im HRworks-Workflow die Route mit Heimmannschaften und Rückweg statt Venue-Labels", () => {
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B\nSpiel 2: Team C vs Team D",
        startLocation: { label: "Sternbuschweg 326" },
        routeOverview: {
          legs: [
            { from: "Sternbuschweg 326", to: "Sportplatz A, Duisburg", distanceKm: 5.4 },
            { from: "Sportplatz A, Duisburg", to: "Sportplatz B, Duisburg", distanceKm: 9.3 },
            { from: "Sportplatz B, Duisburg", to: "Sternbuschweg 326", distanceKm: 4.1 },
          ],
        },
        games: [
          {
            id: "game-1",
            home: "Team A",
            away: "Team B",
            dateObj: new Date("2026-04-25T00:00:00"),
            date: "2026-04-25",
            time: "18:00",
            venue: "Sportplatz A, Duisburg",
          },
          {
            id: "game-2",
            home: "Team C",
            away: "Team D",
            dateObj: new Date("2026-04-25T00:00:00"),
            date: "2026-04-25",
            time: "18:30",
            venue: "Sportplatz B, Duisburg",
          },
        ],
      }),
    );

    render(<PlanPage />);
    fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));

    const dialog = screen.getByRole("dialog", { name: /HRworks-Import prüfen/i });
    expect(within(dialog).getAllByText(/Sternbuschweg 326 -> Team A \| Team A -> Team C \| Team C -> Sternbuschweg 326/i).length).toBeGreaterThanOrEqual(1);
    expect(within(dialog).queryByText(/Sportplatz A, Duisburg/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Sportplatz B, Duisburg/)).not.toBeInTheDocument();
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

  it("wählt bei mehreren XLSX-Tagen automatisch den zum Plan nächstliegenden Tag", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
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
            dateObj: new Date("2026-05-18T00:00:00"),
            date: "2026-05-18",
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
      "Onay Kirmizigül;25.04.2026;08:00;13:00;Sichtung",
      "Onay Kirmizigül;17.05.2026;18:00;20:30;Sichtung",
    ].join("\n");
    const file = {
      name: "AEB Mai Onay.csv",
      async text() {
        return csv;
      },
    };

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /HRworks-Import prüfen/i })).toBeInTheDocument();
    });
    expect(screen.getByText("2026-05-17")).toBeInTheDocument();
    expect(screen.getByText("18:00")).toBeInTheDocument();
    expect(screen.getByText("20:30")).toBeInTheDocument();
    expect(screen.getByText(/nächstliegender Sichtungstag 2026-05-17/i)).toBeInTheDocument();
    expect(screen.getByText(/XLSX-Datum ist bindend: 2026-05-17/i)).toBeInTheDocument();
    expect(confirmSpy).toHaveBeenCalled();
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
        return {
          ok: true,
          status: "completed",
          url: "https://ssl4.hrworks.de/k/travel-management/trips",
          durationMs: 2592,
          metrics: {
            steps: [
              { step: "workflow_start", detail: "2026-04-10", elapsedMs: 0 },
              { step: "base_data_persisted", detail: "10.04.2026 - 10.04.2026", elapsedMs: 493 },
              { step: "leg_persisted", detail: "Leg 1/2 sofort erkannt", elapsedMs: 1137 },
            ],
          },
        };
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
      expect(setErr).toHaveBeenCalledWith(expect.stringMatching(/HRworks-Import.*abgeschlossen.*2,6 s/i));
    });
    const savedLog = JSON.parse(window.localStorage.getItem("scoutx.hrworksImports.v1"));
    expect(savedLog[0].durationMs).toBe(2592);
    expect(savedLog[0].performanceSteps).toHaveLength(3);
    expect(savedLog[0].technicalResult).toMatch(/2,6 s/);
  });

  it("startet Re-Import bei Duplikatwarnung ohne Chrome-Confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return { ok: true, status: "completed", url: "https://ssl4.hrworks.de/k/travel-management/trips" };
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem("scoutx.hrworksImports.v1", JSON.stringify([
      {
        planId: "D-Jugend-Duisburg-2026-04-10",
        date: "2026-04-10",
        startTime: "14:00",
        endTime: "16:00",
        purpose: "Sichtung / (Team A)",
        hrworksStatus: "failed",
        importedAt: "2026-04-10T16:01:00.000Z",
      },
    ]));
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
        startLocation: { label: "Sternbuschweg 326" },
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

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
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

  it("fragt vor dem Leeren der Historie per Inline-Dialog nach Bestätigung", () => {
    const onClearPlanHistory = vi.fn();

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

    expect(screen.getByRole("alertdialog", { name: /Plan-Historie löschen bestätigen/i })).toBeInTheDocument();
    expect(onClearPlanHistory).not.toHaveBeenCalled();
  });

  it("fragt vor dem Entfernen eines historischen Plans per Inline-Dialog nach Bestätigung", () => {
    const onDeletePlanHistory = vi.fn();

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
    fireEvent.click(screen.getByRole("button", { name: /Historischen Plan .* löschen/i }));

    expect(screen.getByRole("alertdialog", { name: /Plan-Historie löschen bestätigen/i })).toBeInTheDocument();
    expect(onDeletePlanHistory).not.toHaveBeenCalled();
  });

  it("entfernt einen historischen Plan nach Inline-Bestätigung", () => {
    const onDeletePlanHistory = vi.fn();

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
    fireEvent.click(screen.getByRole("button", { name: /Historischen Plan .* löschen/i }));
    fireEvent.click(screen.getByRole("button", { name: /Endgültig löschen/i }));

    expect(onDeletePlanHistory).toHaveBeenCalledWith("hist-1");
  });

  it("bricht das Löschen eines historischen Plans per Inline-Dialog ab", () => {
    const onDeletePlanHistory = vi.fn();

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
    fireEvent.click(screen.getByRole("button", { name: /Historischen Plan .* löschen/i }));
    fireEvent.click(screen.getByRole("button", { name: /Abbrechen/i }));

    expect(onDeletePlanHistory).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog", { name: /Plan-Historie löschen bestätigen/i })).not.toBeInTheDocument();
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
        durationMs: 2592,
        performanceSteps: [
          { step: "workflow_start", detail: "2026-04-20", elapsedMs: 0 },
          { step: "leg_persisted", detail: "Leg 1/2 sofort erkannt", elapsedMs: 1137 },
        ],
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
    expect(screen.getByText(/Laufzeit: 2,6 s/i)).toBeInTheDocument();
    expect(screen.getByText(/workflow_start/i)).toBeInTheDocument();
  });
});
