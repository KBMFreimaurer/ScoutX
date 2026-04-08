import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { openScoutPdf } from "../services/pdf";
import { calculateRoute, calculateRouteWithDriving } from "../utils/geo";
import { cleanScoutPlanText } from "./shared";
import { useGames } from "./GamesContext";
import { useSetup } from "./SetupContext";

const PlanContext = createContext(null);
const KNOWN_TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function toSortableKickoff(value) {
  const text = String(value || "").trim();
  return KNOWN_TIME_RE.test(text) ? text : "99:99";
}

function kickoffLabel(value) {
  const text = String(value || "").trim();
  return KNOWN_TIME_RE.test(text) ? `${text} Uhr` : "Anstoß offen";
}

function inferReason(priority) {
  const value = Number(priority || 0);
  if (value >= 5) {
    return "Hohe Priorität und gute Vergleichsqualität für gezielte Talentbeobachtung.";
  }
  if (value >= 4) {
    return "Gutes Matchup mit relevantem Scouting-Wert für den Tagesverlauf.";
  }
  return "Sinnvolles Ergänzungsspiel zur breiten Spielbeobachtung.";
}

function buildQuickScoutPlan({ games, jugendLabel, isTurnier, jahrgang }) {
  const sortedGames = [...(Array.isArray(games) ? games : [])].sort((a, b) => {
    const dateDelta = a.dateObj - b.dateObj;
    if (dateDelta !== 0) {
      return dateDelta;
    }
    return toSortableKickoff(a.time).localeCompare(toSortableKickoff(b.time));
  });
  const topGames = [...sortedGames]
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
    .slice(0, 5);
  const routeGames = sortedGames;
  const firstYear = String(jahrgang || "").split("/")[0] || "unbekannt";
  const lines = [];

  lines.push("Validierung der Top-Spiele:");

  if (topGames.length === 0) {
    lines.push("Keine Spiele verfügbar.");
  } else {
    for (let index = 0; index < topGames.length; index += 1) {
      const game = topGames[index];
      lines.push(`Spiel ${index + 1}: ${game.home} vs. ${game.away} (${kickoffLabel(game.time)})`);
      lines.push(`Altersklasse: Plausibel für ${jugendLabel || "die gewählte Altersklasse"}.`);
      lines.push(
        isTurnier
          ? "Turnier-Besonderheiten: Kurze Spielzeiten und enge Wechselrhythmen berücksichtigen."
          : "Heim/Auswärts-Vorteil: Bei der Einzelbewertung berücksichtigen.",
      );
      lines.push(`NLZ-relevant: ${Number(game.priority || 0) >= 5 ? "Ja" : "Beobachtbar"}.`);
      lines.push("");
    }
  }

  lines.push("SCOUTING-BEWERTUNG");
  lines.push("Top 5 Spiele nach Relevanz für NLZ-Scouting:");

  if (topGames.length === 0) {
    lines.push("Keine priorisierten Spiele verfügbar.");
  } else {
    for (let index = 0; index < topGames.length; index += 1) {
      const game = topGames[index];
      const yearTag = Number(game.priority || 0) >= 5 && firstYear !== "unbekannt" ? `wahrscheinlich ${firstYear}-lastig` : "gemischt";
      lines.push(`${index + 1}. ${game.home} vs. ${game.away} (${kickoffLabel(game.time)}) | ${game.venue}`);
      lines.push(`Begründung: ${inferReason(game.priority)}`);
      lines.push(`Kennzeichnung: ${yearTag}.`);
      lines.push("");
    }
  }

  lines.push("ROUTENPLAN");
  lines.push("SCOUTING PLAN");

  if (routeGames.length === 0) {
    lines.push("Keine Route verfügbar.");
  } else {
    routeGames.forEach((game) => {
      const routeTime = KNOWN_TIME_RE.test(String(game.time || "").trim()) ? game.time : "--:--";
      lines.push(`${routeTime} — ${game.home} vs. ${game.away} | ${game.venue}`);
    });
  }

  lines.push("");
  lines.push("Kurze Begründung der Route:");
  lines.push("Die Route startet mit den frühesten Anstoßzeiten und priorisiert Spiele mit hohem Scouting-Wert.");

  return cleanScoutPlanText(lines.join("\n"));
}

export function PlanProvider({ children }) {
  const navigate = useNavigate();
  const setup = useSetup();
  const gamesCtx = useGames();

  const [plan, setPlan] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const [routeOverview, setRouteOverview] = useState(null);

  const cfg = useMemo(
    () => ({
      kreisLabel: setup.kreis?.label ?? "",
      jugendLabel: setup.jugend?.label ?? "",
      jugendAlter: setup.jugend?.alter ?? "",
      fromDate: setup.fromDate,
      focus: setup.focus,
      startLocationLabel: setup.startLocation?.label ?? "",
    }),
    [setup.kreis, setup.jugend, setup.fromDate, setup.focus, setup.startLocation],
  );

  const pdfSyncContext = useMemo(
    () => ({
      source: gamesCtx.dataSourceUsed,
      adapterEndpoint: setup.adapterEndpoint,
      adapterToken: setup.adapterToken,
      kreisId: setup.kreisId,
      jugendId: setup.jugendId,
      fromDate: setup.fromDate,
      teams: setup.activeTeams,
      turnier: Boolean(setup.jugend?.turnier),
    }),
    [
      gamesCtx.dataSourceUsed,
      setup.adapterEndpoint,
      setup.adapterToken,
      setup.kreisId,
      setup.jugendId,
      setup.fromDate,
      setup.activeTeams,
      setup.jugend,
    ],
  );

  const routeGames = useMemo(() => {
    return [...(Array.isArray(gamesCtx.games) ? gamesCtx.games : [])]
      .sort((a, b) => {
        const ad = a?.dateObj instanceof Date ? a.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b?.dateObj instanceof Date ? b.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
        if (ad !== bd) {
          return ad - bd;
        }
        return toSortableKickoff(a.time).localeCompare(toSortableKickoff(b.time));
      });
  }, [gamesCtx.games]);

  useEffect(() => {
    let alive = true;

    if (!setup.startLocation || routeGames.length === 0) {
      setRouteOverview(null);
      return () => {
        alive = false;
      };
    }

    const fallback = calculateRoute(setup.startLocation, routeGames);
    setRouteOverview(fallback);

    void calculateRouteWithDriving(setup.startLocation, routeGames)
      .then((routed) => {
        if (!alive || !routed) {
          return;
        }
        setRouteOverview(routed);
      })
      .catch(() => {
        // Keep fallback route overview.
      });

    return () => {
      alive = false;
    };
  }, [setup.startLocation, routeGames]);

  useEffect(() => {
    setPlan("");
  }, [gamesCtx.games]);

  const onGeneratePlanPdf = useCallback(async () => {
    if (pdfExporting) {
      return;
    }

    setup.setErr("");
    setPdfExporting(true);

    const pdfCfg = {
      ...cfg,
      startLocation: setup.startLocation || null,
      routeOverview: routeOverview || null,
    };

    try {
      if (String(plan || "").trim()) {
        const result = await openScoutPdf(gamesCtx.games, plan, pdfCfg, null, pdfSyncContext);
        if (result?.ok === false) {
          setup.setErr(`PDF konnte nicht erstellt werden: ${result?.error || "Unbekannter Fehler"}`);
          return;
        }
        navigate("/plan");
        return;
      }

      const currentYear = new Date().getFullYear();
      const alterRange = setup.jugend?.alter ?? "";
      const [minAlter] = alterRange.split("–").map(Number);
      const jahrgang = Number.isNaN(minAlter) ? "unbekannt" : `${currentYear - minAlter - 1}/${currentYear - minAlter}`;

      const quickPlan = buildQuickScoutPlan({
        games: gamesCtx.games,
        jugendLabel: setup.jugend?.label,
        isTurnier: Boolean(setup.jugend?.turnier),
        jahrgang,
      });

      setPlan(quickPlan);
      const result = await openScoutPdf(gamesCtx.games, quickPlan, pdfCfg, null, pdfSyncContext);
      if (result?.ok === false) {
        setup.setErr(`PDF konnte nicht erstellt werden: ${result?.error || "Unbekannter Fehler"}`);
        return;
      }

      navigate("/plan");
    } finally {
      setPdfExporting(false);
    }
  }, [pdfExporting, plan, gamesCtx.games, cfg, pdfSyncContext, routeOverview, navigate, setup]);

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
