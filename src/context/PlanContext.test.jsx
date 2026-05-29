import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { STORAGE_KEYS } from "../config/storage";
import { SetupProvider, useSetup } from "./SetupContext";
import { GamesProvider } from "./GamesContext";
import { PlanProvider, usePlan } from "./PlanContext";
import { useGames } from "./GamesContext";

function createWrapper() {
  return function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={["/plan"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SetupProvider defaultAdapterEndpoint="/api/games">
          <GamesProvider>
            <PlanProvider>{children}</PlanProvider>
          </GamesProvider>
        </SetupProvider>
      </MemoryRouter>
    );
  };
}

describe("PlanContext history restore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores the stored start location object when reopening a historical plan", async () => {
    window.localStorage.setItem(STORAGE_KEYS.planHistory, JSON.stringify([
      {
        id: "hist-1",
        createdAt: "2026-05-22T14:00:00.000Z",
        planText: "Plan",
        games: [],
        selectedGameIds: [],
        meta: {
          startLocation: {
            label: "Sternbuschweg 326",
            lat: 51.4301,
            lon: 6.7777,
          },
          startLocationLabel: "Sternbuschweg 326",
        },
      },
    ]));

    const { result } = renderHook(
      () => ({
        plan: usePlan(),
        setup: useSetup(),
      }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.plan.onOpenPlanHistory("hist-1");
    });

    await waitFor(() => {
      expect(result.current.setup.startLocation).toMatchObject({
        label: "Sternbuschweg 326",
        lat: 51.4301,
        lon: 6.7777,
      });
    });
  });

  it("falls back to the historical start location label for legacy entries", async () => {
    window.localStorage.setItem(STORAGE_KEYS.planHistory, JSON.stringify([
      {
        id: "hist-legacy",
        createdAt: "2026-05-22T14:00:00.000Z",
        planText: "Plan",
        games: [],
        selectedGameIds: [],
        meta: {
          startLocationLabel: "Sternbuschweg 326",
        },
      },
    ]));

    const { result } = renderHook(
      () => ({
        plan: usePlan(),
        setup: useSetup(),
      }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.plan.onOpenPlanHistory("hist-legacy");
    });

    await waitFor(() => {
      expect(result.current.setup.startLocation).toMatchObject({
        label: "Sternbuschweg 326",
      });
    });
  });

  it("geocodes a legacy historical start location label so route legs can use coordinates", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [
          {
            formatted_address: "Sternbuschweg 326, 47057 Duisburg, Deutschland",
            geometry: {
              location: {
                lat: 51.4301,
                lng: 6.7777,
              },
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.setItem(STORAGE_KEYS.planHistory, JSON.stringify([
      {
        id: "hist-legacy-geocode",
        createdAt: "2026-05-22T14:00:00.000Z",
        planText: "Plan",
        games: [],
        selectedGameIds: [],
        meta: {
          startLocationLabel: "Sternbuschweg 326",
        },
      },
    ]));

    const { result } = renderHook(
      () => ({
        plan: usePlan(),
        setup: useSetup(),
      }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.plan.onOpenPlanHistory("hist-legacy-geocode");
    });

    await waitFor(() => {
      expect(result.current.setup.startLocation).toMatchObject({
        label: "Sternbuschweg 326, 47057 Duisburg, Deutschland",
        lat: 51.4301,
        lon: 6.7777,
      });
    });
  });

  it("deklariert im generierten Plan fuer jedes Spiel die Liga", async () => {
    const { result } = renderHook(
      () => ({
        plan: usePlan(),
        games: useGames(),
        setup: useSetup(),
      }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.games.setGames([
        {
          id: "game-1",
          home: "Team A",
          away: "Team B",
          venue: "Sportpark",
          time: "11:00",
          dateObj: new Date("2026-05-23T00:00:00.000Z"),
          league: "D-Junioren Kreisleistungsklasse",
        },
        {
          id: "game-2",
          home: "Team C",
          away: "Team D",
          venue: "Nebenplatz",
          time: "13:00",
          dateObj: new Date("2026-05-23T00:00:00.000Z"),
          competitionName: "D-Junioren Niederrheinliga",
        },
      ]);
    });

    await act(async () => {
      await result.current.plan.onGeneratePlanPdf();
    });

    await waitFor(() => {
      expect(result.current.plan.plan).toContain("Liga/Wettbewerb: D-Junioren Kreisleistungsklasse");
      expect(result.current.plan.plan).toContain("Liga/Wettbewerb: D-Junioren Niederrheinliga");
    });
  });

  it("deklariert Turniere und DFB-Spiele im generierten Plan mit Typ und Quelle", async () => {
    const { result } = renderHook(
      () => ({
        plan: usePlan(),
        games: useGames(),
        setup: useSetup(),
      }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      result.current.games.setGames([
        {
          id: "turnier-1",
          home: "Pfingstcup U12",
          away: "Turnier",
          venue: "Sportpark",
          time: "--:--",
          dateObj: new Date("2026-05-23T00:00:00.000Z"),
          source: "tournament",
          provider: "meinturnierplan.de",
          turnier: true,
          competitionName: "Pfingstcup U12",
        },
        {
          id: "dfb-1",
          home: "Deutschland U21",
          away: "Frankreich U21",
          venue: "Aachen",
          time: "18:00",
          dateObj: new Date("2026-05-24T00:00:00.000Z"),
          source: "national",
          provider: "dfb.de",
          ageGroup: "U21",
          competitionName: "DFB U21-Länderspiel",
        },
      ]);
    });

    await act(async () => {
      await result.current.plan.onGeneratePlanPdf();
    });

    await waitFor(() => {
      expect(result.current.plan.plan).toContain("Spieltypen: Turniere 1 · DFB-Spiele 1");
      expect(result.current.plan.plan).toContain("Typ/Quelle: Turnier · meinturnierplan.de");
      expect(result.current.plan.plan).toContain("Typ/Quelle: DFB U21 · dfb.de");
    });
  });
});
