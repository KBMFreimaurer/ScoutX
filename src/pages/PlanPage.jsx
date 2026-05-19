import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GhostButton } from "../components/Buttons";
import { GameCards } from "../components/GameCards";
import { GameTable } from "../components/GameTable";
import { PDFExport } from "../components/PDFExport";
import { PlanView } from "../components/PlanView";
import { FahrtkostenTabelle } from "../components/FahrtkostenTabelle";
import { HrworksImportReviewModal } from "../components/HrworksImportReviewModal";
import { SectionHeader } from "../components/SectionHeader";
import { STORAGE_KEYS } from "../config/storage";
import { useScoutX } from "../context/ScoutXContext";
import { isNativeCapacitorRuntime } from "../native/deepLinks";
import { checkPlanConsistency, isAdapterSyncContext } from "../services/liveConsistency";
import {
  appendHrworksImportLog,
  buildHrworksImportPayload,
  readHrworksImportLog,
  validateHrworksImportPayload,
} from "../services/hrworksImport";
import { exportHrworksImportCsv } from "../services/hrworksCsvExport";
import { parseHrworksTimesheetFile, validateHrworksTimesheetFile } from "../services/hrworksExcelParser";
import { exportHrworksAuditLog } from "../services/hrworksAuditExport";
import {
  advanceAutomationStep,
  canCaptureDebugScreenshot,
  canProceedAutomation,
  createAutomationRuntimeSession,
  failAutomationSession,
} from "../services/hrworksAutomationRuntime";
import {
  readHrworksSelectorMapping,
  validateHrworksSelectorMapping,
  writeHrworksSelectorMapping,
} from "../services/hrworksSelectorMapping";
import {
  getAllowedHrworksPolicyValues,
  getMissingHrworksOperationalDecisions,
  readHrworksPolicy,
  writeHrworksPolicy,
} from "../services/hrworksPolicy";
import { C } from "../styles/theme";
import { normalizePresenceMinutes } from "../utils/arbeitszeit";
import { downloadCalendarIcs } from "../utils/calendar";
import { formatDistanceKm } from "../utils/geo";

const HRWORKS_STEP_LABELS = {
  open_hrworks: "HRworks öffnen",
  wait_for_login: "Login prüfen",
  open_travel_management: "Reisemanagement öffnen",
  open_new_expense: "Neue Reisekostenanlage öffnen",
  fill_form: "Formular vorbefüllen",
  save_without_destination: "Daten vorbereiten",
  save_kilometers: "Kilometer erfassen",
  process_route: "Route verarbeiten",
  complete_reports: "Prüfungen abschließen",
  review_prefill: "Vorbefüllung prüfen",
  confirm_save: "Speicherung bestätigen",
  save: "Speichern",
  done: "Abgeschlossen",
};
const HRWORKS_SMART_DEFAULTS_KEY = "scoutx.hrworksSmartDefaults.v1";

function normalizePresenceMap(rawValue) {
  const source = rawValue && typeof rawValue === "object" ? rawValue : {};
  return Object.entries(source).reduce((acc, [key, value]) => {
    const id = String(key || "").trim();
    const minutes = normalizePresenceMinutes(value);
    if (id && Number.isFinite(minutes)) {
      acc[id] = minutes;
    }
    return acc;
  }, {});
}

function isSamePresenceMap(left, right) {
  const leftKeys = Object.keys(left || {}).sort();
  const rightKeys = Object.keys(right || {}).sort();
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (let index = 0; index < leftKeys.length; index += 1) {
    const leftKey = leftKeys[index];
    const rightKey = rightKeys[index];
    if (leftKey !== rightKey) {
      return false;
    }
    if (Number(left[leftKey]) !== Number(right[rightKey])) {
      return false;
    }
  }

  return true;
}

function confirmAction(message) {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return true;
  }

  try {
    return window.confirm(message);
  } catch {
    return true;
  }
}

function pickDateFromOptions(options) {
  const values = Array.isArray(options) ? options.map((item) => String(item || "").trim()).filter(Boolean) : [];
  if (values.length <= 1 || typeof window === "undefined" || typeof window.prompt !== "function") {
    return values[0] || "";
  }
  const selection = window.prompt(
    [
      "Mehrere Arbeitstage erkannt. Bitte Datum für den Import wählen (YYYY-MM-DD):",
      values.join(", "),
    ].join("\n"),
    values[0],
  );
  const normalized = String(selection || "").trim();
  return values.includes(normalized) ? normalized : values[0];
}

function readHrworksSmartDefaults() {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(HRWORKS_SMART_DEFAULTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeHrworksSmartDefaults(nextValue) {
  if (typeof window === "undefined") {
    return;
  }
  const safeValue = nextValue && typeof nextValue === "object" ? nextValue : {};
  window.localStorage.setItem(HRWORKS_SMART_DEFAULTS_KEY, JSON.stringify(safeValue));
}

export function PlanPage() {
  const {
    games,
    plannedGames,
    plan,
    kreis,
    kreisLabel,
    kreisIds,
    kreisId,
    jugend,
    jugendId,
    activeTeams,
    dataSourceUsed,
    adapterEndpoint,
    adapterToken,
    fromDate,
    toDate,
    isMobile,
    cfg,
    routeOverview,
    routeCalculating,
    planHistory,
    activeHistoryEntry,
    startLocation,
    scoutName,
    kmPauschale,
    setGames,
    setErr,
    onOpenPlanHistory,
    onDeletePlanHistory,
    onClearPlanHistory,
    onUpdatePlanHistoryPresence,
    onUpdatePlanHistoryGames,
    onBackGames,
    onResetSoft,
    onResetHard,
  } = useScoutX();
  const hasManualSelection = Array.isArray(plannedGames) && plannedGames.length > 0;
  const usePinnedActionDock = isMobile || isNativeCapacitorRuntime();
  const useStackedTopActions = usePinnedActionDock;
  const actionDockRef = useRef(null);
  const hrworksFileInputRef = useRef(null);
  const [dockReservePx, setDockReservePx] = useState(null);
  const activeGames = useMemo(() => {
    if (hasManualSelection) {
      return plannedGames;
    }
    return Array.isArray(games) ? games : [];
  }, [hasManualSelection, plannedGames, games]);
  const PAGE_SIZE = 20;
  const shouldPaginate = activeGames.length > 100;
  const totalPages = shouldPaginate ? Math.ceil(activeGames.length / PAGE_SIZE) : 1;
  const [currentPage, setCurrentPage] = useState(1);
  const [kmOverrides, setKmOverrides] = useState({});
  const [consistencyChecking, setConsistencyChecking] = useState(false);
  const [consistencyResult, setConsistencyResult] = useState(null);
  const [hrworksReviewOpen, setHrworksReviewOpen] = useState(false);
  const [hrworksPayload, setHrworksPayload] = useState(null);
  const [hrworksValidation, setHrworksValidation] = useState({ errors: [], warnings: [] });
  const [hrworksRuntimeSession, setHrworksRuntimeSession] = useState(null);
  const [hrworksImportLog, setHrworksImportLog] = useState(() => readHrworksImportLog());
  const [hrworksSelectorMapping, setHrworksSelectorMapping] = useState(() => readHrworksSelectorMapping());
  const [hrworksPolicy, setHrworksPolicy] = useState(() => readHrworksPolicy());
  const [hrworksDebugScreenshotConsent, setHrworksDebugScreenshotConsent] = useState(false);
  const [hrworksLoginConfirmed, setHrworksLoginConfirmed] = useState(false);
  const missingHrworksDecisions = useMemo(
    () => getMissingHrworksOperationalDecisions(hrworksPolicy),
    [hrworksPolicy],
  );
  const [presenceMinutesByGame, setPresenceMinutesByGame] = useState(() => {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEYS.presence);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return {};
      }

      return normalizePresenceMap(parsed);
    } catch {
      return {};
    }
  });
  const historyEntries = useMemo(() => (Array.isArray(planHistory) ? planHistory : []), [planHistory]);
  const activeHistoryMeta = activeHistoryEntry?.meta && typeof activeHistoryEntry.meta === "object" ? activeHistoryEntry.meta : null;

  const handleClearPlanHistory = () => {
    const shouldClear = confirmAction("Plan-Historie wirklich vollständig löschen?");
    if (!shouldClear) {
      return;
    }
    onClearPlanHistory();
  };

  const handleDeletePlanHistory = (entryId) => {
    const shouldDelete = confirmAction("Diesen historischen Plan wirklich entfernen?");
    if (!shouldDelete) {
      return;
    }
    onDeletePlanHistory(entryId);
  };
  const displayJugendLabel = String(activeHistoryMeta?.jugendLabel || jugend?.label || "").trim();
  const displayKreisLabel = String(activeHistoryMeta?.kreisLabel || kreisLabel || kreis?.label || "").trim();
  const effectiveScoutName = String(activeHistoryMeta?.scoutName || scoutName || "").trim();
  const hrworksSmartDefaults = readHrworksSmartDefaults();
  const scoutDefaults = hrworksSmartDefaults[effectiveScoutName] && typeof hrworksSmartDefaults[effectiveScoutName] === "object"
    ? hrworksSmartDefaults[effectiveScoutName]
    : {};
  const effectiveKmPauschale = Number(activeHistoryMeta?.kmPauschale);
  const scopedHrworksLog = useMemo(() => {
    const activePlanId = String(activeHistoryEntry?.id || `${displayJugendLabel}-${displayKreisLabel}`).trim();
    return (Array.isArray(hrworksImportLog) ? hrworksImportLog : [])
      .filter((entry) => String(entry?.planId || "").trim() === activePlanId)
      .slice(0, 8);
  }, [activeHistoryEntry?.id, displayJugendLabel, displayKreisLabel, hrworksImportLog]);
  const kmPauschaleForPdf = Number.isFinite(effectiveKmPauschale) && effectiveKmPauschale > 0 ? effectiveKmPauschale : kmPauschale;
  const planSyncContext = activeHistoryEntry?.syncContext && typeof activeHistoryEntry.syncContext === "object"
    ? {
        source: "history",
        ...activeHistoryEntry.syncContext,
      }
    : null;
  const liveConsistencySyncContext = activeHistoryEntry?.syncContext && typeof activeHistoryEntry.syncContext === "object"
    ? activeHistoryEntry.syncContext
    : {
        source: dataSourceUsed,
        adapterEndpoint,
        adapterToken,
        kreisId,
        kreisIds,
        jugendId,
        fromDate,
        toDate,
        teams: activeTeams,
        turnier: Boolean(jugend?.turnier),
      };
  const canCheckConsistency = activeGames.length > 0 && isAdapterSyncContext(liveConsistencySyncContext);

  const handleKmChange = (gameId, newKm) =>
    setKmOverrides((prev) => {
      const next = { ...prev };
      if (newKm === null) {
        delete next[gameId];
      } else {
        next[gameId] = newKm;
      }
      return next;
    });
  const handlePresenceChange = (gameId, nextMinutes) => {
    const id = String(gameId ?? "").trim();
    if (!id) {
      return;
    }

    const normalized = normalizePresenceMinutes(nextMinutes);
    setPresenceMinutesByGame((prev) => {
      const next = { ...prev };
      if (Number.isFinite(normalized)) {
        next[id] = normalized;
      } else {
        delete next[id];
      }
      return next;
    });
  };

  const handleCheckConsistency = async () => {
    if (consistencyChecking || !canCheckConsistency) {
      return;
    }

    setErr("");
    setConsistencyChecking(true);

    try {
      const timeoutMs = Math.max(2000, Number(import.meta.env?.VITE_PLAN_CONSISTENCY_TIMEOUT_MS || 12000));
      const result = await checkPlanConsistency(activeGames, liveConsistencySyncContext, timeoutMs);

      if (result?.ok) {
        if (Array.isArray(result.games) && result.correctedCount > 0) {
          setGames(result.games);
          if (activeHistoryEntry?.id) {
            onUpdatePlanHistoryGames(activeHistoryEntry.id, result.games);
          }
        }
        setConsistencyResult(result);
      } else {
        setConsistencyResult(result || null);
      }
    } catch (error) {
      const message = String(error?.message || error || "Unbekannter Fehler");
      setErr(`Konsistenzprüfung fehlgeschlagen: ${message}`);
      setConsistencyResult(null);
    } finally {
      setConsistencyChecking(false);
    }
  };

  const handleOpenHrworksReview = () => {
    const importLog = readHrworksImportLog();
    const routePurpose = "Sichtung / Route des Arbeitstages";
    const routeLegs = Array.isArray(routeOverview?.legs)
      ? routeOverview.legs
          .map((leg, index) => {
            const from = String(leg?.from || "").trim();
            const to = String(leg?.to || "").trim();
            if (!from || !to) {
              return null;
            }
            return {
              id: `leg-${index}`,
              from,
              to,
              distanceKm: Number.isFinite(Number(leg?.distanceKm)) ? Number(leg.distanceKm) : null,
              durationMinutes: Number.isFinite(Number(leg?.durationMinutes)) ? Number(leg.durationMinutes) : null,
            };
          })
          .filter(Boolean)
      : [];
    const routeLabels = routeLegs.map((leg) => `${leg.from} -> ${leg.to}`);
    const payload = buildHrworksImportPayload({
      planId: activeHistoryEntry?.id || `${displayJugendLabel}-${displayKreisLabel}`,
      employeeName: effectiveScoutName,
      games: activeGames,
      startLocation: String(startLocation?.label || scoutDefaults.startLocation || cfg?.startLocationLabel || ""),
      costCenter: String(activeHistoryMeta?.costCenter || scoutDefaults.costCenter || hrworksPolicy.defaultCostCenter || "Junioren allgemein (321000)"),
      purpose: routePurpose,
      note: routePurpose,
      intermediateStops: routeLabels,
      routeLegs,
    });
    payload.importSource = "plan";
    payload.destinationLocation = "";
    payload.note = String(payload.purpose || routePurpose).trim();
    if (!String(payload.purpose || "").trim()) {
      payload.purpose = routePurpose;
    }
    const validation = validateHrworksImportPayload(payload, importLog, {
      requiredFields: hrworksPolicy.requiredFields,
    });
    const warnings = [];
    if (validation.duplicate) {
      warnings.push("Dieser Plan/Tag wurde vermutlich bereits importiert. Re-Import nur bewusst ausführen.");
    }

    setHrworksPayload(payload);
    setHrworksValidation({ errors: validation.errors, warnings });
    setHrworksLoginConfirmed(false);
    setHrworksReviewOpen(true);
  };

  const handleConfirmHrworksImport = () => {
    if (!hrworksPayload) {
      return;
    }
    if ((hrworksValidation?.errors?.length || 0) > 0) {
      return;
    }
    if (missingHrworksDecisions.length > 0) {
      appendHrworksImportLog({
        planId: hrworksPayload?.planId,
        date: hrworksPayload?.date,
        startTime: hrworksPayload?.startTime,
        endTime: hrworksPayload?.endTime,
        purpose: hrworksPayload?.purpose,
        hrworksStatus: "needs_review",
        sourceType: String(hrworksPayload?.importSource || "plan"),
        executedBy: hrworksPayload?.employeeName,
        technicalResult: "Import blockiert: fehlende Betriebsentscheidungen.",
        errorMessage: missingHrworksDecisions.join(" "),
      });
      setHrworksImportLog(readHrworksImportLog());
      setErr(`HRworks-Setup unvollständig: ${missingHrworksDecisions.join(" ")}`);
      return;
    }
    const hasDuplicateWarning = (hrworksValidation?.warnings || []).some((warning) => /bereits importiert/i.test(String(warning)));
    if (hasDuplicateWarning) {
      const confirmed = confirmAction("Für diesen Plan/Tag existiert bereits ein Import. Re-Import wirklich starten?");
      if (!confirmed) {
        appendHrworksImportLog({
          planId: hrworksPayload.planId,
          date: hrworksPayload.date,
          startTime: hrworksPayload.startTime,
          endTime: hrworksPayload.endTime,
          purpose: hrworksPayload.purpose,
          hrworksStatus: "skipped",
          sourceType: String(hrworksPayload.importSource || "plan"),
          executedBy: hrworksPayload.employeeName,
          technicalResult: "Re-Import vom Nutzer abgebrochen.",
        });
        return;
      }
    }

    const mappingValidation = validateHrworksSelectorMapping(hrworksSelectorMapping);
    const preflight = canProceedAutomation({
      isReachable: true,
      isLoggedIn: hrworksLoginConfirmed === true,
      mappingReady: mappingValidation.ok,
      requireSaveConfirmation: hrworksPolicy.requireSaveConfirmation === true,
    });
    if (!preflight.ok) {
      appendHrworksImportLog({
        planId: hrworksPayload.planId,
        date: hrworksPayload.date,
        startTime: hrworksPayload.startTime,
        endTime: hrworksPayload.endTime,
        purpose: hrworksPayload.purpose,
        hrworksStatus: "failed",
        sourceType: String(hrworksPayload.importSource || "plan"),
        executedBy: hrworksPayload.employeeName,
        technicalResult: "Automation-Preflight fehlgeschlagen.",
        errorMessage: preflight.failures.map((failure) => failure.message).join(" | "),
      });
      setHrworksImportLog(readHrworksImportLog());
      setErr(preflight.failures.map((failure) => failure.message).join(" "));
      return;
    }

    const sessionCreated = createAutomationRuntimeSession(hrworksPayload);
    const sessionRunning = advanceAutomationStep(sessionCreated, "save_without_destination");
    setHrworksRuntimeSession(sessionRunning);

    appendHrworksImportLog({
      planId: hrworksPayload.planId,
      date: hrworksPayload.date,
      startTime: hrworksPayload.startTime,
      endTime: hrworksPayload.endTime,
      purpose: hrworksPayload.purpose,
      hrworksStatus: "ready",
      sourceType: String(hrworksPayload.importSource || "plan"),
      executedBy: hrworksPayload.employeeName,
      technicalResult: "Review bestätigt; Runtime gestartet.",
    });
    setHrworksImportLog(readHrworksImportLog());

    setHrworksReviewOpen(false);
    setHrworksLoginConfirmed(false);
    setErr("HRworks-Runtime gestartet. Bitte Login und finale Bestätigung im Browser durchführen.");
  };

  const handleHrworksExportOnly = async () => {
    if (!hrworksPayload) {
      return;
    }
    try {
      await exportHrworksImportCsv(hrworksPayload);
    } catch (error) {
      appendHrworksImportLog({
        planId: hrworksPayload.planId,
        date: hrworksPayload.date,
        startTime: hrworksPayload.startTime,
        endTime: hrworksPayload.endTime,
        purpose: hrworksPayload.purpose,
        hrworksStatus: "failed",
        sourceType: String(hrworksPayload.importSource || "plan"),
        executedBy: hrworksPayload.employeeName,
        technicalResult: "CSV-Export fehlgeschlagen.",
        errorMessage: String(error?.message || error || "Unbekannter Exportfehler"),
      });
      setErr("CSV-Export fehlgeschlagen. Bitte erneut versuchen.");
      return;
    }
    appendHrworksImportLog({
      planId: hrworksPayload.planId,
      date: hrworksPayload.date,
      startTime: hrworksPayload.startTime,
      endTime: hrworksPayload.endTime,
      purpose: hrworksPayload.purpose,
      hrworksStatus: "needs_review",
      sourceType: String(hrworksPayload.importSource || "plan"),
      executedBy: hrworksPayload.employeeName,
      technicalResult: "Nur Exportdatei erstellt (Import nicht gestartet).",
    });
    setHrworksImportLog(readHrworksImportLog());
    setHrworksReviewOpen(false);
    setHrworksLoginConfirmed(false);
    setErr("Exportmodus gewählt: Bitte Exportdatei an HRworks-Importprozess übergeben.");
  };

  const handleHrworksDryRun = () => {
    if (!hrworksPayload) {
      return;
    }
    appendHrworksImportLog({
      planId: hrworksPayload.planId,
      date: hrworksPayload.date,
      startTime: hrworksPayload.startTime,
      endTime: hrworksPayload.endTime,
      purpose: hrworksPayload.purpose,
      hrworksStatus: "needs_review",
      sourceType: String(hrworksPayload.importSource || "plan"),
      executedBy: hrworksPayload.employeeName,
      technicalResult: "Testlauf ohne Speichern bestätigt.",
    });
    setHrworksImportLog(readHrworksImportLog());
    setHrworksReviewOpen(false);
    setHrworksLoginConfirmed(false);
    setErr("HRworks-Testlauf markiert. Produktives Speichern wurde nicht ausgelöst.");
  };

  const handleFailRuntimeSession = (message) => {
    if (!hrworksRuntimeSession) {
      return;
    }
    const failed = failAutomationSession(hrworksRuntimeSession, "SAVE_FAILED", message);
    setHrworksRuntimeSession(failed);
    appendHrworksImportLog({
      planId: hrworksPayload?.planId,
      date: hrworksPayload?.date,
      startTime: hrworksPayload?.startTime,
      endTime: hrworksPayload?.endTime,
      purpose: hrworksPayload?.purpose,
      hrworksStatus: "failed",
      sourceType: String(hrworksPayload?.importSource || "plan"),
      executedBy: hrworksPayload?.employeeName,
      technicalResult: "Runtime-Session fehlgeschlagen.",
      errorMessage: message,
    });
    setHrworksImportLog(readHrworksImportLog());
  };

  const handleCompleteRuntimeSession = () => {
    if (!hrworksRuntimeSession) {
      return;
    }

    const doneSession = advanceAutomationStep(hrworksRuntimeSession, "done");
    const hrworksReference = typeof window !== "undefined" && typeof window.prompt === "function"
      ? String(window.prompt("Optionale HRworks-Referenz (z. B. Beleg-/Vorgangsnummer):", "") || "").trim()
      : "";
    setHrworksRuntimeSession(doneSession);
    appendHrworksImportLog({
      planId: hrworksPayload?.planId,
      date: hrworksPayload?.date,
      startTime: hrworksPayload?.startTime,
      endTime: hrworksPayload?.endTime,
      purpose: hrworksPayload?.purpose,
      hrworksStatus: "imported",
      sourceType: String(hrworksPayload?.importSource || "plan"),
      executedBy: hrworksPayload?.employeeName,
      technicalResult: `Runtime-Session ${doneSession?.id || "n/a"} als importiert abgeschlossen.`,
      hrworksReference,
    });
    setHrworksImportLog(readHrworksImportLog());
    setErr("HRworks-Import als erfolgreich abgeschlossen markiert.");
    if (effectiveScoutName) {
      const nextDefaults = {
        ...readHrworksSmartDefaults(),
        [effectiveScoutName]: {
          costCenter: String(hrworksPayload?.costCenter || ""),
          startLocation: String(hrworksPayload?.departureLocation || ""),
        },
      };
      writeHrworksSmartDefaults(nextDefaults);
    }
  };

  const handleFinalizeRuntimeSession = () => {
    const success = confirmAction("Konnte der Import in HRworks erfolgreich abgeschlossen werden?");
    if (success) {
      handleCompleteRuntimeSession();
      return;
    }
    handleFailRuntimeSession("Nutzer meldet Abschlussproblem nach Runtime.");
  };

  const handlePickHrworksFile = () => {
    hrworksFileInputRef.current?.click();
  };

  const handleHrworksFileChange = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) {
      return;
    }
    const fileValidation = validateHrworksTimesheetFile(file);
    if (!fileValidation.ok) {
      setErr(fileValidation.message);
      if (event?.target) {
        event.target.value = "";
      }
      return;
    }

    let parsed = null;
    try {
      parsed = await parseHrworksTimesheetFile(file);
    } catch (error) {
      setErr(`Arbeitszeitdatei konnte nicht gelesen werden: ${String(error?.message || error || "Unbekannter Fehler")}`);
      return;
    } finally {
      if (event?.target) {
        event.target.value = "";
      }
    }

    if (!Array.isArray(parsed.entries) || parsed.entries.length === 0) {
      setErr(parsed.warnings?.[0] || "Keine verwertbaren Arbeitszeitdaten gefunden.");
      return;
    }

    const availableDates = Array.from(new Set(parsed.entries.map((entry) => String(entry?.date || "").trim()).filter(Boolean)));
    const gameDates = Array.from(
      new Set(
        activeGames
          .map((game) => {
            const raw = game?.dateObj || game?.date;
            const date = raw instanceof Date ? raw : new Date(raw);
            return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
          })
          .filter(Boolean),
      ),
    );
    const autoSelectedDate = gameDates.find((date) => availableDates.includes(date)) || "";
    let selectedDate = autoSelectedDate || "";
    const hasMultipleDates = availableDates.length > 1;
    if (!selectedDate) {
      selectedDate = pickDateFromOptions(availableDates);
    }
    const sameDateEntries = parsed.entries.filter((entry) => entry.date === selectedDate);
    const totalHours = Number(sameDateEntries.reduce((acc, entry) => acc + Number(entry.workHours || 0), 0).toFixed(2));
    const startTime = sameDateEntries.map((entry) => String(entry.startTime || "")).sort()[0] || "";
    const endTime = sameDateEntries.map((entry) => String(entry.endTime || "")).sort().slice(-1)[0] || "";
    const purpose = "Sichtung / Route des Arbeitstages";
    const note = purpose;
    const employeeName = sameDateEntries[0]?.employeeName || effectiveScoutName;
    const routeLegs = Array.isArray(routeOverview?.legs)
      ? routeOverview.legs
          .map((leg, index) => {
            const from = String(leg?.from || "").trim();
            const to = String(leg?.to || "").trim();
            if (!from || !to) {
              return null;
            }
            return {
              id: `leg-${index}`,
              from,
              to,
              distanceKm: Number.isFinite(Number(leg?.distanceKm)) ? Number(leg.distanceKm) : null,
              durationMinutes: Number.isFinite(Number(leg?.durationMinutes)) ? Number(leg.durationMinutes) : null,
            };
          })
          .filter(Boolean)
      : [];
    const payload = {
      planId: activeHistoryEntry?.id || `${displayJugendLabel}-${displayKreisLabel}-${selectedDate}`,
      employeeName,
      date: selectedDate,
      startTime,
      endTime,
      breakStart: sameDateEntries[0]?.breakStart || "",
      breakEnd: sameDateEntries[0]?.breakEnd || "",
      workHours: totalHours,
      purpose,
      note,
      departureLocation: String(startLocation?.label || scoutDefaults.startLocation || cfg?.startLocationLabel || ""),
      destinationLocation: "",
      intermediateStops: routeLegs.map((leg) => `${leg.from} -> ${leg.to}`),
      routeLegs,
      costCenter: String(activeHistoryMeta?.costCenter || scoutDefaults.costCenter || hrworksPolicy.defaultCostCenter || "Junioren allgemein (321000)"),
      travelExpenseRequired: true,
      receiptsRequired: false,
      sourceGames: activeGames,
      status: "draft",
      importSource: "timesheet",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const importLog = readHrworksImportLog();
    const validation = validateHrworksImportPayload(payload, importLog, {
      requiredFields: hrworksPolicy.requiredFields,
    });
    const warnings = [...(parsed.warnings || [])];
    if (!String(payload.purpose || "").trim()) {
      payload.purpose = purpose;
      warnings.push("Zweck wurde automatisch ergänzt.");
    }
    if (!String(payload.note || "").trim()) {
      payload.note = String(payload.purpose || purpose);
      warnings.push("Bemerkung wurde automatisch ergänzt.");
    }
    if (parsed.entries.some((entry) => entry.date !== selectedDate)) {
      warnings.push(`Datei enthält mehrere Tage; für den Import wurde ${selectedDate} verwendet.`);
    }
    if (hasMultipleDates) {
      const runBatch = typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm("Mehrere Tage erkannt. Batch-Vorbereitung für alle Tage in die Historie schreiben?")
        : false;
      if (runBatch) {
        for (const date of availableDates) {
          const entriesForDate = parsed.entries.filter((entry) => entry.date === date);
          const dateHours = Number(entriesForDate.reduce((acc, entry) => acc + Number(entry.workHours || 0), 0).toFixed(2));
          appendHrworksImportLog({
            planId: activeHistoryEntry?.id || `${displayJugendLabel}-${displayKreisLabel}-${date}`,
            date,
            startTime: entriesForDate.map((entry) => String(entry.startTime || "")).sort()[0] || "",
            endTime: entriesForDate.map((entry) => String(entry.endTime || "")).sort().slice(-1)[0] || "",
            purpose,
            hrworksStatus: "needs_review",
            sourceType: "timesheet",
            executedBy: entriesForDate[0]?.employeeName || effectiveScoutName,
            technicalResult: `Batch vorbereitet (${dateHours}h).`,
          });
        }
        setHrworksImportLog(readHrworksImportLog());
      }
    }
    if (validation.duplicate) {
      warnings.push("Dieser Plan/Tag wurde vermutlich bereits importiert. Re-Import nur bewusst ausführen.");
    }

    setHrworksPayload(payload);
    setHrworksValidation({ errors: validation.errors, warnings });
    setHrworksReviewOpen(true);
    setErr("");
  };

  const handleEditHrworksMapping = () => {
    if (typeof window === "undefined" || typeof window.prompt !== "function") {
      return;
    }

    const initialJson = JSON.stringify(hrworksSelectorMapping, null, 2);
    const nextText = window.prompt("HRworks Selector-Mapping bearbeiten (JSON):", initialJson);
    if (!nextText) {
      return;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(nextText);
    } catch {
      setErr("Ungültiges JSON. Mapping wurde nicht gespeichert.");
      return;
    }

    const result = writeHrworksSelectorMapping(parsed);
    if (!result.ok) {
      setErr(`Mapping ungültig: ${result.errors.join(" | ")}`);
      return;
    }

    setHrworksSelectorMapping(result.mapping);
    setErr("");
  };

  const handleEditHrworksPolicy = () => {
    if (typeof window === "undefined" || typeof window.prompt !== "function") {
      return;
    }

    const allowed = getAllowedHrworksPolicyValues();
    const initialJson = JSON.stringify(hrworksPolicy, null, 2);
    const helpText = [
      "HRworks Pflichtfelder/Defaults bearbeiten (JSON).",
      `aggregationMode erlaubt: ${allowed.aggregationMode.join(", ")}`,
      `finalSaveMode erlaubt: ${allowed.finalSaveMode.join(", ")}`,
    ].join("\n");
    const nextText = window.prompt(helpText, initialJson);
    if (!nextText) {
      return;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(nextText);
    } catch {
      setErr("Ungültiges JSON. Policy wurde nicht gespeichert.");
      return;
    }

    const nextPolicy = writeHrworksPolicy(parsed);
    setHrworksPolicy(nextPolicy);
    setErr("");
  };

  const handleApplyRecommendedHrworksPolicy = () => {
    const nextPolicy = writeHrworksPolicy({
      ...hrworksPolicy,
      aggregationMode: "per_day",
      finalSaveMode: "prefill_only",
    });
    setHrworksPolicy(nextPolicy);
    setErr("");
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeGames.length]);

  useEffect(() => {
    setConsistencyResult(null);
  }, [activeHistoryEntry?.id]);

  useEffect(() => {
    if (!activeHistoryEntry?.id) {
      return;
    }

    const normalized = normalizePresenceMap(activeHistoryEntry?.presenceByGame);
    setPresenceMinutesByGame((prev) => (isSamePresenceMap(prev, normalized) ? prev : normalized));
  }, [activeHistoryEntry?.id, activeHistoryEntry?.presenceByGame]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.sessionStorage.setItem(STORAGE_KEYS.presence, JSON.stringify(presenceMinutesByGame));
    } catch {
      // Ignore sessionStorage write errors.
    }
  }, [presenceMinutesByGame]);

  useEffect(() => {
    if (!activeHistoryEntry?.id) {
      return;
    }
    onUpdatePlanHistoryPresence(activeHistoryEntry.id, presenceMinutesByGame);
  }, [activeHistoryEntry?.id, onUpdatePlanHistoryPresence, presenceMinutesByGame]);

  useEffect(() => {
    const activeIds = new Set(
      activeGames
        .map((game) => String(game?.id ?? "").trim())
        .filter(Boolean),
    );

    setPresenceMinutesByGame((prev) => {
      const next = {};
      let changed = false;

      for (const [key, value] of Object.entries(prev)) {
        const id = String(key || "").trim();
        const minutes = normalizePresenceMinutes(value);
        if (id && activeIds.has(id) && Number.isFinite(minutes)) {
          next[id] = minutes;
        } else {
          changed = true;
        }
      }

      if (!changed && Object.keys(prev).length === Object.keys(next).length) {
        return prev;
      }
      return next;
    });
  }, [activeGames]);

  const visibleGames = useMemo(() => {
    if (!shouldPaginate) {
      return activeGames;
    }
    const start = (currentPage - 1) * PAGE_SIZE;
    return activeGames.slice(start, start + PAGE_SIZE);
  }, [activeGames, currentPage, shouldPaginate]);

  useLayoutEffect(() => {
    if (!usePinnedActionDock || typeof window === "undefined") {
      setDockReservePx(null);
      return undefined;
    }

    const dockNode = actionDockRef.current;
    if (!dockNode) {
      return undefined;
    }

    let frame = null;
    const updateReserve = () => {
      const styles = window.getComputedStyle(dockNode);
      const bottom = Number.parseFloat(styles.bottom || "0") || 0;
      const height = dockNode.getBoundingClientRect().height || dockNode.offsetHeight || 0;
      const nextValue = Math.max(0, Math.ceil(bottom + height + 2));
      setDockReservePx((prev) => (prev === nextValue ? prev : nextValue));
    };

    const scheduleUpdate = () => {
      if (frame != null) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        updateReserve();
      });
    };

    scheduleUpdate();
    window.addEventListener("resize", scheduleUpdate);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleUpdate) : null;
    observer?.observe(dockNode);

    return () => {
      window.removeEventListener("resize", scheduleUpdate);
      observer?.disconnect();
      if (frame != null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [usePinnedActionDock, isMobile, activeGames.length]);

  return (
    <div
      className={`fu${usePinnedActionDock ? " page-with-action-dock page-with-action-dock-plan" : ""}`}
      style={
        usePinnedActionDock && Number.isFinite(dockReservePx)
          ? {
              "--page-dock-reserve": `${dockReservePx}px`,
              "--page-dock-reserve-native": `${dockReservePx}px`,
            }
          : undefined
      }
    >
      <div
        style={{
          display: "flex",
          alignItems: useStackedTopActions ? "stretch" : "center",
          flexDirection: useStackedTopActions ? "column" : "row",
          gap: useStackedTopActions ? 10 : 12,
          marginBottom: 20,
          flexWrap: useStackedTopActions ? "nowrap" : "wrap",
        }}
      >
        {!usePinnedActionDock ? (
          <GhostButton onClick={onBackGames}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Spiele
          </GhostButton>
        ) : null}

        <div style={{ flex: useStackedTopActions ? "0 0 auto" : 1, minWidth: 0, width: useStackedTopActions ? "100%" : "auto" }}>
          <div
            style={{
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 800,
              fontSize: isMobile ? 18 : 22,
              color: C.white,
              letterSpacing: "-0.3px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Scout-Plan · {displayJugendLabel}
          </div>

          <div
            style={{
              fontSize: 12,
              color: C.gray,
              marginTop: 2,
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >
            {displayKreisLabel}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: useStackedTopActions ? "minmax(0,1fr) minmax(0,1fr)" : "none",
            gap: 8,
            width: useStackedTopActions ? "100%" : "auto",
          }}
        >
          <input
            ref={hrworksFileInputRef}
            type="file"
            accept=".csv,text/csv,.txt"
            style={{ display: "none" }}
            onChange={(event) => {
              void handleHrworksFileChange(event);
            }}
          />
          <PDFExport
            games={activeGames}
            plan={plan}
            cfg={{
              ...cfg,
              kreisLabel: displayKreisLabel || cfg?.kreisLabel || "",
              jugendLabel: displayJugendLabel || cfg?.jugendLabel || "",
              fromDate: String(activeHistoryMeta?.fromDate || cfg?.fromDate || ""),
              toDate: String(activeHistoryMeta?.toDate || cfg?.toDate || ""),
              startLocationLabel: String(activeHistoryMeta?.startLocationLabel || startLocation?.label || cfg?.startLocationLabel || ""),
              routeOverview,
              startLocation,
              scoutName: effectiveScoutName,
              kmPauschale: kmPauschaleForPdf,
              kmOverrides,
              presenceOverrides: presenceMinutesByGame,
            }}
            syncContext={
              planSyncContext || {
                source: dataSourceUsed,
                adapterEndpoint,
                adapterToken,
                kreisId,
                kreisIds,
                jugendId,
                fromDate,
                toDate,
                teams: activeTeams,
                turnier: Boolean(jugend?.turnier),
              }
            }
            variant="primary"
            label="PDF herunterladen"
            confirmBeforeDownload
            style={
              useStackedTopActions
                ? {
                    width: "100%",
                    minWidth: 0,
                    justifyContent: "center",
                  }
                : undefined
            }
            disabled={!String(plan || "").trim() || activeGames.length === 0 || (Boolean(startLocation) && routeCalculating)}
            onExportSuccess={() => {
              setErr("");
            }}
            onExportError={(message) => {
              setErr(`PDF konnte nicht erstellt werden: ${String(message || "Unbekannter Fehler")}`);
            }}
          />
          <button
            type="button"
            onClick={handlePickHrworksFile}
            aria-label="Arbeitszeitdatei importieren"
            style={{
              fontSize: 12,
              padding: "9px 14px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.04)",
              color: C.grayLight,
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 600,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: useStackedTopActions ? "100%" : "auto",
              minWidth: useStackedTopActions ? 0 : undefined,
            }}
          >
            Arbeitszeitdatei importieren
          </button>
          <button
            type="button"
            onClick={handleEditHrworksMapping}
            aria-label="HRworks Mapping bearbeiten"
            style={{
              fontSize: 12,
              padding: "9px 14px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.04)",
              color: C.gray,
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 600,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: useStackedTopActions ? "100%" : "auto",
              minWidth: useStackedTopActions ? 0 : undefined,
            }}
          >
            HRworks Mapping bearbeiten
          </button>
          <button
            type="button"
            onClick={handleEditHrworksPolicy}
            aria-label="HRworks Pflichtfelder bearbeiten"
            style={{
              fontSize: 12,
              padding: "9px 14px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.04)",
              color: C.gray,
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 600,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: useStackedTopActions ? "100%" : "auto",
              minWidth: useStackedTopActions ? 0 : undefined,
            }}
          >
            HRworks Pflichtfelder
          </button>
          <button
            type="button"
            onClick={handleApplyRecommendedHrworksPolicy}
            aria-label="Empfohlenes HRworks Setup anwenden"
            style={{
              fontSize: 12,
              padding: "9px 14px",
              borderRadius: 10,
              border: `1px solid ${C.greenBorder}`,
              background: C.greenDim,
              color: C.green,
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 600,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: useStackedTopActions ? "100%" : "auto",
              minWidth: useStackedTopActions ? 0 : undefined,
            }}
          >
            HRworks Setup (Empfohlen)
          </button>
          <button
            type="button"
            onClick={() => downloadCalendarIcs(activeGames, cfg)}
            aria-label="In Kalender exportieren"
            disabled={activeGames.length === 0}
            style={{
              fontSize: 12,
              padding: "9px 14px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.04)",
              color: C.gray,
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 600,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: useStackedTopActions ? "center" : "flex-start",
              gap: 6,
              opacity: activeGames.length === 0 ? 0.5 : 1,
              cursor: activeGames.length === 0 ? "not-allowed" : "pointer",
              width: useStackedTopActions ? "100%" : "auto",
              minWidth: useStackedTopActions ? 0 : undefined,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            In Kalender exportieren
          </button>
          <button
            type="button"
            onClick={handleOpenHrworksReview}
            aria-label="In HRworks importieren"
            disabled={activeGames.length === 0}
            style={{
              fontSize: 12,
              padding: "9px 14px",
              borderRadius: 10,
              border: `1px solid ${C.greenBorder}`,
              background: C.greenDim,
              color: C.green,
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 700,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              opacity: activeGames.length === 0 ? 0.5 : 1,
              cursor: activeGames.length === 0 ? "not-allowed" : "pointer",
              width: useStackedTopActions ? "100%" : "auto",
              minWidth: useStackedTopActions ? 0 : undefined,
            }}
          >
            In HRworks importieren
          </button>
        </div>
      </div>
      <HrworksImportReviewModal
        open={hrworksReviewOpen}
        payload={hrworksPayload}
        warnings={hrworksValidation.warnings}
        errors={hrworksValidation.errors}
        loginConfirmed={hrworksLoginConfirmed}
        onLoginConfirmedChange={setHrworksLoginConfirmed}
        onCancel={() => {
          setHrworksReviewOpen(false);
          setHrworksLoginConfirmed(false);
        }}
        onEdit={() => {
          setHrworksReviewOpen(false);
          setHrworksLoginConfirmed(false);
          setErr("Bitte Plan-/Abrechnungsdaten prüfen und anschließend erneut importieren.");
        }}
        onExportOnly={handleHrworksExportOnly}
        onDryRun={handleHrworksDryRun}
        onConfirm={handleConfirmHrworksImport}
      />
      {missingHrworksDecisions.length > 0 ? (
        <div
          className="fu2"
          role="alert"
          style={{
            background: "rgba(252,211,77,0.08)",
            border: "1px solid rgba(252,211,77,0.35)",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 12, color: "#fde68a", fontWeight: 700 }}>HRworks-Setup unvollständig</div>
          <div style={{ marginTop: 6, display: "grid", gap: 4, fontSize: 11, color: "#fde68a" }}>
            {missingHrworksDecisions.map((item) => (
              <div key={item}>• {item}</div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: C.gray }}>
            Bitte zuerst „HRworks Pflichtfelder“ konfigurieren.
          </div>
        </div>
      ) : null}
      {hrworksRuntimeSession?.status === "running" ? (
        <div
          className="fu2"
          style={{
            background: "rgba(0,200,83,0.07)",
            border: `1px solid ${C.greenBorder}`,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 12, color: C.offWhite, fontWeight: 700 }}>HRworks Runtime aktiv</div>
          <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>
            Schritt: {HRWORKS_STEP_LABELS[hrworksRuntimeSession.currentStep] || "Import wird ausgeführt"}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, color: C.grayLight }}>
            <input
              type="checkbox"
              checked={hrworksDebugScreenshotConsent}
              onChange={(event) => {
                setHrworksDebugScreenshotConsent(Boolean(event.target?.checked));
              }}
            />
            Debug-Screenshots für diesen Lauf freigeben
          </label>
          <div style={{ marginTop: 4, fontSize: 11, color: C.gray }}>
            Screenshot erlaubt:{" "}
            {canCaptureDebugScreenshot({
              allowDebugScreenshots: hrworksPolicy.allowDebugScreenshots,
              userConsent: hrworksDebugScreenshotConsent,
            })
              ? "Ja"
              : "Nein"}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleFinalizeRuntimeSession}
              style={{
                fontSize: 11,
                border: "none",
                background: "transparent",
                color: C.green,
                textDecoration: "underline",
                padding: 0,
                cursor: "pointer",
              }}
            >
              Import abschließen
            </button>
          </div>
        </div>
      ) : null}
      {scopedHrworksLog.length > 0 ? (
        <div
          className="fu2"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: C.offWhite, fontWeight: 700 }}>HRworks-Importhistorie</div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await exportHrworksAuditLog(scopedHrworksLog);
                } catch (error) {
                  setErr(`Audit-Export fehlgeschlagen: ${String(error?.message || error || "Unbekannter Fehler")}`);
                }
              }}
              style={{
                fontSize: 11,
                border: "none",
                background: "transparent",
                color: C.gray,
                textDecoration: "underline",
                padding: 0,
                cursor: "pointer",
              }}
            >
              Audit-Log exportieren
            </button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {scopedHrworksLog.map((entry) => (
              <div
                key={entry.id}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: "8px 10px",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 11, color: C.offWhite }}>
                    {String(entry.date || "-")} · {String(entry.startTime || "--:--")}–{String(entry.endTime || "--:--")}
                  </div>
                  <div style={{ fontSize: 11, color: C.gray }}>
                    {new Date(entry.importedAt).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: C.grayLight }}>
                  Status: <strong>{String(entry.hrworksStatus || "-")}</strong> · {String(entry.technicalResult || "-")}
                </div>
                <div style={{ marginTop: 2, fontSize: 11, color: C.gray }}>
                  Quelle: {entry.sourceType === "timesheet" ? "Arbeitszeitdatei" : "Spielplan"}
                </div>
                {entry.hrworksReference ? (
                  <div style={{ marginTop: 4, fontSize: 11, color: C.gray }}>
                    HRworks-Referenz: {String(entry.hrworksReference)}
                  </div>
                ) : null}
                {entry.errorMessage ? (
                  <div style={{ marginTop: 4, fontSize: 11, color: "#fca5a5" }}>{String(entry.errorMessage)}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {historyEntries.length > 0 ? (
        <div
          className="fu2"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: C.offWhite, fontWeight: 700 }}>Plan-Historie</div>
            <button
              type="button"
              onClick={handleClearPlanHistory}
              style={{
                fontSize: 11,
                border: "none",
                background: "transparent",
                color: C.gray,
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
                minHeight: 0,
              }}
            >
              Historie leeren
            </button>
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {historyEntries.slice(0, 8).map((entry) => {
              const meta = entry?.meta && typeof entry.meta === "object" ? entry.meta : {};
              const labelJugend = String(meta.jugendLabel || "").trim();
              const labelKreis = String(meta.kreisLabel || "").trim();
              const labelFrom = String(meta.fromDate || "").trim();
              const labelTo = String(meta.toDate || "").trim();
              const createdAt = String(entry?.createdAt || "").trim();
              const createdAtLabel = createdAt
                ? new Date(createdAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                : "unbekannt";
              const isActive = activeHistoryEntry?.id === entry.id;

              return (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                    border: `1px solid ${isActive ? C.greenBorder : C.border}`,
                    borderRadius: 10,
                    padding: "8px 10px",
                    background: isActive ? C.greenDim : "rgba(255,255,255,0.02)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onOpenPlanHistory(entry.id)}
                    aria-label={`Historischen Plan ${createdAtLabel} öffnen`}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: isActive ? C.offWhite : C.grayLight,
                      textAlign: "left",
                      cursor: "pointer",
                      flex: 1,
                      minHeight: 0,
                      padding: 0,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{createdAtLabel}</div>
                    <div style={{ fontSize: 11, color: C.gray }}>
                      {labelKreis || "-"} · {labelJugend || "-"} · {labelFrom || "-"} bis {labelTo || "-"}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePlanHistory(entry.id)}
                    aria-label={`Historischen Plan ${createdAtLabel} entfernen`}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#fca5a5",
                      cursor: "pointer",
                      fontSize: 11,
                      textDecoration: "underline",
                      minHeight: 0,
                      padding: 0,
                    }}
                  >
                    Entfernen
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {startLocation && routeCalculating ? (
        <div aria-live="polite" style={{ fontSize: 12, color: C.grayDark, marginBottom: 10 }}>
          Route wird berechnet. Danach ist der PDF-Export vollständig.
        </div>
      ) : null}

      <PlanView plan={plan} jugendLabel={displayJugendLabel} kreisLabel={displayKreisLabel} isMobile={isMobile} games={activeGames} />

      <div
        className="fu2"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: 14,
          marginTop: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: C.offWhite, fontWeight: 700 }}>Live-Konsistenzprüfung</div>
          <button
            type="button"
            onClick={() => {
              void handleCheckConsistency();
            }}
            disabled={!canCheckConsistency || consistencyChecking}
            aria-label="Live-Daten auf Änderungen prüfen"
            style={{
              fontSize: 12,
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: consistencyChecking ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
              color: !canCheckConsistency ? C.grayDark : C.grayLight,
              padding: "8px 12px",
              cursor: !canCheckConsistency || consistencyChecking ? "not-allowed" : "pointer",
              minHeight: 36,
              opacity: !canCheckConsistency ? 0.7 : 1,
            }}
          >
            {consistencyChecking ? "Live-Daten werden geprüft..." : "Live-Daten prüfen"}
          </button>
        </div>

        {!canCheckConsistency ? (
          <div style={{ marginTop: 8, fontSize: 12, color: C.gray }}>
            Prüfung nur verfügbar, wenn der Plan aus dem Live-Adapter stammt.
          </div>
        ) : null}

        {consistencyResult?.ok ? (
          <div style={{ marginTop: 10, fontSize: 12, color: C.grayLight, display: "grid", gap: 6 }}>
            <div>
              Geprüft am{" "}
              {new Date(consistencyResult.checkedAt).toLocaleString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" · "}
              {consistencyResult.correctedCount > 0
                ? `${consistencyResult.correctedCount} Änderung(en) übernommen`
                : "Keine Änderungen gefunden"}
              {" · "}
              {consistencyResult.checkedCount} Spiel(e) geprüft
            </div>

            {consistencyResult.missingCount > 0 ? (
              <div style={{ color: "#fcd34d" }}>
                {consistencyResult.missingCount} Spiel(e) konnten im Live-Datensatz nicht eindeutig zugeordnet werden.
              </div>
            ) : null}

            {Array.isArray(consistencyResult.changes) && consistencyResult.changes.length > 0 ? (
              <div style={{ display: "grid", gap: 4 }}>
                {consistencyResult.changes.slice(0, 6).map((change) => (
                  <div key={`${change.id || "match"}-${change.home}-${change.away}`} style={{ color: C.gray }}>
                    {change.home} vs {change.away}: {change.details.join(" · ")}
                  </div>
                ))}
                {consistencyResult.changes.length > 6 ? (
                  <div style={{ color: C.grayDark }}>+ {consistencyResult.changes.length - 6} weitere Änderungen</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {activeGames.length > 0 ? (
        <div style={{ marginTop: 28, marginBottom: 28 }} className="fu2">
          <SectionHeader>Fahrtkosten-Abrechnung</SectionHeader>
          <FahrtkostenTabelle
            games={activeGames}
            routeOverview={routeOverview}
            kmPauschale={kmPauschale}
            isMobile={isMobile}
            onKmChange={handleKmChange}
            presenceMinutesByGame={presenceMinutesByGame}
            onPresenceChange={handlePresenceChange}
          />
        </div>
      ) : null}

      {routeOverview && startLocation ? (
        <div
          className="fu2"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: isMobile ? 16 : 18,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, color: C.offWhite, fontWeight: 700, marginBottom: 10 }}>Routenübersicht</div>
          <div style={{ fontSize: 13, color: C.gray, marginBottom: 8 }}>Start: {startLocation.label}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {routeOverview.legs.map((leg, index) => (
              <div key={`${leg.from}-${leg.to}-${index}`} style={{ fontSize: 12, color: C.gray }}>
                {leg.from} → {leg.to} · {formatDistanceKm(leg.distanceKm)}
                {Number.isFinite(leg.durationMinutes) ? ` · ${leg.durationMinutes} Min` : ""}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: C.offWhite }}>
            Gesamtstrecke: {formatDistanceKm(routeOverview.totalKm)} · Fahrzeit ca.{" "}
            {Number.isFinite(routeOverview.estimatedMinutes) ? `${routeOverview.estimatedMinutes} Min` : "unbekannt"}
          </div>
        </div>
      ) : null}

      {activeGames.length > 0 ? (
        <div className="fu3" style={{ marginBottom: 16 }}>
          <div
            style={{
              padding: "10px 16px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: "14px 14px 0 0",
              border: `1px solid ${C.border}`,
              borderBottom: "none",
              fontSize: 11,
              color: C.gray,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 600,
            }}
          >
            {hasManualSelection ? "Ausgewählte" : "Alle"} {activeGames.length} Spiele · {displayJugendLabel} ·{" "}
            {displayKreisLabel}
          </div>

          <GameTable games={visibleGames} mode="plan" />

          <div
            className="game-cards"
            style={{
              background: C.surfaceSolid,
              border: `1px solid ${C.border}`,
              borderTop: "none",
              borderRadius: "0 0 14px 14px",
              padding: "10px",
            }}
          >
            <GameCards games={visibleGames} />
          </div>
        </div>
      ) : (
        <div
          className="fu2"
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 14,
            marginBottom: 16,
            color: C.gray,
            fontSize: 13,
          }}
        >
          Keine Spiele verfügbar.
        </div>
      )}

      {shouldPaginate ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 12, color: C.gray }}>
            Seite {currentPage} von {totalPages} · {visibleGames.length} Spiele sichtbar
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <GhostButton
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
              aria-label="Vorherige Seite"
            >
              Zurück
            </GhostButton>
            <GhostButton
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Nächste Seite"
            >
              Weiter
            </GhostButton>
          </div>
        </div>
      ) : null}

      <div className={`page-action-dock${usePinnedActionDock ? " page-action-dock-mobile" : ""}`} ref={actionDockRef}>
        <div className="page-action-dock-row">
          <GhostButton onClick={onBackGames} style={{ width: "100%", justifyContent: "center", textAlign: "center" }}>
            Spiele
          </GhostButton>
          <GhostButton onClick={onResetSoft} style={{ width: "100%", justifyContent: "center", textAlign: "center" }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Neuer Plan
          </GhostButton>
        </div>
        <GhostButton onClick={onResetHard} style={{ width: "100%", justifyContent: "center", textAlign: "center" }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Komplett neu
        </GhostButton>
      </div>
    </div>
  );
}
