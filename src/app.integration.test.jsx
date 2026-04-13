import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./app";
import { openScoutPdf } from "./services/pdf";

vi.mock("./services/pdf", () => ({
  openScoutPdf: vi.fn(),
}));

describe("ScoutX Integration", () => {
  async function renderSetupAndSubmit(fetchMock) {
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

    const kreisButtons = await screen.findAllByRole("button", { name: /Kreis .* auswählen/i }, { timeout: 5000 });
    fireEvent.click(kreisButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: /Weiter zum nächsten Schritt/i }));

    const jugendButtons = await screen.findAllByRole("button", { name: /Jugend auswählen/i }, { timeout: 5000 });
    fireEvent.click(jugendButtons[0]);

    fireEvent.click(screen.getByRole("button", { name: /Weiter zum nächsten Schritt/i }));
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

  it(
    "durchlaeuft Setup -> Games -> Plan mit schnellem PDF-Flow",
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

  it("zeigt Adapter-Timeout im Setup als Fehlermeldung", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    const fetchMock = vi.fn().mockRejectedValue(abortError);

    await renderSetupAndSubmit(fetchMock);

    const matches = await screen.findAllByText(/Spieldaten konnten nicht geladen werden: Adapter Timeout nach 15000ms/i);
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
      expectedText: "Adapter lieferte keine Spiele",
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
});
