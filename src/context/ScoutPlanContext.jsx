import { createContext, useContext } from "react";

const ScoutPlanContext = createContext(null);

export function ScoutPlanProvider({ value, children }) {
  return <ScoutPlanContext.Provider value={value}>{children}</ScoutPlanContext.Provider>;
}

export function useScoutPlan() {
  const context = useContext(ScoutPlanContext);
  if (!context) {
    throw new Error("useScoutPlan muss innerhalb von ScoutPlanProvider verwendet werden.");
  }
  return context;
}
