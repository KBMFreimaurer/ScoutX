import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchGamesWithProviders } from "../services/dataProvider";
import { getWeekRange } from "./shared";
import { useSetup } from "./SetupContext";

const GamesContext = createContext(null);

export function GamesProvider({ children }) {
  const navigate = useNavigate();
  const setup = useSetup();
  const {
    kreisId,
    jugendId,
    fromDate,
    dataMode,
    activeTeams,
    uploadedGames,
    adapterEndpoint,
    adapterToken,
    jugend,
    setErr,
    setTeamValidation,
  } = setup;

  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [dataSourceUsed, setDataSourceUsed] = useState("mock");

  const prioritized = useMemo(
    () => [...games].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)).slice(0, 5),
    [games],
  );

  const resetGames = useCallback(() => {
    setGames([]);
    setDataSourceUsed("mock");
  }, []);

  const onBackSetup = useCallback(() => {
    navigate("/setup");
  }, [navigate]);

  const onBuildAndGo = useCallback(async () => {
    if (!kreisId) {
      setErr("Bitte einen Kreis wählen.");
      return;
    }

    if (!jugendId) {
      setErr("Bitte eine Jugendklasse wählen.");
      return;
    }

    setErr("");
    setLoadingGames(true);
    setTeamValidation(null);

    try {
      const weekRange = getWeekRange(fromDate);
      const { games: fetchedGames, source, meta } = await fetchGamesWithProviders({
        mode: dataMode,
        kreisId,
        jugendId,
        fromDate: weekRange.fromDate,
        toDate: weekRange.toDate,
        teams: activeTeams,
        uploadedGames,
        adapterEndpoint,
        adapterToken,
        turnier: Boolean(jugend?.turnier),
      });

      setGames(fetchedGames);
      setDataSourceUsed(source);
      setTeamValidation(meta?.teamFilter || null);
      navigate("/games");
    } catch (error) {
      setErr(`Spieldaten konnten nicht geladen werden: ${error.message}`);
    } finally {
      setLoadingGames(false);
    }
  }, [
    kreisId,
    jugendId,
    fromDate,
    dataMode,
    activeTeams,
    uploadedGames,
    adapterEndpoint,
    adapterToken,
    jugend,
    setErr,
    setTeamValidation,
    navigate,
  ]);

  const value = useMemo(
    () => ({
      games,
      loadingGames,
      dataSourceUsed,
      prioritized,
      setGames,
      setDataSourceUsed,
      resetGames,
      onBackSetup,
      onBuildAndGo,
    }),
    [games, loadingGames, dataSourceUsed, prioritized, resetGames, onBackSetup, onBuildAndGo],
  );

  return <GamesContext.Provider value={value}>{children}</GamesContext.Provider>;
}

export function useGames() {
  const context = useContext(GamesContext);
  if (!context) {
    throw new Error("useGames muss innerhalb von GamesProvider verwendet werden.");
  }
  return context;
}
