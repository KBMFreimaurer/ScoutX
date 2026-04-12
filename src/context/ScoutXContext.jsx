import { useMemo } from "react";
import { useGames } from "./GamesContext";
import { usePlan } from "./PlanContext";
import { useSetup } from "./SetupContext";
import { useTimes } from "./TimeContext";

export function ScoutXProvider({ children }) {
  return children;
}

export function useScoutX() {
  const setup = useSetup();
  const games = useGames();
  const plan = usePlan();
  const times = useTimes();

  return useMemo(() => ({ ...setup, ...games, ...plan, ...times }), [setup, games, plan, times]);
}

export { useSetup, useGames, usePlan, useTimes };
