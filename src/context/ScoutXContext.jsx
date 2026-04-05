import { useMemo } from "react";
import { useGames } from "./GamesContext";
import { usePlan } from "./PlanContext";
import { useSetup } from "./SetupContext";

export function ScoutXProvider({ children }) {
  return children;
}

export function useScoutX() {
  const setup = useSetup();
  const games = useGames();
  const plan = usePlan();

  return useMemo(() => ({ ...setup, ...games, ...plan }), [setup, games, plan]);
}

export { useSetup, useGames, usePlan };
