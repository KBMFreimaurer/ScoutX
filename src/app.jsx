import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BMGBadge } from "./components/BMGBadge";
import { StepNav } from "./components/StepNav";
import { ScoutPlanProvider } from "./context/ScoutPlanContext";
import { C, GCSS } from "./styles/theme";
import { useWindowWidth } from "./hooks/useWindowWidth";
import { KREISE, VEREINE_JE_KREIS } from "./data/kreise";
import { JUGEND_KLASSEN } from "./data/altersklassen";
import { fetchGamesWithProviders, parseUploadedGamesReport } from "./services/dataProvider";
import { callLLM, testConnection } from "./services/llm";
import { STORAGE_KEYS, LLM_PRESETS } from "./data/constants";
import { SetupPage } from "./pages/SetupPage";
import { GamesPage } from "./pages/GamesPage";
import { PlanPage } from "./pages/PlanPage";

const DEFAULT_ADAPTER_ENDPOINT = import.meta.env.VITE_ADAPTER_ENDPOINT || "/api/games";

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

function readSessionValue(key, fallback = "") {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    return window.sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function isLocalHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
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
  const endpointIsLocal = /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(endpoint);

  // Migrates older local-only defaults when app runs on a remote host.
  if (!appIsLocal && endpointIsLocal) {
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
    teamFilter: "",
    fromDate: todayIso,
    focus: "",
    dataMode: "auto",
    adapterEndpoint: DEFAULT_ADAPTER_ENDPOINT,
  });
  const setupDefaults = {
    ...storedSetup,
    adapterEndpoint: normalizeAdapterEndpoint(storedSetup.adapterEndpoint, DEFAULT_ADAPTER_ENDPOINT),
  };

  const llmDefaults = readStorage(STORAGE_KEYS.llm, {
    llmType: "qwen",
    llmModel: LLM_PRESETS.qwen.model,
    llmEndpoint: "/ollama",
    llmIsOllama: true,
    rememberApiKey: false,
  });

  const [kreisId, setKreisId] = useState(setupDefaults.kreisId);
  const [jugendId, setJugendId] = useState(setupDefaults.jugendId);
  const [selectedTeams, setSelectedTeams] = useState(setupDefaults.selTeams);
  const [teamFilter, setTeamFilter] = useState(setupDefaults.teamFilter);
  const [fromDate, setFromDate] = useState(setupDefaults.fromDate);
  const [focus, setFocus] = useState(setupDefaults.focus);
  const [dataMode, setDataMode] = useState(setupDefaults.dataMode);
  const [adapterEndpoint, setAdapterEndpoint] = useState(setupDefaults.adapterEndpoint);
  const [adapterToken, setAdapterToken] = useState("");
  const [uploadedGames, setUploadedGames] = useState([]);
  const [uploadName, setUploadName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadSummary, setUploadSummary] = useState(null);

  const [llmType, setLlmType] = useState(llmDefaults.llmType);
  const [llmModel, setLlmModel] = useState(llmDefaults.llmModel);
  const [llmEndpoint, setLlmEndpoint] = useState(llmDefaults.llmEndpoint);
  const [llmKey, setLlmKey] = useState(() => {
    if (llmDefaults.rememberApiKey) {
      return readStorage(STORAGE_KEYS.llm, {}).llmKey ?? "";
    }
    return readSessionValue(STORAGE_KEYS.llmSessionKey, "");
  });
  const [llmIsOllama, setLlmIsOllama] = useState(llmDefaults.llmIsOllama);
  const [rememberApiKey, setRememberApiKey] = useState(Boolean(llmDefaults.rememberApiKey));
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
  const allTeams = useMemo(() => VEREINE_JE_KREIS[kreisId] || [], [kreisId]);
  const activeTeams = selectedTeams.length > 0 ? selectedTeams : allTeams;

  const filteredTeams = useMemo(
    () => allTeams.filter((team) => team.toLowerCase().includes(teamFilter.toLowerCase())),
    [allTeams, teamFilter],
  );

  const prioritized = useMemo(() => [...games].sort((a, b) => b.priority - a.priority).slice(0, 5), [games]);

  const cfg = {
    kreisLabel: kreis?.label ?? "",
    jugendLabel: jugend?.label ?? "",
    jugendAlter: jugend?.alter ?? "",
    fromDate,
    focus,
  };

  const canBuild = Boolean(kreisId && jugendId && activeTeams.length >= 1);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEYS.setup,
      JSON.stringify({
        kreisId,
        jugendId,
        selTeams: selectedTeams,
        teamFilter,
        fromDate,
        focus,
        dataMode,
        adapterEndpoint,
      }),
    );
  }, [kreisId, jugendId, selectedTeams, teamFilter, fromDate, focus, dataMode, adapterEndpoint]);

  useEffect(() => {
    const safeLlmPayload = {
      llmType,
      llmModel,
      llmEndpoint,
      llmIsOllama,
      rememberApiKey,
    };

    if (rememberApiKey) {
      safeLlmPayload.llmKey = llmKey;
      window.sessionStorage.removeItem(STORAGE_KEYS.llmSessionKey);
    } else {
      window.sessionStorage.setItem(STORAGE_KEYS.llmSessionKey, llmKey);
    }

    window.localStorage.setItem(
      STORAGE_KEYS.llm,
      JSON.stringify(safeLlmPayload),
    );
  }, [llmType, llmModel, llmEndpoint, llmKey, llmIsOllama, rememberApiKey]);

  useEffect(() => {
    if (location.pathname === "/") {
      navigate("/setup", { replace: true });
    }
  }, [location.pathname, navigate]);

  const onSelectKreis = (id) => {
    setKreisId(id);
    setSelectedTeams([]);
    setTeamFilter("");
    setGames([]);
    setPlan("");
    setErr("");
    setUploadError("");
    setUploadSummary(null);
    navigate("/setup");
  };

  const onSelectJugend = (id) => {
    setJugendId(id);
    setGames([]);
    setPlan("");
    setErr("");
    setUploadError("");
    setUploadSummary(null);
    navigate("/setup");
  };

  const onToggleTeam = (teamName) => {
    setSelectedTeams((prev) => (prev.includes(teamName) ? prev.filter((name) => name !== teamName) : [...prev, teamName]));
  };

  const onRemoveTeam = (teamName) => {
    setSelectedTeams((prev) => prev.filter((name) => name !== teamName));
  };

  const onSelectAll = () => setSelectedTeams([...allTeams]);
  const onClearAll = () => setSelectedTeams([]);

  const onSelectFiltered = () => {
    const addList = filteredTeams.filter((team) => !selectedTeams.includes(team));
    setSelectedTeams((prev) => [...prev, ...addList]);
  };

  const onApplyPreset = (presetType) => {
    const preset = LLM_PRESETS[presetType];
    setLlmType(presetType);
    setLlmEndpoint(preset.endpoint);
    setLlmModel(preset.model);
    setLlmKey(preset.key);
    setLlmIsOllama(preset.isOllama);
    setConnStatus(null);
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

      if (result.models.length > 0 && !result.models.includes(llmModel)) {
        const qwenModel = result.models.find((modelName) => modelName.toLowerCase().includes("qwen"));
        setLlmModel(qwenModel || result.models[0]);
      }
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

    if (activeTeams.length < 1) {
      setErr("Mindestens 1 Mannschaft benötigt.");
      return;
    }

    setErr("");
    setLoadingGames(true);

    try {
      const weekRange = getWeekRange(fromDate);
      const { games: fetchedGames, source } = await fetchGamesWithProviders({
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
      setPlan("");
      navigate("/games");
    } catch (error) {
      setErr(`Spieldaten konnten nicht geladen werden: ${error.message}`);
    } finally {
      setLoadingGames(false);
    }
  };

  const onGenerateAI = async () => {
    setLoadingAI(true);
    setErr("");

    try {
      const isTurnier = jugend?.turnier ?? false;
      const allSorted = [...games].sort((a, b) => {
        const dateDelta = a.dateObj - b.dateObj;
        return dateDelta !== 0 ? dateDelta : a.time.localeCompare(b.time);
      });

      const spielListe = allSorted
        .map((game, index) => {
          const priorityText = game.priority >= 5 ? "[★ NLZ-relevant]" : game.priority >= 4 ? "[gehobenes Niveau]" : "";

          return `${index + 1}. ${game.dateLabel} ${game.time} Uhr — ${game.home} vs. ${game.away}\n   Spielort: ${
            game.venue
          } | Entfernung: ${game.km} km${priorityText ? ` | ${priorityText}` : ""}`;
        })
        .join("\n\n");

      const currentYear = new Date().getFullYear();
      const alterRange = jugend?.alter ?? "?";
      const [minAlter] = alterRange.split("–").map(Number);
      const jahrgang = Number.isNaN(minAlter) ? "unbekannt" : `${currentYear - minAlter - 1}/${currentYear - minAlter}`;

      const prompt = `Du bist ein professioneller Fußball-Scout-Analyst mit Fokus auf Jugendfußball im Gebiet Deutschland (insbesondere FVN / Niederrhein), tätig für das NLZ von Borussia Mönchengladbach.

## KONTEXT
Kreis: ${kreis?.label} (FVN Niederrhein)
Altersklasse: ${jugend?.label} — Jahrgang ca. ${jahrgang} (${jugend?.alter} Jahre)${isTurnier ? " — TURNIERFORMAT (kein klassisches Heim/Auswärts)" : ""}
Scout-Fokus: ${focus || "Allgemein — Talente, Spielstärke, taktisches Niveau"}
Scouting-Datum: ab ${fromDate}

## SPIELLISTE (${allSorted.length} ${isTurnier ? "Turnierbegegnungen" : "Spiele"})

${spielListe}

---

## AUFGABEN

### 1. VALIDIERUNG
Bewerte für jedes Spiel:
- Altersklasse plausibel für ${jugend?.label}? (Ja / Unsicher / Nicht eindeutig zuordenbar)
- Wettbewerbsniveau einschätzen (z. B. Kreisklasse, Kreisleistungsklasse, Niederrheinliga)
- ${isTurnier ? "Turnier-Besonderheiten (Spielzeit, Format)" : "Heim/Auswärts-Vorteil relevant?"}
- Spiele mit [★ NLZ-relevant] besonders prüfen

### 2. SCOUTING-BEWERTUNG
Ranke die TOP 5 Spiele nach Relevanz für NLZ-Scouting (Borussia Mönchengladbach):

Kriterien (absteigend gewichtet):
1. Vereinsniveau & Nachwuchsarbeit (NLZ-Nachwuchs > Kreisverein)
2. Wettbewerbsklasse (Leistungsklasse > Kreisklasse)
3. Gegnerqualität
4. Jahrgangsreinheit (${jugend?.label} exakt vs. gemischt)
5. Entfernung (kurze Fahrt bevorzugt)

Ausgabe je Spiel:
- Rang + Spiel
- Begründung (2–3 Sätze)
- Kennzeichnung: "wahrscheinlich ${jahrgang.split("/")[0]}-lastig" / "gemischt" / "unklar"

### 3. ROUTENPLAN (MAX. 3 SPIELE)
Erstelle den optimalen Scouting-Tag:
- Realistische Fahrtzeiten zwischen Spielorten berücksichtigen
- Mind. 45 Minuten Anwesenheit pro Spiel einplanen
- Qualität > Quantität

Format:
SCOUTING PLAN
---
[Uhrzeit] — [Spiel] | [Spielort]
[Uhrzeit] — [Spiel] | [Spielort]
[Uhrzeit] — [Spiel] | [Spielort]
+ Kurze Begründung der Route

### 4. BEOBACHTUNGSPUNKTE
Altersgerechte Schwerpunkte für ${jugend?.label} (${jugend?.alter} Jahre):
${
  focus && focus !== "Allgemein – Talente und Spielstärke"
    ? `Fokus auf: ${focus}\nZusätzlich allgemeine Beobachtungspunkte für diese Altersklasse.`
    : `Allgemeine Talentmerkmale für diese Altersklasse am Niederrhein.`
}

---

## REGELN
- Keine Spekulationen, keine erfundenen Daten
- Wenn Wettbewerb unklar → explizit kennzeichnen
- ${
        isTurnier
          ? "Turnierspiele: Spielzeit oft kürzer (z. B. 2×15 Min.) — Beobachtungszeit entsprechend anpassen"
          : "Kinderfestivals oder Freundschaftsspiele separat kennzeichnen falls erkennbar"
      }
- Antwort strukturiert, faktenbasiert, scouting-orientiert, ohne unnötigen Text
- Sprache: Deutsch`;

      const result = await callLLM({
        endpoint: llmEndpoint,
        isOllama: llmIsOllama,
        model: llmModel,
        apiKey: llmKey,
        prompt,
      });

      setPlan(result);
      navigate("/plan");
    } catch (error) {
      setErr(`LLM Fehler: ${error.message}`);
    } finally {
      setLoadingAI(false);
    }
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
    setTeamFilter("");
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

  const contextValue = {
    isMobile,
    currentStep,
    kreisId,
    jugendId,
    kreis,
    jugend,
    allTeams,
    selectedTeams,
    activeTeams,
    filteredTeams,
    teamFilter,
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
    onToggleTeam,
    onRemoveTeam,
    onSelectAll,
    onClearAll,
    onSelectFiltered,
    onSetTeamFilter: setTeamFilter,
    onSetFromDate: setFromDate,
    onSetFocus: setFocus,
    onDataModeChange: setDataMode,
    onAdapterEndpointChange: setAdapterEndpoint,
    onAdapterTokenChange: setAdapterToken,
    onApplyPreset,
    onSetLlmModel: (value) => {
      setLlmModel(value);
      setConnStatus(null);
    },
    onSetLlmEndpoint: (value) => {
      setLlmEndpoint(value);
      setConnStatus(null);
    },
    onSetLlmKey: (value) => {
      setLlmKey(value);
      setConnStatus(null);
    },
    onSetRememberApiKey: setRememberApiKey,
    onToggleLlmProtocol: () => {
      setLlmIsOllama((prev) => !prev);
      setConnStatus(null);
    },
    onFileImport,
    onTestConnection,
    onBuildAndGo,
    onGenerateAI,
    onBackSetup,
    onBackGames,
    onResetSoft,
    onResetHard,
  };

  return (
    <>
      <style>{GCSS}</style>

      <div style={{ minHeight: "100vh", background: C.bg, color: C.offWhite, fontFamily: "'Barlow', sans-serif" }}>
        <header
          style={{
            background: "#111",
            borderBottom: `3px solid ${C.green}`,
            padding: isMobile ? "0 16px" : "0 28px",
            position: "sticky",
            top: 0,
            zIndex: 20,
            boxShadow: "0 2px 20px rgba(0,135,62,0.15)",
          }}
        >
          <div
            style={{
              maxWidth: 900,
              margin: "0 auto",
              height: isMobile ? 56 : 64,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ flexShrink: 0 }}>
              <BMGBadge size={isMobile ? 38 : 46} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 900,
                  fontSize: isMobile ? 18 : 22,
                  color: C.white,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  lineHeight: 1,
                }}
              >
                Scout<span style={{ color: C.green }}>Plan</span>
              </div>
              <div
                className="header-sub"
                style={{
                  fontSize: 10,
                  color: C.gray,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 600,
                }}
              >
                Borussia Mönchengladbach · FVN Scouting
              </div>
            </div>

            <StepNav
              currentStep={currentStep}
              canAccessGames={games.length > 0}
              canAccessPlan={Boolean(plan)}
              onStepChange={onStepChange}
              isMobile={isMobile}
            />
          </div>
        </header>

        {currentStep === "setup" ? (
          <div
            style={{
              background: `linear-gradient(135deg, ${C.greenDark} 0%, #003020 50%, #111 100%)`,
              borderBottom: `1px solid ${C.greenDark}`,
              padding: isMobile ? "20px 16px" : "24px 28px",
            }}
          >
            <div style={{ maxWidth: 900, margin: "0 auto" }}>
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 900,
                  fontSize: isMobile ? 26 : 36,
                  color: C.white,
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  lineHeight: 1.1,
                  marginBottom: 6,
                }}
              >
                Jugend-Spielplan
                <br />
                <span style={{ color: C.green }}>Niederrhein</span>
              </div>

              <div style={{ fontSize: 13, color: "#aaa", fontFamily: "'Barlow', sans-serif" }}>
                FVN · KI-gestützter Scouting-Assistent · Kreise am Niederrhein
              </div>
            </div>
          </div>
        ) : null}

        <ScoutPlanProvider value={contextValue}>
          <main style={{ maxWidth: 900, margin: "0 auto", padding: isMobile ? "16px 12px" : "24px 20px" }}>
            {err ? (
              <div
                style={{
                  background: C.errorDim,
                  border: `1px solid ${C.error}`,
                  borderRadius: 6,
                  padding: "10px 14px",
                  color: "#ff8080",
                  fontSize: 13,
                  marginBottom: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "'Barlow', sans-serif",
                }}
              >
                <span style={{ flex: 1 }}>⚠ {err}</span>
                <span onClick={() => setErr("")} style={{ cursor: "pointer", fontSize: 20, lineHeight: 1, color: C.gray }}>
                  ×
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
        </ScoutPlanProvider>

        <footer
          style={{
            borderTop: `1px solid ${C.border}`,
            padding: "16px 20px",
            marginTop: 20,
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <BMGBadge size={22} />
            <span
              style={{
                fontSize: 11,
                color: C.grayDark,
                letterSpacing: "1px",
                fontFamily: "'Barlow Condensed',sans-serif",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              ScoutPlan · Borussia Mönchengladbach · FVN Niederrhein
            </span>
          </div>
        </footer>
      </div>
    </>
  );
}
