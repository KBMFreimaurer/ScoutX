import { fireEvent, render, screen } from "@testing-library/react";
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
    fireEvent.click(jugendButtons[0]);

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
    },
    15000,
  );

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

    fireEvent.click(screen.getByRole("button", { name: /Schritt Plan/i }));
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
