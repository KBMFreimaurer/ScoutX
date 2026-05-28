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

async function uploadHrworksTimesheet(container, csv, filename = "AEB Test.csv") {
  const fileInput = container.querySelector("input[type='file']");
  const file = {
    name: filename,
    async text() {
      return csv;
    },
  };
  fireEvent.change(fileInput, { target: { files: [file] } });
}

async function dropHrworksTimesheet(csv, filename = "AEB Test.csv") {
  const file = {
    name: filename,
    async text() {
      return csv;
    },
  };
  fireEvent.drop(screen.getByRole("button", { name: /XLSX-Datei per Drag-and-Drop hochladen/i }), {
    dataTransfer: { files: [file] },
  });
}

async function completeHrworksWizardUntilStep3(container, csv, filename = "AEB Test.csv") {
  await uploadHrworksTimesheet(container, csv, filename);
  const getDialog = () => screen.getByRole("dialog", { name: /HRworks-Import prüfen/i });
  await waitFor(() => {
    expect(within(getDialog()).getByLabelText(/Ich bin jetzt in HRworks eingeloggt/i)).toBeInTheDocument();
  });
  fireEvent.click(within(getDialog()).getByLabelText(/Ich bin jetzt in HRworks eingeloggt/i));
  await waitFor(() => {
    expect(within(getDialog()).getByRole("button", { name: /^HRworks importieren$/i })).toBeInTheDocument();
  });
  return getDialog();
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

  it("öffnet den HRworks-Wizard und blockiert den finalen Import bei fehlenden Pflichtdaten", () => {
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

    const dialog = screen.getByRole("dialog", { name: /HRworks-Import prüfen/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/STEP 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/STEP 2/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/STEP 3/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Abfahrtsort fehlt/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /^HRworks importieren$/i })).not.toBeInTheDocument();
  });

  it("setzt Zweck und Bemerkung auf Heimmannschaften und verlangt trotzdem erst die XLSX-Datei", () => {
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

    const dialog = screen.getByRole("dialog", { name: /HRworks-Import prüfen/i });

    expect(screen.queryByText(/STEP 2/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/STEP 3/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Ich bin jetzt in HRworks eingeloggt/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /XLSX-Datei per Drag-and-Drop hochladen/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /^HRworks importieren$/i })).not.toBeInTheDocument();
  });

  it("verarbeitet eine gedroppte Arbeitszeitdatei direkt im Wizard und schaltet danach auf Schritt 2", async () => {
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

    await dropHrworksTimesheet(
      [
        "Name;Datum;Beginn;Ende;Vermerk",
        "Onay Kirmizigül;10.04.2026;08:00;13:00;Sichtung",
      ].join("\n"),
      "AEB April Onay.csv",
    );

    const dialog = screen.getByRole("dialog", { name: /HRworks-Import prüfen/i });
    await waitFor(() => {
      expect(within(dialog).getByLabelText(/Ich bin jetzt in HRworks eingeloggt/i)).toBeInTheDocument();
    });
    expect(within(dialog).getByText(/AEB April Onay\.csv/i)).toBeInTheDocument();
  });

  it("nutzt den Abfahrtsort aus der Plan-Historie für den HRworks-Import", async () => {
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

    const { container } = render(<PlanPage />);
    fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));
    const csv = [
      "Name;Datum;Beginn;Ende;Vermerk",
      "Onay Kirmizigül;10.04.2026;08:00;13:00;Sichtung",
    ].join("\n");

    const dialog = await completeHrworksWizardUntilStep3(container, csv, "AEB April Onay.csv");

    expect(within(dialog).getByText(/Abfahrtsort/i)).toBeInTheDocument();
    expect(within(dialog).getAllByText(/Sternbuschweg 326/i).length).toBeGreaterThan(0);
    expect(within(dialog).queryByText(/Abfahrtsort fehlt/i)).not.toBeInTheDocument();
  });

  it("verwendet für HRworks den gespeicherten Kurz-Abfahrtsort statt der langen Geocode-Adresse", async () => {
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

    const { container } = render(<PlanPage />);
    fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));
    const csv = [
      "Name;Datum;Beginn;Ende;Vermerk",
      "Onay Kirmizigül;10.04.2026;08:00;13:00;Sichtung",
    ].join("\n");

    const dialog = await completeHrworksWizardUntilStep3(container, csv, "AEB April Onay.csv");

    expect(within(dialog).getAllByText(/Sternbuschweg 326/i).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(/Sternbuschweg 326 -> Team A \| Team A -> Sternbuschweg 326/i).length).toBeGreaterThan(0);
    expect(within(dialog).queryByText(new RegExp(rawStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).not.toBeInTheDocument();
  });

  it("zeigt im HRworks-Workflow die Route mit Heimmannschaften und Rückweg statt Venue-Labels", async () => {
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

    const { container } = render(<PlanPage />);
    fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));
    const csv = [
      "Name;Datum;Beginn;Ende;Vermerk",
      "Onay Kirmizigül;25.04.2026;18:00;20:30;Sichtung",
    ].join("\n");

    const dialog = await completeHrworksWizardUntilStep3(container, csv, "AEB April Onay.csv");

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
    fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));
    const csv = [
      "Name;Datum;Beginn;Ende;Vermerk",
      "Onay Kirmizigül;11.04.2026;08:00;13:00;Sichtung",
    ].join("\n");

    const dialog = await completeHrworksWizardUntilStep3(container, csv, "AEB April Onay.csv");

    expect(within(dialog).getByText("2026-04-11")).toBeInTheDocument();
    expect(within(dialog).getByText("08:00")).toBeInTheDocument();
    expect(within(dialog).getByText("13:00")).toBeInTheDocument();
    expect(within(dialog).getByText(/XLSX-Datum ist bindend: 2026-04-11/i)).toBeInTheDocument();
    expect(within(dialog).getAllByText("Sichtung / (Team A)").length).toBeGreaterThanOrEqual(2);
    expect(within(dialog).queryByText(/Sichtung \/ \(Team A vs Team B\)/)).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));
    const csv = [
      "Name;Datum;Beginn;Ende;Vermerk",
      "Onay Kirmizigül;25.04.2026;08:00;13:00;Sichtung",
      "Onay Kirmizigül;17.05.2026;18:00;20:30;Sichtung",
    ].join("\n");

    const dialog = await completeHrworksWizardUntilStep3(container, csv, "AEB Mai Onay.csv");

    expect(within(dialog).getByText("2026-05-17")).toBeInTheDocument();
    expect(within(dialog).getByText("18:00")).toBeInTheDocument();
    expect(within(dialog).getByText("20:30")).toBeInTheDocument();
    expect(within(dialog).getByText(/nächstliegender Sichtungstag 2026-05-17/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/XLSX-Datum ist bindend: 2026-05-17/i)).toBeInTheDocument();
    expect(confirmSpy).toHaveBeenCalled();
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

  it("öffnet HRworks und meldet transparent, wenn derselbe Chrome nicht direkt nutzbar ist", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({
        ok: true,
        async json() {
          return { ok: true, status: "started" };
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        async json() {
          return {
            ok: true,
            url: "https://ssl4.hrworks.de/k/dashboard",
            sameBrowser: false,
            warning: "Aktiviere in Chrome einmal chrome://inspect/#remote-debugging.",
          };
        },
      });
    vi.stubGlobal("fetch", fetchMock);
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
            date: "2026-04-10",
            time: "14:00",
            venue: "Sportplatz A",
          },
        ],
      }),
    );

    const { container } = render(<PlanPage />);
    fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));
    const csv = [
      "Name;Datum;Beginn;Ende;Vermerk",
      "Onay Kirmizigül;10.04.2026;08:00;13:00;Sichtung",
    ].join("\n");

    await uploadHrworksTimesheet(container, csv, "AEB April Onay.csv");
    const dialog = await waitFor(() => screen.getByRole("dialog", { name: /HRworks-Import prüfen/i }));

    fireEvent.click(within(dialog).getByRole("button", { name: /HRworks öffnen/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(1, "http://127.0.0.1:8791/health", expect.objectContaining({ method: "GET" }));
      expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/companion/start", expect.objectContaining({ method: "POST" }));
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "http://127.0.0.1:8791/api/companion/capabilities/hrworks-import/open-login",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(within(dialog).getByRole("status")).toHaveTextContent(/ScoutX Companion|chrome:\/\/inspect\/#remote-debugging/i);
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

    const { container } = render(<PlanPage />);
    fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));
    const csv = [
      "Name;Datum;Beginn;Ende;Vermerk",
      "Onay Kirmizigül;10.04.2026;08:00;13:00;Sichtung",
    ].join("\n");

    const dialog = await completeHrworksWizardUntilStep3(container, csv, "AEB April Onay.csv");
    fireEvent.click(within(dialog).getByRole("button", { name: /^HRworks importieren$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8791/api/companion/capabilities/hrworks-import/run", expect.objectContaining({
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

    const { container } = render(<PlanPage />);
    fireEvent.click(screen.getByRole("button", { name: /In HRworks importieren/i }));
    const csv = [
      "Name;Datum;Beginn;Ende;Vermerk",
      "Onay Kirmizigül;10.04.2026;08:00;13:00;Sichtung",
    ].join("\n");

    const dialog = await completeHrworksWizardUntilStep3(container, csv, "AEB April Onay.csv");
    fireEvent.click(within(dialog).getByRole("button", { name: /^HRworks importieren$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
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
