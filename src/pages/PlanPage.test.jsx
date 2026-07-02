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

function openHrworksDialog() {
  fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));
  return screen.getByRole("dialog", { name: /HRworks-Import beauftragen/i });
}

function fillHrworksCredentials(dialog, username = "scout@example.com", password = "geheim") {
  fireEvent.change(within(dialog).getByLabelText(/Benutzername/i), { target: { value: username } });
  fireEvent.change(within(dialog).getByLabelText(/Passwort/i), { target: { value: password } });
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
            league: "D-Junioren Kreisleistungsklasse",
            matchUrl: "https://www.fussball.de/spiel/team-a-team-b/-/spiel/02U0CT5KV4000000VS5489BTVUFLAKGJ",
          },
        ],
      }),
    );

    render(<PlanPage />);

    expect(screen.getByText(/Alle 1 Spiele/i)).toBeInTheDocument();
    expect(screen.getByText(/Liga\/Wettbewerb: D-Junioren Kreisleistungsklasse/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Zum Spiel auf fussball.de für Team A gegen Team B/i })).toHaveAttribute(
      "href",
      "https://www.fussball.de/spiel/team-a-team-b/-/spiel/02U0CT5KV4000000VS5489BTVUFLAKGJ",
    );
  });

  it("zeigt Turniere und DFB-Spiele im Plan uebersichtlich als eigene Typen", () => {
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Pfingstcup U12\nSpiel 2: Deutschland U21 vs Frankreich U21",
        games: [
          {
            id: "turnier-1",
            home: "Pfingstcup U12",
            away: "Turnier",
            priority: 5,
            dateObj: new Date("2026-04-10T00:00:00"),
            dateLabel: "Fr., 10.04.2026",
            time: "--:--",
            source: "tournament",
            provider: "meinturnierplan.de",
            turnier: true,
            competitionName: "Pfingstcup U12",
            matchUrl: "https://www.meinturnierplan.de/showit.php?id=1",
          },
          {
            id: "dfb-1",
            home: "Deutschland U21",
            away: "Frankreich U21",
            priority: 5,
            dateObj: new Date("2026-04-11T00:00:00"),
            dateLabel: "Sa., 11.04.2026",
            time: "18:00",
            source: "national",
            provider: "dfb.de",
            ageGroup: "U21",
            competitionName: "DFB U21-Länderspiel",
            matchUrl: "https://www.dfb.de/u-21-maenner/spiele-termine",
          },
        ],
      }),
    );

    render(<PlanPage />);

    expect(screen.getByText(/Spieltypen/i)).toBeInTheDocument();
    expect(screen.getByText("Turniere")).toBeInTheDocument();
    expect(screen.getByText("DFB-Spiele")).toBeInTheDocument();
    expect(screen.getAllByText("Turnier").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DFB U21").length).toBeGreaterThan(0);
    expect(screen.getByText(/Typ\/Quelle: Turnier · meinturnierplan\.de/i)).toBeInTheDocument();
    expect(screen.getByText(/Typ\/Quelle: DFB U21 · dfb\.de/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Zum Spiel auf meinturnierplan\.de für Pfingstcup U12 gegen Turnier/i })).toHaveTextContent(
      "meinturnierplan.de öffnen",
    );
    expect(screen.getByRole("link", { name: /Zum Spiel auf dfb\.de für Deutschland U21 gegen Frankreich U21/i })).toHaveTextContent(
      "dfb.de öffnen",
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

  it("öffnet den HRworks-Auftrag ohne Datei-Pflicht und blockiert den Start ohne Zugangsdaten", () => {
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
    const dialog = openHrworksDialog();

    expect(within(dialog).queryByText(/XLSX/i)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/ScoutX erzeugt die HRworks-Datei automatisch aus diesem Plan/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Importauftrag starten" })).toBeDisabled();
  });

  it("setzt Zweck und Bemerkung auf Heimmannschaften ohne Datei-Upload", () => {
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
    const dialog = openHrworksDialog();

    expect(within(dialog).getByText("Sichtung / (Team A)")).toBeInTheDocument();
    expect(within(dialog).queryByText(/Sichtung \/ \(Team A vs Team B\)/)).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Benutzername/i)).toBeInTheDocument();
  });

  it("nutzt den Abfahrtsort aus der Plan-Historie für den HRworks-Auftrag", () => {
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
    const dialog = openHrworksDialog();

    expect(within(dialog).getAllByText(/Sternbuschweg 326/i).length).toBeGreaterThan(0);
    expect(within(dialog).queryByText(/Abfahrtsort fehlt/i)).not.toBeInTheDocument();
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
    const dialog = openHrworksDialog();

    expect(within(dialog).getAllByText(/Sternbuschweg 326/i).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(/Sternbuschweg 326 -> Team A \| Team A -> Sternbuschweg 326/i).length).toBeGreaterThan(0);
    expect(within(dialog).queryByText(new RegExp(rawStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).not.toBeInTheDocument();
  });

  it("zeigt im HRworks-Auftrag die Route mit Heimmannschaften und Rückweg statt Venue-Labels", () => {
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
    const dialog = openHrworksDialog();

    expect(within(dialog).getAllByText(/Sternbuschweg 326 -> Team A \| Team A -> Team C \| Team C -> Sternbuschweg 326/i).length).toBeGreaterThanOrEqual(1);
    expect(within(dialog).queryByText(/Sportplatz A, Duisburg/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Sportplatz B, Duisburg/)).not.toBeInTheDocument();
  });

  it("verwendet Datum und Uhrzeit aus dem Plan für den HRworks-Auftrag", () => {
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

    render(<PlanPage />);
    const dialog = openHrworksDialog();

    expect(within(dialog).getByText("2026-05-23")).toBeInTheDocument();
    expect(within(dialog).getByText("14:00")).toBeInTheDocument();
    expect(within(dialog).getByText("16:00")).toBeInTheDocument();
  });

  it("zeigt auf der Plan-Seite nur noch den einen HRworks-Einstieg und keine irreführenden Nebenbuttons", () => {
    mockedUseScoutX.mockReturnValue(
      createBaseContext({
        plan: "Spiel 1: Team A vs Team B",
      }),
    );

    render(<PlanPage />);

    expect(screen.getByRole("button", { name: /In HRworks importieren/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Arbeitszeitdatei importieren/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /HRworks Mapping bearbeiten/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /HRworks Pflichtfelder/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /HRworks Setup/i })).not.toBeInTheDocument();
  });

  it("startet beim produktiven HRworks-Klick einen serverseitigen Importauftrag ohne Datei-Upload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return { ok: true, jobId: "job-42", status: "queued", job: { id: "job-42", status: "queued" } };
      },
    });
    vi.stubGlobal("fetch", fetchMock);
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
    const dialog = openHrworksDialog();
    fillHrworksCredentials(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Importauftrag starten" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/hrworks/import-jobs", expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"payloads\""),
      }));
    });
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.credentials).toEqual({ baseUrl: "", username: "scout@example.com", password: "geheim" });
    expect(requestBody.payloads[0]).toMatchObject({ date: "2026-04-10", startTime: "14:00" });

    await waitFor(() => {
      expect(within(dialog).getByText("In Warteschlange")).toBeInTheDocument();
    });
  });

  it("zeigt die Duplikatwarnung und lässt den Re-Import ohne Chrome-Confirm zu", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
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

    render(<PlanPage />);
    const dialog = openHrworksDialog();
    fillHrworksCredentials(dialog);

    expect(within(dialog).getByText(/bereits importiert/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Importauftrag starten" })).not.toBeDisabled();
    expect(confirmSpy).not.toHaveBeenCalled();
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
