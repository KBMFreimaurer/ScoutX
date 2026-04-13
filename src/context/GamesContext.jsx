import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { STORAGE_KEYS } from "../config/storage";
import { fetchGamesWithProviders } from "../services/dataProvider";
import { fetchDrivingRoute, geocodeAddress, hasRoutableVenueAddress, haversineDistance, isGoogleRoutingStrictMode } from "../utils/geo";
import { useSetup } from "./SetupContext";

const GamesContext = createContext(null);

function toIsoDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
    const [day, month, year] = text.split(".").map(Number);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function normalizeLookup(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function matchesFavorite(game, favoriteTeams) {
  const home = normalizeLookup(game?.home);
  const away = normalizeLookup(game?.away);
  const venue = normalizeLookup(game?.venue);

  return favoriteTeams.some((favorite) => {
    const token = normalizeLookup(favorite);
    return token && (home.includes(token) || away.includes(token) || venue.includes(token));
  });
}

function withFavoriteBoost(games, favorites) {
  const favoriteTeams = Array.isArray(favorites) ? favorites.filter(Boolean) : [];
  if (!favoriteTeams.length) {
    return games;
  }

  return games.map((game) => {
    const favoriteMatch = matchesFavorite(game, favoriteTeams);
    if (!favoriteMatch) {
      return { ...game, isFavoriteGame: false };
    }

    return {
      ...game,
      isFavoriteGame: true,
      priority: Number(game.priority || 0) + 2,
    };
  });
}

function withNotes(games, notesById) {
  return games.map((game) => ({
    ...game,
    note: notesById?.[game.id] || "",
  }));
}

function ensureGameIds(games) {
  const safeGames = Array.isArray(games) ? games : [];
  const usedIds = new Set();

  return safeGames.map((game, index) => {
    const rawExistingId = String(game?.id ?? "").trim();
    const home = normalizeLookup(game?.home || `home-${index}`).replace(/\s+/g, "-");
    const away = normalizeLookup(game?.away || `away-${index}`).replace(/\s+/g, "-");
    const datePart = toIsoDate(game?.date) || toIsoDate(game?.dateObj) || "na";
    const timePart = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(game?.time || "").trim())
      ? String(game.time).replace(":", "")
      : "na";
    const venuePart = normalizeLookup(game?.venue || "").replace(/\s+/g, "-") || "venue";
    const fallbackBaseId = `game-${home}-${away}-${datePart}-${timePart}-${index}`;

    let nextId = rawExistingId || fallbackBaseId;
    nextId = nextId.replace(/\s+/g, "-");

    if (usedIds.has(nextId)) {
      const deterministicSuffix = `${home}-${away}-${datePart}-${timePart}-${venuePart}`;
      let uniqueCandidate = `${nextId}::${deterministicSuffix}`;
      let collisionIndex = 2;

      while (usedIds.has(uniqueCandidate)) {
        uniqueCandidate = `${nextId}::${deterministicSuffix}-${collisionIndex}`;
        collisionIndex += 1;
      }

      nextId = uniqueCandidate;
    }

    usedIds.add(nextId);

    return {
      ...game,
      id: nextId,
    };
  });
}

function estimateMinutesFromDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) {
    return null;
  }
  return Math.max(1, Math.round((distanceKm / 50) * 60));
}

function toDateTimeSortValue(game) {
  const dateMs = game?.dateObj instanceof Date ? game.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
  const timeText = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(game?.time || "").trim()) ? String(game.time) : "99:99";
  return `${String(dateMs).padStart(16, "0")}|${timeText}`;
}

async function applyExactStartRoute(games, startLocation) {
  const hasLocation = Number.isFinite(startLocation?.lat) && Number.isFinite(startLocation?.lon);
  if (!hasLocation || !Array.isArray(games) || games.length === 0) {
    return games;
  }

  const sortedByDateTime = games
    .map((game, index) => ({ game, index }))
    .sort((left, right) => toDateTimeSortValue(left.game).localeCompare(toDateTimeSortValue(right.game)));

  const firstGame = sortedByDateTime[0] || null;
  if (!firstGame) {
    return games;
  }

  if (!Number.isFinite(firstGame.game?.venueLat) || !Number.isFinite(firstGame.game?.venueLon)) {
    return games;
  }

  const fromPoint = { lat: startLocation.lat, lon: startLocation.lon };
  const toPoint = { lat: firstGame.game.venueLat, lon: firstGame.game.venueLon };
  const route = await fetchDrivingRoute(fromPoint, toPoint).catch(() => null);

  const exactDistanceKm = Number(route?.distanceKm);
  if (!Number.isFinite(exactDistanceKm)) {
    return games;
  }

  const exactMinutes = Number(route?.durationMinutes);

  return games.map((game, index) => {
    if (index !== firstGame.index) {
      return game;
    }

    return {
      ...game,
      distanceKm: exactDistanceKm,
      distanceSource: "route",
      fromStartRouteDistanceKm: exactDistanceKm,
      fromStartRouteMinutes: Number.isFinite(exactMinutes) ? Math.max(1, Math.round(exactMinutes)) : estimateMinutesFromDistance(exactDistanceKm),
    };
  });
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const safeItems = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Number(concurrency) || 1);
  const results = new Array(safeItems.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < safeItems.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(safeItems[index], index);
    }
  };

  const workers = Array.from({ length: Math.min(limit, safeItems.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

async function enrichGames(games, startLocation) {
  const hasLocation = Number.isFinite(startLocation?.lat) && Number.isFinite(startLocation?.lon);
  const strictGoogleRouting = hasLocation && isGoogleRoutingStrictMode();

  const enrichedGames = await mapWithConcurrency(games, 5, async (game) => {
    try {
      const geo = hasRoutableVenueAddress(game)
        ? await geocodeAddress(game.venue || "").catch(() => null)
        : null;
      const venueLat = Number(geo?.lat);
      const venueLon = Number(geo?.lon);

      let distanceKm = null;
      let distanceSource = null;
      let fromStartRouteDistanceKm = null;
      let fromStartRouteMinutes = null;

      if (hasLocation && Number.isFinite(venueLat) && Number.isFinite(venueLon)) {
        if (strictGoogleRouting) {
          const route = await fetchDrivingRoute(
            { lat: startLocation.lat, lon: startLocation.lon },
            { lat: venueLat, lon: venueLon },
          ).catch(() => null);
          const routeDistanceKm = Number(route?.distanceKm);
          const routeMinutes = Number(route?.durationMinutes);

          if (Number.isFinite(routeDistanceKm)) {
            distanceKm = routeDistanceKm;
            distanceSource = "route";
            fromStartRouteDistanceKm = routeDistanceKm;
            fromStartRouteMinutes = Number.isFinite(routeMinutes) ? Math.max(1, Math.round(routeMinutes)) : estimateMinutesFromDistance(routeDistanceKm);
          }
        } else {
          distanceKm = haversineDistance(startLocation.lat, startLocation.lon, venueLat, venueLon);
          distanceSource = Number.isFinite(distanceKm) ? "haversine" : null;
        }
      }

      return {
        ...game,
        venueLat: Number.isFinite(venueLat) ? venueLat : null,
        venueLon: Number.isFinite(venueLon) ? venueLon : null,
        distanceKm,
        distanceSource,
        fromStartRouteDistanceKm,
        fromStartRouteMinutes,
      };
    } catch {
      return {
        ...game,
        venueLat: null,
        venueLon: null,
        distanceKm: null,
        distanceSource: null,
        fromStartRouteDistanceKm: null,
        fromStartRouteMinutes: null,
      };
    }
  });

  if (!hasLocation) {
    return enrichedGames;
  }

  if (strictGoogleRouting) {
    return enrichedGames;
  }

  return applyExactStartRoute(enrichedGames, startLocation);
}

export function GamesProvider({ children }) {
  const navigate = useNavigate();
  const setup = useSetup();
  const {
    kreisId,
    jugendId,
    fromDate,
    toDate,
    activeTeams,
    favorites,
    adapterEndpoint,
    adapterToken,
    jugend,
    startLocation,
    setErr,
    setTeamValidation,
  } = setup;

  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [enrichingGames, setEnrichingGames] = useState(false);
  const [dataSourceUsed, setDataSourceUsed] = useState("mock");
  const [gameNotes, setGameNotes] = useState(() => {
    if (typeof window === "undefined") {
      return {};
    }
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEYS.notes);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return parsed?.byId && typeof parsed.byId === "object" ? parsed.byId : {};
    } catch {
      return {};
    }
  });
  const [selectedGameIds, setSelectedGameIds] = useState({});
  const buildRunRef = useRef(0);
  const favoritesRef = useRef(favorites);
  const gameNotesRef = useRef(gameNotes);

  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  useEffect(() => {
    gameNotesRef.current = gameNotes;
  }, [gameNotes]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.sessionStorage.setItem(STORAGE_KEYS.notes, JSON.stringify({ byId: gameNotes }));
    } catch {
      // Ignore sessionStorage write errors.
    }
  }, [gameNotes]);

  const prioritized = useMemo(
    () => [...games].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)).slice(0, 5),
    [games],
  );
  const plannedGames = useMemo(
    () => games.filter((game) => Boolean(selectedGameIds?.[game.id])),
    [games, selectedGameIds],
  );
  const selectedGameCount = plannedGames.length;

  const resetGames = useCallback(() => {
    setGames([]);
    setSelectedGameIds({});
    setEnrichingGames(false);
    setDataSourceUsed("mock");
  }, []);

  const onBackSetup = useCallback(() => {
    navigate("/setup");
  }, [navigate]);

  const onSetGameNote = useCallback((gameId, noteText) => {
    const text = String(noteText || "");

    setGameNotes((prev) => {
      const next = { ...prev };
      if (!text.trim()) {
        delete next[gameId];
      } else {
        next[gameId] = text;
      }
      return next;
    });

    setGames((prev) =>
      prev.map((game) => {
        if (game.id !== gameId) {
          return game;
        }
        return {
          ...game,
          note: text,
        };
      }),
    );
  }, []);

  const onTogglePlannedGame = useCallback((gameId) => {
    const id = String(gameId ?? "").trim();
    if (!id) {
      return;
    }
    setSelectedGameIds((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      return next;
    });
  }, []);

  const onSelectAllPlannedGames = useCallback(() => {
    setSelectedGameIds(() =>
      games.reduce((acc, game) => {
        const id = String(game?.id ?? "").trim();
        if (id) {
          acc[id] = true;
        }
        return acc;
      }, {}),
    );
  }, [games]);

  const onClearPlannedGames = useCallback(() => {
    setSelectedGameIds({});
  }, []);

  const onRestorePlannedGames = useCallback((gameIds) => {
    const safeIds = Array.isArray(gameIds)
      ? gameIds
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      : [];

    if (safeIds.length === 0) {
      setSelectedGameIds({});
      return;
    }

    setSelectedGameIds(() =>
      safeIds.reduce((acc, id) => {
        acc[id] = true;
        return acc;
      }, {}),
    );
  }, []);

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
    setEnrichingGames(false);
    setTeamValidation(null);

    const runId = buildRunRef.current + 1;
    buildRunRef.current = runId;

    try {
      const { games: fetchedGames, source, meta } = await fetchGamesWithProviders({
        mode: "adapter",
        kreisId,
        jugendId,
        fromDate,
        toDate,
        teams: activeTeams,
        uploadedGames: [],
        adapterEndpoint,
        adapterToken,
        turnier: Boolean(jugend?.turnier),
      });

      const favoriteSnapshot = favoritesRef.current;
      const noteSnapshot = gameNotesRef.current;
      const boostedGames = withFavoriteBoost(fetchedGames, favoriteSnapshot);
      const initialGames = ensureGameIds(withNotes(boostedGames, noteSnapshot));
      setGames(initialGames);
      setSelectedGameIds({});
      setDataSourceUsed(source);
      setTeamValidation(meta?.teamFilter || null);
      navigate("/games");

      if (initialGames.length === 0) {
        return;
      }

      setEnrichingGames(true);

      void enrichGames(initialGames, startLocation)
        .then((enrichedGames) => {
          if (buildRunRef.current !== runId) {
            return;
          }
          setGames(ensureGameIds(withNotes(withFavoriteBoost(enrichedGames, favoritesRef.current), gameNotesRef.current)));
        })
        .catch(() => {
          // Keep initial games if enrichment fails.
        })
        .finally(() => {
          if (buildRunRef.current === runId) {
            setEnrichingGames(false);
          }
        });
    } catch (error) {
      setEnrichingGames(false);
      setErr(`Spieldaten konnten nicht geladen werden: ${error.message}`);
    } finally {
      if (buildRunRef.current === runId) {
        setLoadingGames(false);
      }
    }
  }, [
    kreisId,
    jugendId,
    fromDate,
    toDate,
    activeTeams,
    adapterEndpoint,
    adapterToken,
    jugend,
    startLocation,
    setErr,
    setTeamValidation,
    navigate,
  ]);

  const value = useMemo(
    () => ({
      games,
      plannedGames,
      gameNotes,
      selectedGameIds,
      selectedGameCount,
      loadingGames,
      enrichingGames,
      dataSourceUsed,
      prioritized,
      setGames,
      setDataSourceUsed,
      resetGames,
      onBackSetup,
      onBuildAndGo,
      onSetGameNote,
      onTogglePlannedGame,
      onSelectAllPlannedGames,
      onClearPlannedGames,
      onRestorePlannedGames,
    }),
    [
      games,
      plannedGames,
      gameNotes,
      selectedGameIds,
      selectedGameCount,
      loadingGames,
      enrichingGames,
      dataSourceUsed,
      prioritized,
      resetGames,
      onBackSetup,
      onBuildAndGo,
      onSetGameNote,
      onTogglePlannedGame,
      onSelectAllPlannedGames,
      onClearPlannedGames,
      onRestorePlannedGames,
    ],
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
