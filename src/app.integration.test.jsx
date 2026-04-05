import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./app";

describe("ScoutX Integration", () => {
  beforeEach(() => {
    if (typeof window.localStorage?.clear === "function") {
      window.localStorage.clear();
    }
    if (typeof window.sessionStorage?.clear === "function") {
      window.sessionStorage.clear();
    }
    vi.restoreAllMocks();
  });

  it("durchlaeuft Setup -> Games -> Plan mit gemocktem LLM", async () => {
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
                kreisId: "duisburg",
                jugendId: "d-jugend",
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

      if (url.includes("/api/generate")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            response:
              "VALIDIERUNG\nSpiel 1: Duisburger FV 08 vs Tuspo Saarn\nSCOUTING-BEWERTUNG\nTOP 5 Spiele\nROUTENPLAN\n14:00 — Duisburger FV 08 vs Tuspo Saarn | Sportanlage Mitte",
          }),
        };
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/setup"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Kreis Duisburg auswählen/i }));
    fireEvent.click(screen.getByRole("button", { name: /D-Jugend auswählen/i }));
    fireEvent.click(screen.getByRole("button", { name: /Spielplan generieren/i }));

    await screen.findByText(/Top-Empfehlungen/i);
    await screen.findByRole("button", { name: /Scout-Plan erstellen/i });
    fireEvent.click(screen.getByRole("button", { name: /Scout-Plan erstellen/i }));

    await screen.findByText(/VALIDIERUNG/i);

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/games"))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/generate"))).toBe(true);
  });
});
