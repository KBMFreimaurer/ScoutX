import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./app";
import { STORAGE_KEYS } from "./config/storage";
import { openScoutPdf } from "./services/pdf";

vi.mock("./services/pdf", () => ({
  openScoutPdf: vi.fn(),
}));

describe("ScoutX Integration", () => {
  async function renderSetupAndSubmit(fetchMock, options = {}) {
    const kreisIndices =
      Array.isArray(options?.kreisIndices) && options.kreisIndices.length > 0 ? options.kreisIndices : [0];
    const jugendIndices =
      Array.isArray(options?.jugendIndices) && options.jugendIndices.length > 0 ? options.jugendIndices : [0];
    const leagueParameters = Array.isArray(options?.leagueParameters) ? options.leagueParameters.filter(Boolean) : [];
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter
        initialEntries={["/setup"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Scouting-Plan konfigurieren/i }, { timeout: 5000 });

    fireEvent.click(await screen.findByRole("button", { name: /Bundesland Nordrhein-Westfalen auswählen/i }, { timeout: 5000 }));
    fireEvent.click(screen.getByRole("button", { name: /Weiter zum nächsten Schritt/i }));

    const kreisButtons = await screen.findAllByRole("button", { name: /Region\/Kreis .* auswählen/i }, { timeout: 5000 });
    kreisIndices.forEach((index) => {
      const button = kreisButtons[index] || kreisButtons[0];
      fireEvent.click(button);
    });
    fireEvent.click(screen.getByRole("button", { name: /Weiter zum nächsten Schritt/i }));

    const jugendButtons = await screen.findAllByRole("button", { name: /Jugend auswählen/i }, { timeout: 5000 });
    let clickedJugend = 0;
    jugendIndices.forEach((index) => {
      const button = jugendButtons[index];
      if (!button) {
        return;
      }
      fireEvent.click(button);
      clickedJugend += 1;
    });
    if (clickedJugend === 0 && jugendButtons[0]) {
      fireEvent.click(jugendButtons[0]);
    }

    for (const league of leagueParameters) {
      fireEvent.change(screen.getByLabelText(/Liga-Parameter hinzufügen/i), { target: { value: league } });
      fireEvent.click(screen.getByRole("button", { name: /Liga hinzufügen/i }));
    }

    fireEvent.click(screen.getByRole("button", { name: /Weiter zum nächsten Schritt/i }));
    fireEvent.click(screen.getByRole("button", { name: /Weiter zum nächsten Schritt/i }));
    fireEvent.click(screen.getByRole("button", { name: /Weiter zum nächsten Schritt/i }));
    fireEvent.change(screen.getByLabelText(/Scout-Name \(für Abrechnung\)/i), { target: { value: "Ayoub Kerbab" } });
    fireEvent.click(screen.getByRole("button", { name: /Weiter zum nächsten Schritt/i }));

    const generateButton = await screen.findByRole("button", { name: /Spielplan generieren/i }, { timeout: 5000 });
    fireEvent.click(generateButton);
  }

  beforeEach(() => {
    if (typeof window.localStorage?.clear === "function") {
      window.localStorage.clear();
    }
    if (typeof window.sessionStorage?.clear === "function") {
      window.sessionStorage.clear();
    }
    window.localStorage.setItem("scoutx.test.authenticated", "true");
    vi.restoreAllMocks();
  });

  it("startet auf der Scouting-Cockpit-Ansicht", async () => {
    render(
      <MemoryRouter
        initialEntries={["/"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Scouting-Cockpit/i }, { timeout: 5000 });
    expect(screen.getByLabelText(/Aktive Rolle/i)).toBeInTheDocument();
  });

  it("zeigt veröffentlichte Team-Planung im Cockpit-Feed", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.productDomain,
      JSON.stringify({
        version: 2,
        activeUserId: "user-scout",
        users: [
          { id: "user-scout", name: "Scout", role: "scout", teamId: "team-scoutx", active: true },
          { id: "user-coordinator", name: "Koordination", role: "coordinator", teamId: "team-scoutx", active: true },
        ],
        team: {
          id: "team-scoutx",
          name: "ScoutX Team",
          accounts: [
            { id: "user-scout", name: "Scout", role: "scout", active: true },
            { id: "user-coordinator", name: "Koordination", role: "coordinator", active: true },
          ],
        },
        reports: [],
        watchlists: [],
        assignments: [],
        notifications: [],
        savedFilters: [],
        observations: [
          {
            id: "obs-1",
            gameId: "game-1",
            scoutId: "user-coordinator",
            status: "planned",
            planHistoryId: "plan-1",
            note: "",
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
          },
        ],
        feedItems: [
          {
            id: "feed-1",
            type: "plan_published",
            actorId: "user-coordinator",
            title: "Koordination hat 1 Spiel in seinen Plan genommen",
            body: "Team A vs Team B",
            gameIds: ["game-1"],
            planHistoryId: "plan-1",
            createdAt: "2026-04-23T10:00:00.000Z",
          },
        ],
      }),
    );

    render(
      <MemoryRouter
        initialEntries={["/hub"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Scouting-Cockpit/i }, { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "Feed" }));

    expect(await screen.findByText(/Koordination hat 1 Spiel in seinen Plan genommen/i)).toBeInTheDocument();
    expect(screen.getByText(/Team A vs Team B/i)).toBeInTheDocument();
  });

  it("legt aus einer gesehenen Sichtung einen verknüpften Spielbericht an", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.productDomain,
      JSON.stringify({
        version: 2,
        activeUserId: "user-scout",
        users: [{ id: "user-scout", name: "Scout", role: "scout", teamId: "team-scoutx", active: true }],
        team: {
          id: "team-scoutx",
          name: "ScoutX Team",
          accounts: [{ id: "user-scout", name: "Scout", role: "scout", active: true }],
        },
        reports: [],
        watchlists: [],
        assignments: [],
        notifications: [],
        savedFilters: [],
        observations: [
          {
            id: "obs-game-1-user-scout",
            gameId: "game-1",
            scoutId: "user-scout",
            status: "seen",
            planHistoryId: "plan-1",
            note: "",
            game: { id: "game-1", home: "Team A", away: "Team B" },
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
            seenAt: "2026-04-23T10:00:00.000Z",
          },
        ],
        feedItems: [],
      }),
    );

    render(
      <MemoryRouter
        initialEntries={["/hub"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Scouting-Cockpit/i }, { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
    fireEvent.click(await screen.findByRole("button", { name: /Spielbericht anlegen/i }));

    expect(await screen.findAllByText("Spielbericht: Team A vs Team B")).not.toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
    expect(screen.getByText(/Spielbericht verknuepft/i)).toBeInTheDocument();
  });

  it("ergänzt eine Notiz an einer gesehenen Sichtung", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.productDomain,
      JSON.stringify({
        version: 2,
        activeUserId: "user-scout",
        users: [{ id: "user-scout", name: "Scout", role: "scout", teamId: "team-scoutx", active: true }],
        team: {
          id: "team-scoutx",
          name: "ScoutX Team",
          accounts: [{ id: "user-scout", name: "Scout", role: "scout", active: true }],
        },
        reports: [],
        watchlists: [],
        assignments: [],
        notifications: [],
        savedFilters: [],
        observations: [
          {
            id: "obs-game-1-user-scout",
            gameId: "game-1",
            scoutId: "user-scout",
            status: "seen",
            planHistoryId: "plan-1",
            note: "",
            game: { id: "game-1", home: "Team A", away: "Team B" },
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
            seenAt: "2026-04-23T10:00:00.000Z",
          },
        ],
        feedItems: [],
      }),
    );

    render(
      <MemoryRouter
        initialEntries={["/hub"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Scouting-Cockpit/i }, { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
    fireEvent.change(await screen.findByRole("textbox", { name: /Notiz zur Sichtung Team A vs Team B/i }), {
      target: { value: "Nr. 10 mit Linksfuß-Aktionen prüfen." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Notiz speichern/i }));

    expect(await screen.findByText(/Sichtungsnotiz ergänzt/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Nr\. 10 mit Linksfuß-Aktionen prüfen\./i).length).toBeGreaterThan(0);
  });

  it("führt aus einer gesehenen Sichtung in Spieler-Highlight und Follow-up", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.productDomain,
      JSON.stringify({
        version: 2,
        activeUserId: "user-scout",
        users: [{ id: "user-scout", name: "Scout", role: "scout", teamId: "team-scoutx", active: true }],
        team: {
          id: "team-scoutx",
          name: "ScoutX Team",
          accounts: [{ id: "user-scout", name: "Scout", role: "scout", active: true }],
        },
        reports: [],
        watchlists: [],
        assignments: [],
        notifications: [],
        savedFilters: [],
        observations: [
          {
            id: "obs-game-1-user-scout",
            gameId: "game-1",
            scoutId: "user-scout",
            status: "seen",
            planHistoryId: "plan-1",
            note: "",
            game: { id: "game-1", home: "Team A", away: "Team B" },
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:00:00.000Z",
            seenAt: "2026-04-23T10:00:00.000Z",
          },
        ],
        feedItems: [],
      }),
    );

    render(
      <MemoryRouter
        initialEntries={["/hub"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Scouting-Cockpit/i }, { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
    fireEvent.click(await screen.findByRole("button", { name: /Follow-up/i }));
    fireEvent.click(screen.getByRole("button", { name: "Planung" }));
    expect((await screen.findAllByText(/Follow-up: Team A vs Team B/i)).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
    fireEvent.click(await screen.findByRole("button", { name: /Spieler highlighten/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Anlegen" }));
    expect((await screen.findAllByText("Live-Sichtungen")).length).toBeGreaterThan(0);
    fireEvent.change(await screen.findByPlaceholderText("Spielername"), {
      target: { value: "Max Muster" },
    });
    const addPlayerButton = screen.getByRole("button", { name: /Spieler hinzufügen/i });
    await waitFor(() => expect(addPlayerButton).not.toBeDisabled());
    fireEvent.click(addPlayerButton);

    expect((await screen.findAllByText(/Max Muster/i)).length).toBeGreaterThan(0);
  });

  it("legt ein manuelles Spiel im Team-Feed an", async () => {
    render(
      <MemoryRouter
        initialEntries={["/hub"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Scouting-Cockpit/i }, { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
    fireEvent.change(screen.getByPlaceholderText("Heimteam manuell"), {
      target: { value: "Inoffizielles Team A" },
    });
    fireEvent.change(screen.getByPlaceholderText("Auswärtsteam"), {
      target: { value: "Inoffizielles Team B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Manuelles Spiel anlegen/i }));

    expect(await screen.findByText(/Manuelles Spiel angelegt/i)).toBeInTheDocument();
    expect(screen.getByText(/Inoffizielles Team A vs Inoffizielles Team B/i)).toBeInTheDocument();
  });

  it(
    "durchläuft Setup -> Games -> Plan mit schnellem PDF-Flow",
    async () => {
      const fetchMock = vi.fn(async (input, init) => {
        const url = String(input);

        if (url.includes("/api/games")) {
          const payload = JSON.parse(String(init?.body || "{}"));
          const requestedDate = String(payload.fromDate || "2026-04-01");

          return {
            ok: true,
            status: 200,
            json: async () => ({
              games: [
                {
                  date: requestedDate,
                  time: "14:00",
                  home: "Duisburger FV 08",
                  away: "Tuspo Saarn",
                  venue: "Sportanlage Mitte",
                  km: 8,
                  kreisId: String(payload.kreisId || "duisburg"),
                  jugendId: String(payload.jugendId || "d-jugend"),
                  priority: 4,
                },
              ],
              teamFilter: {
                requested: false,
                requestedCount: 0,
                matchedCount: 0,
                matchedTeamCount: 0,
                matchedTeams: [],
                missingTeams: [],
                binding: false,
                fallbackToUnfiltered: false,
              },
            }),
          };
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      await renderSetupAndSubmit(fetchMock);

      await screen.findByRole("button", { name: /Plan öffnen/i }, { timeout: 12000 });
      fireEvent.click(screen.getByRole("button", { name: /Plan öffnen/i }));

      await screen.findByText(/Manueller Scouting-Plan/i, { timeout: 12000 });
      await screen.findByText(/alle verfügbaren Spiele übernommen/i, { timeout: 12000 });

      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/games"))).toBe(true);
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/generate"))).toBe(false);
      expect(openScoutPdf).not.toHaveBeenCalled();
      fireEvent.click(screen.getAllByRole("button", { name: /Schritt Cockpit/i })[0]);
      await screen.findByRole("heading", { name: /Scouting-Cockpit/i }, { timeout: 5000 });
      fireEvent.click(screen.getByRole("button", { name: "Feed" }));
      expect(await screen.findByText(/Scout hat 1 Spiel in seinen Plan genommen/i)).toBeInTheDocument();
    },
    15000,
  );

  it("uebergibt Liga-Parameter an den Adapter und zeigt nur passende Ligaspiele im Plan", async () => {
    const fetchMock = vi.fn(async (input, init) => {
      const url = String(input);

      if (url.includes("/api/games")) {
        const payload = JSON.parse(String(init?.body || "{}"));
        const requestedDate = String(payload.fromDate || "2026-04-01");

        return {
          ok: true,
          status: 200,
          json: async () => ({
            games: [
              {
                date: requestedDate,
                time: "11:00",
                home: "Team LK A",
                away: "Team LK B",
                venue: "Sportanlage Nord",
                km: 8,
                kreisId: String(payload.kreisId || "duisburg"),
                jugendId: String(payload.jugendId || "d-jugend"),
                priority: 4,
                staffelName: "D-Junioren Kreisleistungsklasse",
              },
              {
                date: requestedDate,
                time: "15:00",
                home: "Team KK A",
                away: "Team KK B",
                venue: "Sportanlage Sued",
                km: 12,
                kreisId: String(payload.kreisId || "duisburg"),
                jugendId: String(payload.jugendId || "d-jugend"),
                priority: 3,
                staffelName: "D-Junioren Kreisklasse",
              },
            ],
            teamFilter: {
              requested: true,
              requestedCount: 1,
              matchedCount: 1,
              matchedTeamCount: 1,
              matchedTeams: ["Leistungsklasse"],
              missingTeams: [],
              binding: true,
              fallbackToUnfiltered: false,
            },
          }),
        };
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    await renderSetupAndSubmit(fetchMock, { leagueParameters: ["Leistungsklasse"] });
    await screen.findByRole("button", { name: /Plan öffnen/i }, { timeout: 12000 });

    const adapterCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/games"));
    expect(adapterCalls).toHaveLength(1);
    expect(JSON.parse(String(adapterCalls[0][1]?.body || "{}"))).toMatchObject({
      teams: [],
      leagues: ["Leistungsklasse"],
    });

    expect(screen.getAllByText(/Team LK A/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Team KK A/i)).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Plan öffnen/i }));

    await screen.findByText(/Manueller Scouting-Plan/i, { timeout: 12000 });
    expect(screen.getAllByText(/Team LK A/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Team KK A/i)).toHaveLength(0);
  });

  it("stellt persistierte Spielauswahl in Games nach Reload wieder her", async () => {
    const persistedSelectionId = "csv-0-Duis-Tusp";

    window.sessionStorage.setItem(
      STORAGE_KEYS.selectedGames,
      JSON.stringify({ [persistedSelectionId]: true }),
    );
    expect(window.sessionStorage.getItem(STORAGE_KEYS.selectedGames)).toContain(persistedSelectionId);

    const fetchMock = vi.fn(async (input, init) => {
      const url = String(input);

      if (url.includes("/api/games")) {
        const payload = JSON.parse(String(init?.body || "{}"));
        const requestedDate = String(payload.fromDate || "2026-04-01");

        return {
          ok: true,
          status: 200,
          json: async () => ({
            games: [
              {
                date: requestedDate,
                time: "14:00",
                home: "Duisburger FV 08",
                away: "Tuspo Saarn",
                venue: "Sportanlage Mitte",
                km: 8,
                kreisId: String(payload.kreisId || "duisburg"),
                jugendId: String(payload.jugendId || "d-jugend"),
                priority: 4,
              },
            ],
            teamFilter: {
              requested: false,
              requestedCount: 0,
              matchedCount: 0,
              matchedTeamCount: 0,
              matchedTeams: [],
              missingTeams: [],
              binding: false,
              fallbackToUnfiltered: false,
            },
          }),
        };
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    await renderSetupAndSubmit(fetchMock);

    expect(window.sessionStorage.getItem(STORAGE_KEYS.selectedGames)).toContain(persistedSelectionId);

    const checkbox = await screen.findByRole("checkbox", {
      name: /Spiel auswählen: Duisburger FV 08 gegen Tuspo Saarn/i,
    });
    expect(checkbox).toBeChecked();
  });

  it("zeigt Adapter-Timeout im Setup als Fehlermeldung", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    const fetchMock = vi.fn().mockRejectedValue(abortError);

    await renderSetupAndSubmit(fetchMock);

    const matches = await screen.findAllByText(/Spieldaten konnten nicht geladen werden: Adapter Timeout nach \d+ms/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it.each([
    {
      label: "401",
      fetchMockFactory: () =>
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: async () => ({}),
        }),
      expectedText: "Adapter HTTP 401",
    },
    {
      label: "500",
      fetchMockFactory: () =>
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({}),
        }),
      expectedText: "Adapter HTTP 500",
    },
    {
      label: "leere Antwort",
      fetchMockFactory: () =>
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ games: [] }),
        }),
      expectedText: "Für diese Region wurden keine Spiele gefunden",
    },
    {
      label: "malformed JSON",
      fetchMockFactory: () =>
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error("Unexpected token < in JSON");
          },
        }),
      expectedText: "Unexpected token < in JSON",
    },
  ])("zeigt Fehlerfall korrekt: $label", async ({ fetchMockFactory, expectedText }) => {
    const fetchMock = fetchMockFactory();
    await renderSetupAndSubmit(fetchMock);
    const matches = await screen.findAllByText((_, element) =>
      String(element?.textContent || "").includes(`Spieldaten konnten nicht geladen werden: ${expectedText}`),
    );
    expect(matches.length).toBeGreaterThan(0);
  });

  it("lädt historischen Plan nach Reload und erlaubt erneuten PDF-Export", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      }),
    );

    window.localStorage.setItem(
      STORAGE_KEYS.planHistory,
      JSON.stringify([
        {
          id: "hist-1",
          createdAt: "2026-04-13T16:00:00.000Z",
          planText: "Historischer Plantext",
          games: [],
          selectedGameIds: [],
          meta: {
            kreisLabel: "Duisburg",
            jugendLabel: "D-Jugend",
            fromDate: "2026-04-19",
            toDate: "2026-04-19",
            startLocationLabel: "47058 Duisburg",
          },
          syncContext: {
            source: "adapter",
          },
          presenceByGame: {},
        },
      ]),
    );

    render(
      <MemoryRouter
        initialEntries={["/setup"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Scouting-Plan konfigurieren/i }, { timeout: 5000 });

    const planStepButtons = screen.getAllByRole("button", { name: /Schritt Plan/i });
    fireEvent.click(planStepButtons[0]);
    await screen.findByText(/Plan-Historie/i, { timeout: 5000 });

    fireEvent.click(screen.getByRole("button", { name: /Historischen Plan .* öffnen/i }));
    await screen.findByText(/Historischer Plantext/i, { timeout: 5000 });
    expect(screen.getByText(/Keine Spiele verfügbar/i)).toBeInTheDocument();
  });

  it("fragt bei Mehrfach-Kreis-Auswahl alle Kreise beim Adapter ab", async () => {
    const fetchMock = vi.fn(async (input, init) => {
      const url = String(input);

      if (url.includes("/api/games")) {
        const payload = JSON.parse(String(init?.body || "{}"));
        const requestedDate = String(payload.fromDate || "2026-04-01");
        const requestedKreisId = String(payload.kreisId || "duisburg");

        return {
          ok: true,
          status: 200,
          json: async () => ({
            games: [
              {
                date: requestedDate,
                time: "14:00",
                home: `Team ${requestedKreisId} A`,
                away: `Team ${requestedKreisId} B`,
                venue: "Sportanlage Mitte",
                km: 8,
                kreisId: requestedKreisId,
                jugendId: String(payload.jugendId || "d-jugend"),
                priority: 4,
              },
            ],
            teamFilter: {
              requested: false,
              requestedCount: 0,
              matchedCount: 0,
              matchedTeamCount: 0,
              matchedTeams: [],
              missingTeams: [],
              binding: false,
              fallbackToUnfiltered: false,
            },
          }),
        };
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    await renderSetupAndSubmit(fetchMock, { kreisIndices: [0, 1] });
    await screen.findByRole("button", { name: /Plan öffnen/i }, { timeout: 12000 });

    const adapterCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/games"));
    const requestedKreise = adapterCalls
      .map(([, init]) => JSON.parse(String(init?.body || "{}")).kreisId)
      .filter(Boolean)
      .sort();

    expect(adapterCalls).toHaveLength(2);
    expect(requestedKreise).toEqual(["duesseldorf", "duisburg"]);
  });

});
