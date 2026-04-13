import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { calculateDirectStartRoutes, calculateRoute, calculateRouteWithDriving, isGoogleRoutingStrictMode } from "../utils/geo";
import { cleanScoutPlanText } from "./shared";
import { useGames } from "./GamesContext";
import { useSetup } from "./SetupContext";

const PlanContext = createContext(null);
const KNOWN_TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ROUTE_TIMEOUT_MS = Number(import.meta.env?.VITE_ROUTE_TIMEOUT_MS || 60000);

function withTimeout(promise, timeoutMs, fallbackValue) {
  const safeTimeout = Number(timeoutMs);
  if (!Number.isFinite(safeTimeout) || safeTimeout <= 0) {
    return Promise.resolve(promise).catch(() => fallbackValue);
  }

  return new Promise((resolve) => {
    let settled = false;
    const timer = globalThis.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(fallbackValue);
    }, safeTimeout);

    Promise.resolve(promise)
      .then((value) => {
        if (settled) {
          return;
        }
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) {
          return;
        }
        settled = true;
        globalThis.clearTimeout(timer);
        resolve(fallbackValue);
      });
  });
}

function toSortableKickoff(value) {
  const text = String(value || "").trim();
  return KNOWN_TIME_RE.test(text) ? text : "99:99";
}

function buildManualScoutPlan({ games, jugendLabel, kreisLabel, isTurnier, usedFallbackAll = false }) {
  const sortedGames = [...(Array.isArray(games) ? games : [])].sort((a, b) => {
    const dateDelta = a.dateObj - b.dateObj;
    if (dateDelta !== 0) {
      return dateDelta;
    }
    return toSortableKickoff(a.time).localeCompare(toSortableKickoff(b.time));
  });
  const lines = [];

  lines.push("Manueller Scouting-Plan");
  lines.push("Auswahl durch Scout (keine automatische Empfehlung).");
  lines.push(`Wettbewerb: ${jugendLabel || "n/a"} · ${kreisLabel || "n/a"}`);
  lines.push(`Turniermodus: ${isTurnier ? "Ja" : "Nein"}`);
  if (usedFallbackAll) {
    lines.push(`Keine manuelle Auswahl markiert · alle verfügbaren Spiele übernommen (${sortedGames.length}).`);
  } else {
    lines.push(`Ausgewählte Spiele: ${sortedGames.length}`);
  }
  lines.push("");
  lines.push("Besuchsplan");
  lines.push("ROUTENPLAN");

  if (sortedGames.length === 0) {
    lines.push("Keine Spiele verfügbar.");
  } else {
    sortedGames.forEach((game, index) => {
      const routeTime = KNOWN_TIME_RE.test(String(game.time || "").trim()) ? game.time : "--:--";
      lines.push(`${index + 1}. ${routeTime} — ${game.home} vs. ${game.away} | ${game.venue || "Sportanlage"}`);
    });
  }

  lines.push("");
  lines.push("Hinweis:");
  lines.push("Fahrtkosten-Abrechnung und PDF basieren auf den Spielen dieses Plans.");

  return cleanScoutPlanText(lines.join("\n"));
}

export function PlanProvider({ children }) {
  const navigate = useNavigate();
  const setup = useSetup();
  const gamesCtx = useGames();
  const strictGoogleRouting = isGoogleRoutingStrictMode();

  const [plan, setPlan] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const [routeOverview, setRouteOverview] = useState(null);
  const [routeDirectOptions, setRouteDirectOptions] = useState([]);
  const [routeCalculating, setRouteCalculating] = useState(false);

  const cfg = useMemo(
    () => ({
      kreisLabel: setup.kreis?.label ?? "",
      jugendLabel: setup.jugend?.label ?? "",
      jugendAlter: setup.jugend?.alter ?? "",
      fromDate: setup.fromDate,
      startLocationLabel: setup.startLocation?.label ?? "",
    }),
    [setup.kreis, setup.jugend, setup.fromDate, setup.startLocation],
  );

  const effectivePlannedGames = useMemo(() => {
    const selectedGames = Array.isArray(gamesCtx.plannedGames) ? gamesCtx.plannedGames : [];
    if (selectedGames.length > 0) {
      return selectedGames;
    }
    return Array.isArray(gamesCtx.games) ? gamesCtx.games : [];
  }, [gamesCtx.plannedGames, gamesCtx.games]);

  const routeGames = useMemo(() => {
    return [...effectivePlannedGames]
      .sort((a, b) => {
        const ad = a?.dateObj instanceof Date ? a.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b?.dateObj instanceof Date ? b.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
        if (ad !== bd) {
          return ad - bd;
        }
        return toSortableKickoff(a.time).localeCompare(toSortableKickoff(b.time));
      });
  }, [effectivePlannedGames]);

  const routePreviewGames = useMemo(() => routeGames.slice(0, 5), [routeGames]);

  useEffect(() => {
    let alive = true;
    const expectedDirectCount = routePreviewGames.length;

    if (!setup.startLocation || routePreviewGames.length === 0) {
      setRouteOverview(null);
      setRouteDirectOptions([]);
      setRouteCalculating(false);
      return () => {
        alive = false;
      };
    }

    if (strictGoogleRouting) {
      setRouteOverview(null);
    } else {
      const fallback = calculateRoute(setup.startLocation, routePreviewGames);
      setRouteOverview(fallback);
    }
    setRouteCalculating(true);

    void Promise.all([
      withTimeout(calculateRouteWithDriving(setup.startLocation, routePreviewGames), ROUTE_TIMEOUT_MS, null),
      withTimeout(
        calculateDirectStartRoutes(setup.startLocation, routePreviewGames, expectedDirectCount),
        ROUTE_TIMEOUT_MS,
        [],
      ),
    ])
      .then(([routed, direct]) => {
        if (!alive) {
          return;
        }
        if (routed) {
          setRouteOverview(routed);
        }
        setRouteDirectOptions(Array.isArray(direct) ? direct : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) {
          return;
        }
        setRouteCalculating(false);
      });

    return () => {
      alive = false;
    };
  }, [setup.startLocation, routePreviewGames, strictGoogleRouting]);

  useEffect(() => {
    setPlan("");
  }, [gamesCtx.games, gamesCtx.selectedGameCount]);

  const onGeneratePlanPdf = useCallback(async () => {
    if (pdfExporting) {
      return;
    }

    setup.setErr("");
    setPdfExporting(true);

    try {
      if (String(plan || "").trim()) {
        navigate("/plan");
        return;
      }

      if (!Array.isArray(effectivePlannedGames) || effectivePlannedGames.length === 0) {
        setup.setErr("Keine Spiele für den Plan verfügbar.");
        navigate("/games");
        return;
      }

      const selectedGames = Array.isArray(gamesCtx.plannedGames) ? gamesCtx.plannedGames : [];
      const usedFallbackAll = selectedGames.length === 0;

      const manualPlan = buildManualScoutPlan({
        games: effectivePlannedGames,
        jugendLabel: setup.jugend?.label,
        kreisLabel: setup.kreis?.label,
        isTurnier: Boolean(setup.jugend?.turnier),
        usedFallbackAll,
      });

      setPlan(manualPlan);
      navigate("/plan");
    } finally {
      setPdfExporting(false);
    }
  }, [
    pdfExporting,
    plan,
    gamesCtx.plannedGames,
    effectivePlannedGames,
    navigate,
    setup,
  ]);

  const onBackGames = useCallback(() => {
    navigate("/games");
  }, [navigate]);

  const onResetSoft = useCallback(() => {
    gamesCtx.resetGames();
    setPlan("");
    setup.setTeamValidation(null);
    setup.setErr("");
    navigate("/setup");
  }, [gamesCtx, setup, navigate]);

  const onResetHard = useCallback(() => {
    onResetSoft();
    setup.resetSetupState();
  }, [onResetSoft, setup]);

  const value = useMemo(
    () => ({
      plan,
      pdfExporting,
      routeDirectOptions,
      routeCalculating,
      cfg,
      routeOverview,
      setPlan,
      onGeneratePlanPdf,
      onBackGames,
      onResetSoft,
      onResetHard,
    }),
    [
      plan,
      pdfExporting,
      routeDirectOptions,
      routeCalculating,
      cfg,
      routeOverview,
      onGeneratePlanPdf,
      onBackGames,
      onResetSoft,
      onResetHard,
    ],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error("usePlan muss innerhalb von PlanProvider verwendet werden.");
  }
  return context;
}
