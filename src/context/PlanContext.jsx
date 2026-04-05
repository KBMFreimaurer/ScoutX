import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LLM_PRESETS } from "../config/llmPresets";
import { callLLM, testConnection } from "../services/llm";
import { openScoutPdf } from "../services/pdf";
import { cleanScoutPlanText, normalizeLlmEndpoint } from "./shared";
import { useGames } from "./GamesContext";
import { useSetup } from "./SetupContext";

const PlanContext = createContext(null);

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

      const spielListe = allSorted
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

      const prompt = `Du bist ein professioneller Fußball-Scout-Analyst mit Fokus auf Jugendfußball im Gebiet Deutschland (insbesondere FVN/Niederrhein), tätig für das NLZ von Borussia Mönchengladbach.

KONTEXT
Kreis: ${setup.kreis?.label} (FVN Niederrhein)
Altersklasse: ${setup.jugend?.label} — Jahrgang ca. ${jahrgang} (${setup.jugend?.alter} Jahre)${isTurnier ? " — TURNIERFORMAT (kein klassisches Heim/Auswärts)" : ""}
Scout-Fokus: ${setup.focus || "Allgemein — Talente, Spielstärke, taktisches Niveau"}
Scouting-Datum: ab ${setup.fromDate}

SPIELLISTE (${allSorted.length} ${isTurnier ? "Turnierbegegnungen" : "Spiele"})
${spielListe}

AUFGABEN
1. VALIDIERUNG
Bewerte für jedes Spiel:
- Altersklasse plausibel für ${setup.jugend?.label}? (Ja / Unsicher / Nicht eindeutig zuordenbar)
- Wettbewerbsniveau einschätzen (z. B. Kreisklasse, Kreisleistungsklasse, Niederrheinliga)
- ${isTurnier ? "Turnier-Besonderheiten (Spielzeit, Format)" : "Heim/Auswärts-Vorteil relevant?"}
- Spiele mit [NLZ-relevant] besonders prüfen

2. SCOUTING-BEWERTUNG
Ranke die TOP 5 Spiele nach Relevanz für NLZ-Scouting (Borussia Mönchengladbach).
Kriterien (absteigend gewichtet):
1) Vereinsniveau und Nachwuchsarbeit
2) Wettbewerbsklasse
3) Gegnerqualität
4) Jahrgangsreinheit (${setup.jugend?.label} exakt vs. gemischt)
Ausgabe je Spiel:
- Rang + Spiel
- Begründung (2–3 Sätze)
- Kennzeichnung: wahrscheinlich ${jahrgang.split("/")[0]}-lastig / gemischt / unklar

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
- ${
        isTurnier
          ? "Turnierspiele: Spielzeit oft kürzer (z. B. 2x15 Min.) — Beobachtungszeit entsprechend anpassen"
          : "Kinderfestivals oder Freundschaftsspiele separat kennzeichnen, falls erkennbar"
      }
- Den Punkt Beobachtungspunkte vollständig weglassen
- Keine Markdown-Syntax verwenden
- Keine Zeichen # und * verwenden
- Antwort klar, professionell, faktenbasiert und ohne unnötigen Text
- Sprache: Deutsch`;

      const result = await callLLM({
        endpoint: llmEndpoint,
        isOllama: llmIsOllama,
        model: llmModel,
        apiKey: llmKey,
        prompt,
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

    const pdfPopup = window.open("", "_blank", "noopener,noreferrer");
    if (pdfPopup && !pdfPopup.closed) {
      pdfPopup.document.write("<!doctype html><html><head><title>ScoutX PDF</title></head><body style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:16px;color:#222'>PDF wird vorbereitet...</body></html>");
      pdfPopup.document.close();
    }

    await onGenerateAI({
      navigateToPlan: true,
      pdfPopup,
    });
  }, [plan, gamesCtx.games, cfg, navigate, onGenerateAI]);

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
