import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { STORAGE_KEYS } from "../config/storage";
import { SetupProvider, useSetup } from "./SetupContext";
import { GamesProvider } from "./GamesContext";
import { PlanProvider, usePlan } from "./PlanContext";

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
});
