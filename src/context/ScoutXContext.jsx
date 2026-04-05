import { createContext, useContext } from "react";

const ScoutXContext = createContext(null);

export function ScoutXProvider({ value, children }) {
  return <ScoutXContext.Provider value={value}>{children}</ScoutXContext.Provider>;
}

export function useScoutX() {
  const context = useContext(ScoutXContext);
  if (!context) {
    throw new Error("useScoutX muss innerhalb von ScoutXProvider verwendet werden.");
  }
  return context;
}
