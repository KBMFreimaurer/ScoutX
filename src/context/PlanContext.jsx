import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LLM_PRESETS } from "../config/llmPresets";
import { callLLM, testConnection } from "../services/llm";
import { openScoutPdf } from "../services/pdf";
import { cleanScoutPlanText, normalizeLlmEndpoint } from "./shared";
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

function inferLevel(priority) {
  const value = Number(priority || 0);
  if (value >= 5) {
    return "gehobenes Niveau";
  }
  if (value >= 4) {
    return "solides Wettbewerbsniveau";
  }
  return "offenes Wettbewerbsniveau";
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
  const routeGames = sortedGames.slice(0, 3);
  const firstYear = String(jahrgang || "").split("/")[0] || "unbekannt";
  const lines = [];

  lines.push("VALIDIERUNG");
  lines.push("Validierung der Top-Spiele:");

  if (topGames.length === 0) {
    lines.push("Keine Spiele verfügbar.");
  } else {
    for (let index = 0; index < topGames.length; index += 1) {
      const game = topGames[index];
      lines.push(`Spiel ${index + 1}: ${game.home} vs. ${game.away} (${kickoffLabel(game.time)})`);
      lines.push(`Altersklasse: Plausibel für ${jugendLabel || "die gewählte Altersklasse"}.`);
      lines.push(`Wettbewerbsniveau: ${inferLevel(game.priority)}.`);
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

  lines.push("ROUTENPLAN (MAX. 3 SPIELE)");
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

export function PlanProvider({ children, defaultLlmEndpoint }) {
  const navigate = useNavigate();
  const setup = useSetup();
  const gamesCtx = useGames();

  const fixedLlmPreset = LLM_PRESETS.qwen;
  const llmType = "qwen";
  const llmModel = fixedLlmPreset.model;
  const llmEndpoint = normalizeLlmEndpoint(fixedLlmPreset.endpoint, defaultLlmEndpoint);
  const llmKey = "";
  const llmIsOllama = true;
  const rememberApiKey = false;

  const [plan, setPlan] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [connStatus, setConnStatus] = useState(null);

  const cfg = useMemo(
    () => ({
      kreisLabel: setup.kreis?.label ?? "",
      jugendLabel: setup.jugend?.label ?? "",
      jugendAlter: setup.jugend?.alter ?? "",
      fromDate: setup.fromDate,
      focus: setup.focus,
    }),
    [setup.kreis, setup.jugend, setup.fromDate, setup.focus],
  );

  useEffect(() => {
    setPlan("");
  }, [gamesCtx.games]);

  const onTestConnection = useCallback(async () => {
    setConnStatus("testing");

    try {
      const result = await testConnection({
        endpoint: llmEndpoint,
        isOllama: llmIsOllama,
        model: llmModel,
        apiKey: llmKey,
      });
      setConnStatus(result);
    } catch (error) {
      setConnStatus({ ok: false, error: error.message });
    }
  }, [llmEndpoint, llmIsOllama, llmModel, llmKey]);

  const onGenerateAI = useCallback(async ({ navigateToPlan = true, pdfPopup = null } = {}) => {
    setLoadingAI(true);
    setup.setErr("");

    try {
      const isTurnier = setup.jugend?.turnier ?? false;
      const toSortableTime = (value) => {
        const text = String(value || "").trim();
        return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : "99:99";
      };
      const allSorted = [...gamesCtx.games].sort((a, b) => {
        const dateDelta = a.dateObj - b.dateObj;
        return dateDelta !== 0 ? dateDelta : toSortableTime(a.time).localeCompare(toSortableTime(b.time));
      });

      const PROMPT_GAME_LIMIT = 60;
      const promptGames = allSorted.slice(0, PROMPT_GAME_LIMIT);
      const wasTrimmed = allSorted.length > promptGames.length;

      const spielListe = promptGames
        .map((game, index) => {
          const priorityText = game.priority >= 5 ? "[★ NLZ-relevant]" : game.priority >= 4 ? "[gehobenes Niveau]" : "";
          const kickoffText = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(game.time || "").trim())
            ? `${game.time} Uhr`
            : "Anstoß offen";

          return `${index + 1}. ${game.dateLabel} ${kickoffText} — ${game.home} vs. ${game.away}\n   Spielort: ${
            game.venue
          }${priorityText ? ` | ${priorityText}` : ""}`;
        })
        .join("\n\n");

      const currentYear = new Date().getFullYear();
      const alterRange = setup.jugend?.alter ?? "?";
      const [minAlter] = alterRange.split("–").map(Number);
      const jahrgang = Number.isNaN(minAlter) ? "unbekannt" : `${currentYear - minAlter - 1}/${currentYear - minAlter}`;

      const prompt = `Du bist ein professioneller Fußball-Scout-Analyst für Jugendfußball im Gebiet FVN/Niederrhein, tätig für das NLZ von Borussia Mönchengladbach.

KONTEXT
Kreis: ${setup.kreis?.label} (FVN Niederrhein)
Altersklasse: ${setup.jugend?.label} — Jahrgang ca. ${jahrgang} (${setup.jugend?.alter} Jahre)${isTurnier ? " — TURNIERFORMAT (kein klassisches Heim/Auswärts)" : ""}
Scout-Fokus: ${setup.focus || "Allgemein — Talente, Spielstärke, taktisches Niveau"}
Scouting-Datum: ab ${setup.fromDate}

SPIELLISTE (${promptGames.length}${wasTrimmed ? ` von ${allSorted.length}` : ""} ${isTurnier ? "Turnierbegegnungen" : "Spiele"})
${spielListe}

AUFGABEN
1. SCOUTING-BEWERTUNG
Ranke die TOP 5 Spiele nach Relevanz für NLZ-Scouting (Borussia Mönchengladbach).
Kriterien (absteigend gewichtet):
1) Vereinsniveau und Nachwuchsarbeit
2) Wettbewerbsklasse
3) Gegnerqualität
4) Jahrgangsreinheit (${setup.jugend?.label} exakt vs. gemischt)
Ausgabe je Spiel:
- Rang + Spiel
- Begründung (maximal 2 Sätze)
- Kennzeichnung: wahrscheinlich ${jahrgang.split("/")[0]}-lastig / gemischt / unklar

2. VALIDIERUNG (nur für die TOP 5 aus Aufgabe 1)
Für jedes Top-Spiel:
- Altersklasse plausibel? (Ja / Unsicher / Nicht eindeutig)
- Wettbewerbsniveau
- ${isTurnier ? "Turnier-Besonderheiten" : "Heim/Auswärts-Vorteil relevant?"}
- Kennzeichnung [NLZ-relevant], falls zutreffend

3. ROUTENPLAN (MAX. 3 SPIELE)
Erstelle den optimalen Scouting-Tag mit realistischen Fahrtzeiten zwischen Spielorten und mindestens 45 Minuten Anwesenheit pro Spiel.
Format:
SCOUTING PLAN
[Uhrzeit] — [Spiel] | [Spielort]
[Uhrzeit] — [Spiel] | [Spielort]
[Uhrzeit] — [Spiel] | [Spielort]
Kurze Begründung der Route

REGELN
- Keine Spekulationen, keine erfundenen Daten
- Wenn Wettbewerb unklar, explizit kennzeichnen
- Den Punkt Beobachtungspunkte vollständig weglassen
- Keine Markdown-Syntax verwenden
- Keine Zeichen # und * verwenden
- Antwort klar, professionell, faktenbasiert und ohne unnötigen Text
- Kurz und kompakt antworten
- Sprache: Deutsch`;

      const result = await callLLM({
        endpoint: llmEndpoint,
        isOllama: llmIsOllama,
        model: llmModel,
        apiKey: llmKey,
        prompt,
        maxOutputTokens: 1100,
      });

      const cleanedResult = cleanScoutPlanText(result);
      setPlan(cleanedResult);

      if (pdfPopup) {
        openScoutPdf(gamesCtx.games, cleanedResult, cfg, pdfPopup);
      }

      if (navigateToPlan) {
        navigate("/plan");
      }

      return cleanedResult;
    } catch (error) {
      if (pdfPopup && !pdfPopup.closed) {
        pdfPopup.close();
      }
      const message = String(error?.message || "Unbekannter Fehler");
      if (/timeout/i.test(message)) {
        setup.setErr(
          `LLM Fehler: ${message}. Qwen braucht länger als erwartet. Prüfe die lokale Ollama-Performance oder erhöhe VITE_LLM_TIMEOUT_MS / VITE_LLM_TIMEOUT_OLLAMA_MS.`,
        );
      } else if (/http 504|gateway time-out|gateway timeout/i.test(message)) {
        setup.setErr(
          "LLM Fehler: HTTP 504 Gateway Timeout. Der LLM-Server war zu langsam erreichbar. Bitte erneut versuchen; ScoutX wiederholt den Aufruf bereits automatisch.",
        );
      } else {
        setup.setErr(`LLM Fehler: ${message}`);
      }
      return "";
    } finally {
      setLoadingAI(false);
    }
  }, [
    setup,
    gamesCtx.games,
    llmEndpoint,
    llmIsOllama,
    llmModel,
    llmKey,
    cfg,
    navigate,
  ]);

  const onGeneratePlanPdf = useCallback(async () => {
    if (String(plan || "").trim()) {
      openScoutPdf(gamesCtx.games, plan, cfg);
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
    openScoutPdf(gamesCtx.games, quickPlan, cfg);
    navigate("/plan");
  }, [plan, gamesCtx.games, cfg, navigate, setup.jugend]);

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
      loadingAI,
      cfg,
      llmType,
      llmModel,
      llmEndpoint,
      llmKey,
      llmIsOllama,
      rememberApiKey,
      connStatus,
      setPlan,
      onTestConnection,
      onGenerateAI,
      onGeneratePlanPdf,
      onBackGames,
      onResetSoft,
      onResetHard,
    }),
    [
      plan,
      loadingAI,
      cfg,
      llmType,
      llmModel,
      llmEndpoint,
      llmKey,
      llmIsOllama,
      rememberApiKey,
      connStatus,
      onTestConnection,
      onGenerateAI,
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
