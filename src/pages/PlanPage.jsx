import { useEffect, useMemo, useState } from "react";
import { GhostButton } from "../components/Buttons";
import { GameCards } from "../components/GameCards";
import { GameTable } from "../components/GameTable";
import { PDFExport } from "../components/PDFExport";
import { PlanView } from "../components/PlanView";
import { FahrtkostenTabelle } from "../components/FahrtkostenTabelle";
import { SectionHeader } from "../components/SectionHeader";
import { STORAGE_KEYS } from "../config/storage";
import { useScoutX } from "../context/ScoutXContext";
import { checkPlanConsistency, isAdapterSyncContext } from "../services/liveConsistency";
import { C } from "../styles/theme";
import { normalizePresenceMinutes } from "../utils/arbeitszeit";
import { downloadCalendarIcs } from "../utils/calendar";
import { formatDistanceKm } from "../utils/geo";

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

export function PlanPage() {
  const {
    games,
    plannedGames,
    plan,
    kreis,
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
  const displayKreisLabel = String(activeHistoryMeta?.kreisLabel || kreis?.label || "").trim();
  const effectiveScoutName = String(activeHistoryMeta?.scoutName || scoutName || "").trim();
  const effectiveKmPauschale = Number(activeHistoryMeta?.kmPauschale);
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

  return (
    <div className="fu">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
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

        <div style={{ flex: 1, minWidth: 0 }}>
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
            gap: 6,
            opacity: activeGames.length === 0 ? 0.5 : 1,
            cursor: activeGames.length === 0 ? "not-allowed" : "pointer",
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
      </div>

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

      <div className="reset-row">
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
