import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BMGBadge } from "./components/BMGBadge";
import { StepNav } from "./components/StepNav";
import { ScoutXProvider } from "./context/ScoutXContext";
import { C, GCSS } from "./styles/theme";
import { useWindowWidth } from "./hooks/useWindowWidth";
import { KREISE } from "./data/kreise";
import { JUGEND_KLASSEN } from "./data/altersklassen";
import { fetchGamesWithProviders, parseUploadedGamesReport } from "./services/dataProvider";
import { openScoutPdf } from "./services/pdf";
import { callLLM, testConnection } from "./services/llm";
import { STORAGE_KEYS, LLM_PRESETS } from "./data/constants";
import { SetupPage } from "./pages/SetupPage";
import { GamesPage } from "./pages/GamesPage";
import { PlanPage } from "./pages/PlanPage";

const DEFAULT_ADAPTER_ENDPOINT = import.meta.env.VITE_ADAPTER_ENDPOINT || "/api/games";
const DEFAULT_LLM_ENDPOINT = import.meta.env.VITE_LLM_ENDPOINT || "/ollama";

function readStorage(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const item = window.localStorage.getItem(key);
    return item ? { ...fallback, ...JSON.parse(item) } : fallback;
  } catch {
    return fallback;
  }
}

function isLocalHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
}

function tryParseAbsoluteUrl(urlText) {
  try {
    return new URL(urlText);
  } catch {
    return null;
  }
}

function normalizeAdapterEndpoint(savedEndpoint, fallbackEndpoint) {
  const endpoint = String(savedEndpoint || "").trim();
  if (!endpoint) {
    return fallbackEndpoint;
  }

  if (typeof window === "undefined") {
    return endpoint;
  }

  const appIsLocal = isLocalHost(window.location.hostname);
  const parsed = tryParseAbsoluteUrl(endpoint);
  const endpointIsAbsolute = Boolean(parsed);
  const endpointIsLocal = endpointIsAbsolute ? isLocalHost(parsed.hostname) : false;
  const mixedContentRisk =
    window.location.protocol === "https:" && endpointIsAbsolute && parsed.protocol.toLowerCase() === "http:";

  if ((!appIsLocal && endpointIsLocal) || mixedContentRisk) {
    return fallbackEndpoint;
  }

  return endpoint;
}

function normalizeLlmEndpoint(savedEndpoint, fallbackEndpoint) {
  const endpoint = String(savedEndpoint || "").trim();
  if (!endpoint) {
    return fallbackEndpoint;
  }

  if (typeof window === "undefined") {
    return endpoint;
  }

  const appIsLocal = isLocalHost(window.location.hostname);
  const parsed = tryParseAbsoluteUrl(endpoint);
  const endpointIsAbsolute = Boolean(parsed);
  const endpointIsLocal = endpointIsAbsolute ? isLocalHost(parsed.hostname) : false;
  const mixedContentRisk =
    window.location.protocol === "https:" && endpointIsAbsolute && parsed.protocol.toLowerCase() === "http:";

  if ((!appIsLocal && endpointIsLocal) || mixedContentRisk) {
    return fallbackEndpoint;
  }

  return endpoint;
}

function getWeekRange(isoDate) {
  const [year, month, day] = String(isoDate || "").split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setHours(0, 0, 0, 0);

  const weekday = (date.getDay() + 6) % 7;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - weekday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const toIso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return { fromDate: toIso(weekStart), toDate: toIso(weekEnd) };
}

function normalizeTeamParameters(values) {
  const seen = new Set();
  const teams = [];

  for (const value of Array.isArray(values) ? values : []) {
    const team = String(value || "").trim();
    if (!team) {
      continue;
    }

    const key = team.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    teams.push(team);
  }

  return teams;
}

function cleanScoutPlanText(rawText) {
  return String(rawText || "")
    .replace(/[#*]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const RAIL_ICONS = {
  setup: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1m15.36-5.36l-4.24 4.24m-4.24-4.24L3.64 3.64m16.72 16.72l-4.24-4.24m-4.24 4.24l-4.24 4.24"/>
    </svg>
  ),
  games: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  plan: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  reports: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  presets: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const width = useWindowWidth();
  const isMobile = width < 600;
  const todayIso = new Date().toISOString().split("T")[0];

  const storedSetup = readStorage(STORAGE_KEYS.setup, {
    kreisId: "",
    jugendId: "",
    selTeams: [],
    fromDate: todayIso,
    focus: "",
    dataMode: "auto",
    adapterEndpoint: DEFAULT_ADAPTER_ENDPOINT,
  });
  const setupDefaults = {
    ...storedSetup,
    adapterEndpoint: normalizeAdapterEndpoint(storedSetup.adapterEndpoint, DEFAULT_ADAPTER_ENDPOINT),
  };
  const fixedLlmPreset = LLM_PRESETS.qwen;
  const llmType = "qwen";
  const llmModel = fixedLlmPreset.model;
  const llmEndpoint = normalizeLlmEndpoint(fixedLlmPreset.endpoint, DEFAULT_LLM_ENDPOINT);
  const llmKey = "";
  const llmIsOllama = true;
  const rememberApiKey = false;

  const [kreisId, setKreisId] = useState(setupDefaults.kreisId);
  const [jugendId, setJugendId] = useState(setupDefaults.jugendId);
  const [selectedTeams, setSelectedTeams] = useState(() => normalizeTeamParameters(setupDefaults.selTeams));
  const [teamDraft, setTeamDraft] = useState("");
  const [teamValidation, setTeamValidation] = useState(null);
  const [fromDate, setFromDate] = useState(setupDefaults.fromDate);
  const [focus, setFocus] = useState(setupDefaults.focus);
  const [dataMode, setDataMode] = useState(setupDefaults.dataMode);
  const [adapterEndpoint, setAdapterEndpoint] = useState(setupDefaults.adapterEndpoint);
  const [adapterToken, setAdapterToken] = useState("");
  const [uploadedGames, setUploadedGames] = useState([]);
  const [uploadName, setUploadName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadSummary, setUploadSummary] = useState(null);

  const [connStatus, setConnStatus] = useState(null);

  const [games, setGames] = useState([]);
  const [plan, setPlan] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingGames, setLoadingGames] = useState(false);
  const [err, setErr] = useState("");
  const [dataSourceUsed, setDataSourceUsed] = useState("mock");

  const currentStep = useMemo(() => {
    if (location.pathname.startsWith("/games")) {
      return "games";
    }

    if (location.pathname.startsWith("/plan")) {
      return "plan";
    }

    return "setup";
  }, [location.pathname]);

  const kreis = useMemo(() => KREISE.find((item) => item.id === kreisId), [kreisId]);
  const jugend = useMemo(() => JUGEND_KLASSEN.find((item) => item.id === jugendId), [jugendId]);
  const activeTeams = useMemo(() => normalizeTeamParameters(selectedTeams), [selectedTeams]);

  const prioritized = useMemo(() => [...games].sort((a, b) => b.priority - a.priority).slice(0, 5), [games]);

  const cfg = {
    kreisLabel: kreis?.label ?? "",
    jugendLabel: jugend?.label ?? "",
    jugendAlter: jugend?.alter ?? "",
    fromDate,
    focus,
  };

  const canBuild = Boolean(kreisId && jugendId);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEYS.setup,
      JSON.stringify({
        kreisId,
        jugendId,
        selTeams: activeTeams,
        fromDate,
        focus,
        dataMode,
        adapterEndpoint,
      }),
    );
  }, [kreisId, jugendId, activeTeams, fromDate, focus, dataMode, adapterEndpoint]);

  useEffect(() => {
    window.localStorage.removeItem(STORAGE_KEYS.llm);
    window.sessionStorage.removeItem(STORAGE_KEYS.llmSessionKey);
  }, []);

  useEffect(() => {
    if (location.pathname === "/") {
      navigate("/setup", { replace: true });
    }
  }, [location.pathname, navigate]);

  const onSelectKreis = (id) => {
    setKreisId(id);
    setTeamValidation(null);
    setGames([]);
    setPlan("");
    setErr("");
    setUploadError("");
    setUploadSummary(null);
    navigate("/setup");
  };

  const onSelectJugend = (id) => {
    setJugendId(id);
    setTeamValidation(null);
    setGames([]);
    setPlan("");
    setErr("");
    setUploadError("");
    setUploadSummary(null);
    navigate("/setup");
  };

  const onClearAllTeams = () => {
    setSelectedTeams([]);
    setTeamValidation(null);
  };

  const onAddTeamField = (value = teamDraft) => {
    const team = String(value || "").trim();
    if (!team) {
      return;
    }

    setSelectedTeams((prev) => normalizeTeamParameters([...prev, team]));
    setTeamDraft("");
    setTeamValidation(null);
  };

  const onUpdateTeamField = (index, value) => {
    setSelectedTeams((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setTeamValidation(null);
  };

  const onNormalizeTeamField = () => {
    setSelectedTeams((prev) => {
      const next = [...prev];
      const normalized = normalizeTeamParameters(next);
      return normalized;
    });
    setTeamValidation(null);
  };

  const onRemoveTeamField = (index) => {
    setSelectedTeams((prev) => prev.filter((_, idx) => idx !== index));
    setTeamValidation(null);
  };

  const onFileImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadError("");
    setUploadSummary(null);

    try {
      const fileText = await file.text();
      const report = parseUploadedGamesReport(fileText, file.name, {
        kreisId,
        jugendId,
        fromDate,
        turnier: Boolean(jugend?.turnier),
      });

      if (!report.games.length) {
        throw new Error("Keine gültigen Spiele erkannt.");
      }

      setUploadedGames(report.games);
      setUploadName(file.name);
      setUploadSummary(report.stats);
      setDataSourceUsed("csv");
    } catch (error) {
      setUploadedGames([]);
      setUploadName("");
      setUploadError(error.message || "Datei konnte nicht verarbeitet werden.");
      setUploadSummary(null);
    }
  };

  const onTestConnection = async () => {
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
  };

  const onBuildAndGo = async () => {
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
      setPlan("");
      navigate("/games");
    } catch (error) {
      setErr(`Spieldaten konnten nicht geladen werden: ${error.message}`);
    } finally {
      setLoadingGames(false);
    }
  };

  const onGenerateAI = async ({ navigateToPlan = true, pdfPopup = null } = {}) => {
    setLoadingAI(true);
    setErr("");

    try {
      const isTurnier = jugend?.turnier ?? false;
      const toSortableTime = (value) => {
        const text = String(value || "").trim();
        return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : "99:99";
      };
      const allSorted = [...games].sort((a, b) => {
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
      const alterRange = jugend?.alter ?? "?";
      const [minAlter] = alterRange.split("–").map(Number);
      const jahrgang = Number.isNaN(minAlter) ? "unbekannt" : `${currentYear - minAlter - 1}/${currentYear - minAlter}`;

      const prompt = `Du bist ein professioneller Fußball-Scout-Analyst mit Fokus auf Jugendfußball im Gebiet Deutschland (insbesondere FVN/Niederrhein), tätig für das NLZ von Borussia Mönchengladbach.

KONTEXT
Kreis: ${kreis?.label} (FVN Niederrhein)
Altersklasse: ${jugend?.label} — Jahrgang ca. ${jahrgang} (${jugend?.alter} Jahre)${isTurnier ? " — TURNIERFORMAT (kein klassisches Heim/Auswärts)" : ""}
Scout-Fokus: ${focus || "Allgemein — Talente, Spielstärke, taktisches Niveau"}
Scouting-Datum: ab ${fromDate}

SPIELLISTE (${allSorted.length} ${isTurnier ? "Turnierbegegnungen" : "Spiele"})
${spielListe}

AUFGABEN
1. VALIDIERUNG
Bewerte für jedes Spiel:
- Altersklasse plausibel für ${jugend?.label}? (Ja / Unsicher / Nicht eindeutig zuordenbar)
- Wettbewerbsniveau einschätzen (z. B. Kreisklasse, Kreisleistungsklasse, Niederrheinliga)
- ${isTurnier ? "Turnier-Besonderheiten (Spielzeit, Format)" : "Heim/Auswärts-Vorteil relevant?"}
- Spiele mit [NLZ-relevant] besonders prüfen

2. SCOUTING-BEWERTUNG
Ranke die TOP 5 Spiele nach Relevanz für NLZ-Scouting (Borussia Mönchengladbach).
Kriterien (absteigend gewichtet):
1) Vereinsniveau und Nachwuchsarbeit
2) Wettbewerbsklasse
3) Gegnerqualität
4) Jahrgangsreinheit (${jugend?.label} exakt vs. gemischt)
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
        openScoutPdf(games, cleanedResult, cfg, pdfPopup);
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
        setErr(
          `LLM Fehler: ${message}. Qwen braucht länger als erwartet. Prüfe die lokale Ollama-Performance oder erhöhe VITE_LLM_TIMEOUT_MS / VITE_LLM_TIMEOUT_OLLAMA_MS.`,
        );
      } else {
        setErr(`LLM Fehler: ${message}`);
      }
      return "";
    } finally {
      setLoadingAI(false);
    }
  };

  const onGeneratePlanPdf = async () => {
    await onGenerateAI({
      navigateToPlan: true,
      pdfPopup: null,
    });
  };

  const onResetSoft = () => {
    setGames([]);
    setPlan("");
    setErr("");
    navigate("/setup");
  };

  const onResetHard = () => {
    onResetSoft();
    setKreisId("");
    setJugendId("");
    setSelectedTeams([]);
    setTeamDraft("");
    setTeamValidation(null);
    setUploadedGames([]);
    setUploadName("");
    setUploadError("");
    setUploadSummary(null);
    setDataMode("auto");
    setAdapterEndpoint(DEFAULT_ADAPTER_ENDPOINT);
    setAdapterToken("");
  };

  const onStepChange = (nextStep) => {
    navigate(`/${nextStep}`);
  };

  const onBackSetup = () => navigate("/setup");
  const onBackGames = () => navigate("/games");
  const isDesktopShell = width >= 1050;
  const railItems = [
    { id: "setup", label: "Setup", enabled: true, onClick: () => navigate("/setup") },
    { id: "games", label: "Spiele", enabled: games.length > 0, onClick: () => navigate("/games") },
    { id: "plan", label: "Scout-Plan", enabled: Boolean(plan), onClick: () => navigate("/plan") },
    { id: "reports", label: "Berichte", enabled: false },
    { id: "presets", label: "Vorlagen", enabled: false },
  ];

  const contextValue = {
    isMobile,
    currentStep,
    kreisId,
    jugendId,
    kreis,
    jugend,
    selectedTeams,
    activeTeams,
    teamDraft,
    teamValidation,
    fromDate,
    focus,
    dataMode,
    dataSourceUsed,
    adapterEndpoint,
    adapterToken,
    uploadedGames,
    uploadName,
    uploadError,
    uploadSummary,
    llmType,
    llmModel,
    llmEndpoint,
    llmKey,
    llmIsOllama,
    rememberApiKey,
    connStatus,
    games,
    plan,
    loadingAI,
    loadingGames,
    prioritized,
    cfg,
    err,
    canBuild,
    onSelectKreis,
    onSelectJugend,
    onAddTeamField,
    onUpdateTeamField,
    onNormalizeTeamField,
    onRemoveTeamField,
    onSetTeamDraft: setTeamDraft,
    onClearAllTeams,
    onSetFromDate: setFromDate,
    onSetFocus: setFocus,
    onDataModeChange: setDataMode,
    onAdapterEndpointChange: setAdapterEndpoint,
    onAdapterTokenChange: setAdapterToken,
    onFileImport,
    onTestConnection,
    onBuildAndGo,
    onGenerateAI,
    onGeneratePlanPdf,
    onBackSetup,
    onBackGames,
    onResetSoft,
    onResetHard,
  };

  return (
    <>
      <style>{GCSS}</style>

      <div className="app-shell" style={{ color: C.offWhite, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
        {isDesktopShell ? (
          <aside className="left-rail">
            <div>
              <div className="left-rail-brand">
                <BMGBadge size={28} />
                <span>Scout<span className="brand-accent">X</span></span>
              </div>
              <div className="left-rail-sub" style={{ marginTop: 4 }}>
                Scouting-Cockpit FVN Niederrhein
              </div>
            </div>

            <nav className="left-menu">
              {railItems.map((item) => {
                const active = currentStep === item.id;
                return (
                  <button
                    key={item.id}
                    className={`left-menu-item${active ? " active" : ""}`}
                    onClick={() => item.enabled && item.onClick?.()}
                    style={{ opacity: item.enabled ? 1 : 0.4, cursor: item.enabled ? "pointer" : "not-allowed" }}
                  >
                    {RAIL_ICONS[item.id]}
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <button className="left-rail-cta" onClick={onResetSoft}>
              + Neuer Report
            </button>
          </aside>
        ) : null}

        <div className="content-shell">
          <header className="top-strip">
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {!isDesktopShell ? <BMGBadge size={26} /> : null}
              <div className="top-strip-title">
                Scout<span style={{ color: C.green }}>X</span>
              </div>
            </div>

            <StepNav
              currentStep={currentStep}
              canAccessGames={games.length > 0}
              canAccessPlan={Boolean(plan)}
              onStepChange={onStepChange}
              isMobile={isMobile}
            />

            <div className="top-strip-actions">
              <div className="icon-dot">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div className="icon-dot">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>
            </div>
          </header>

          <ScoutXProvider value={contextValue}>
            <main className="workspace">
              {err ? (
                <div
                  className="fu"
                  style={{
                    background: C.errorDim,
                    border: `1px solid rgba(239,68,68,0.2)`,
                    borderRadius: 12,
                    padding: "12px 16px",
                    color: "#fca5a5",
                    fontSize: 13,
                    marginBottom: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>{err}</span>
                  </div>
                  <span onClick={() => setErr("")} style={{ cursor: "pointer", fontSize: 18, lineHeight: 1, color: C.gray, padding: 4 }}>
                    x
                  </span>
                </div>
              ) : null}

              <Routes>
                <Route path="/setup" element={<SetupPage />} />

                <Route path="/games" element={games.length ? <GamesPage /> : <Navigate to="/setup" replace />} />

                <Route path="/plan" element={plan ? <PlanPage /> : <Navigate to={games.length ? "/games" : "/setup"} replace />} />

                <Route path="*" element={<Navigate to="/setup" replace />} />
              </Routes>
            </main>
          </ScoutXProvider>

          <footer
            style={{
              borderTop: `1px solid ${C.border}`,
              padding: "16px 24px",
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: C.grayDark,
                letterSpacing: "0.5px",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                fontWeight: 500,
              }}
            >
              ScoutX v1.0
            </span>
          </footer>
        </div>
      </div>
    </>
  );
}
