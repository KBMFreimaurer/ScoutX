import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useWindowWidth } from "../hooks/useWindowWidth";
import { KREISE } from "../data/kreise";
import { JUGEND_KLASSEN } from "../data/altersklassen";
import { parseUploadedGamesReport } from "../services/dataProvider";
import { normalizeAdapterEndpoint, normalizeTeamParameters } from "./shared";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const SetupContext = createContext(null);

export function SetupProvider({ children, defaultAdapterEndpoint }) {
  const [setupDefaults] = useState(() => {
    const todayIso = new Date().toISOString().split("T")[0];
    return {
      kreisId: "",
      jugendId: "",
      selTeams: [],
      fromDate: todayIso,
      focus: "",
      dataMode: "auto",
      adapterEndpoint: normalizeAdapterEndpoint(defaultAdapterEndpoint, defaultAdapterEndpoint),
      todayIso,
    };
  });

  const width = useWindowWidth();
  const isMobile = width < 600;

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
  const [err, setErr] = useState("");

  const kreis = useMemo(() => KREISE.find((item) => item.id === kreisId), [kreisId]);
  const jugend = useMemo(() => JUGEND_KLASSEN.find((item) => item.id === jugendId), [jugendId]);
  const activeTeams = useMemo(() => normalizeTeamParameters(selectedTeams), [selectedTeams]);
  const canBuild = Boolean(kreisId && jugendId);

  const clearErr = useCallback(() => setErr(""), []);

  const onSelectKreis = useCallback((id) => {
    setKreisId(id);
    setSelectedTeams([]);
    setTeamDraft("");
    setTeamValidation(null);
    setErr("");
    setUploadError("");
    setUploadSummary(null);
  }, []);

  const onSelectJugend = useCallback((id) => {
    setJugendId(id);
    setTeamValidation(null);
    setErr("");
    setUploadError("");
    setUploadSummary(null);
  }, []);

  const onClearAllTeams = useCallback(() => {
    setSelectedTeams([]);
    setTeamValidation(null);
  }, []);

  const onAddTeamField = useCallback((value = teamDraft) => {
    const team = String(value || "").trim();
    if (!team) {
      return;
    }

    setSelectedTeams((prev) => normalizeTeamParameters([...prev, team]));
    setTeamDraft("");
    setTeamValidation(null);
  }, [teamDraft]);

  const onUpdateTeamField = useCallback((index, value) => {
    setSelectedTeams((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setTeamValidation(null);
  }, []);

  const onNormalizeTeamField = useCallback(() => {
    setSelectedTeams((prev) => normalizeTeamParameters([...prev]));
    setTeamValidation(null);
  }, []);

  const onRemoveTeamField = useCallback((index) => {
    setSelectedTeams((prev) => prev.filter((_, idx) => idx !== index));
    setTeamValidation(null);
  }, []);

  const onFileImport = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadError("");
    setUploadSummary(null);

    try {
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error("Datei ist zu groß. Maximal 5 MB erlaubt.");
      }

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
      setTeamValidation(null);
    } catch (error) {
      setUploadedGames([]);
      setUploadName("");
      setUploadError(error.message || "Datei konnte nicht verarbeitet werden.");
      setUploadSummary(null);
    }
  }, [kreisId, jugendId, fromDate, jugend?.turnier]);

  const resetSetupState = useCallback(() => {
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
    setAdapterEndpoint(defaultAdapterEndpoint);
    setAdapterToken("");
    setFromDate(setupDefaults.todayIso);
    setFocus("");
    setErr("");
  }, [defaultAdapterEndpoint, setupDefaults.todayIso]);

  const value = useMemo(
    () => ({
      isMobile,
      width,
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
      adapterEndpoint,
      adapterToken,
      uploadedGames,
      uploadName,
      uploadError,
      uploadSummary,
      canBuild,
      err,
      setErr,
      clearErr,
      setTeamValidation,
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
      resetSetupState,
    }),
    [
      isMobile,
      width,
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
      adapterEndpoint,
      adapterToken,
      uploadedGames,
      uploadName,
      uploadError,
      uploadSummary,
      canBuild,
      err,
      clearErr,
      onSelectKreis,
      onSelectJugend,
      onAddTeamField,
      onUpdateTeamField,
      onNormalizeTeamField,
      onRemoveTeamField,
      onClearAllTeams,
      onFileImport,
      resetSetupState,
    ],
  );

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup() {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error("useSetup muss innerhalb von SetupProvider verwendet werden.");
  }
  return context;
}
