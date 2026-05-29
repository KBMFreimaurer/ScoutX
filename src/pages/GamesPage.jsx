import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GhostButton, PrimaryButton } from "../components/Buttons";
import { GameCards } from "../components/GameCards";
import { GameTable } from "../components/GameTable";
import { useScoutX } from "../context/ScoutXContext";
import { useScoutXProduct } from "../context/ScoutXProductContext";
import { isNativeCapacitorRuntime } from "../native/deepLinks";
import { confirmTeamKreisPdfImport, previewTeamKreisPdfImport } from "../services/teamBackendClient";
import { C } from "../styles/theme";
import { downloadCalendarIcs } from "../utils/calendar";
import { formatDistanceKm } from "../utils/geo";

function toKickoffMs(game) {
  const dateText = String(game?.date || "").trim();
  const timeText = String(game?.time || "").trim();
  const match = timeText.match(/^(\d{2}):(\d{2})$/);
  if (!dateText || !match) {
    return NaN;
  }
  const [, hh, mm] = match;
  return Date.parse(`${dateText}T${hh}:${mm}:00`);
}

function buildSelectionConflicts(games) {
  const entries = (Array.isArray(games) ? games : [])
    .map((game) => ({
      id: String(game?.id || ""),
      home: String(game?.home || ""),
      away: String(game?.away || ""),
      venue: String(game?.venue || ""),
      kickoffMs: toKickoffMs(game),
      time: String(game?.time || ""),
    }))
    .filter((item) => item.id && !Number.isNaN(item.kickoffMs))
    .sort((a, b) => a.kickoffMs - b.kickoffMs);

  const conflicts = [];
  for (let index = 0; index < entries.length - 1; index += 1) {
    const left = entries[index];
    const right = entries[index + 1];
    const deltaMinutes = Math.round((right.kickoffMs - left.kickoffMs) / 60000);
    const sameVenue = left.venue && right.venue && left.venue.toLowerCase() === right.venue.toLowerCase();
    if (deltaMinutes < 120) {
      conflicts.push({
        type: "time_overlap",
        severity: "hard-conflict",
        gameIds: [left.id, right.id],
        message: `${left.home} vs ${left.away} (${left.time}) kollidiert mit ${right.home} vs ${right.away} (${right.time}).`,
      });
    } else if (!sameVenue && deltaMinutes < 90) {
      conflicts.push({
        type: "travel_risk",
        severity: deltaMinutes < 60 ? "hard-conflict" : "warn",
        gameIds: [left.id, right.id],
        message: `Knappes Reisefenster (${deltaMinutes} Min) zwischen ${left.home} vs ${left.away} und ${right.home} vs ${right.away}.`,
      });
    }
  }
  return conflicts;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return typeof window !== "undefined" && typeof window.btoa === "function" ? window.btoa(binary) : "";
}

export function GamesPage() {
  const {
    games,
    jugend,
    kreis,
    kreisLabel,
    activeTeams,
    startLocation,
    teamValidation,
    enrichingGames,
    providerWarnings = [],
    includeTournaments,
    gameNotes,
    selectedGameIds,
    selectedGameCount,
    pdfExporting,
    isMobile,
    onSetGameNote,
    onTogglePlannedGame,
    onSelectAllPlannedGames,
    onClearPlannedGames,
    onBackSetup,
    onGeneratePlanPdf,
    onAppendManualGame,
    onMergeExternalGames,
  } = useScoutX();
  const { getGameObservationMap } = useScoutXProduct();
  const usePinnedActionDock = isMobile || isNativeCapacitorRuntime();
  const PAGE_SIZE = 20;
  const requestedTeamCount = Number(teamValidation?.requestedCount || 0);
  const matchedTeamCount = Number(teamValidation?.matchedTeamCount || 0);
  const matchedGameCount =
    typeof teamValidation?.matchedCount === "number"
      ? teamValidation.matchedCount
      : games.filter((game) => game.selectedTeamMatch).length;
  const showTeamHint = requestedTeamCount > 0;
  const tournamentCount = games.filter((game) => Boolean(game?.turnier) || String(game?.source || "").toLowerCase() === "tournament").length;
  const tournamentCountLabel = `${tournamentCount} ${tournamentCount === 1 ? "Turnier" : "Turniere"}`;
  const providerWarningText = (Array.isArray(providerWarnings) ? providerWarnings : [])
    .map((warning) => String(warning || "").trim())
    .filter(Boolean)
    .join(" ");
  const shouldPaginate = games.length > 100;
  const [sortMode, setSortMode] = useState("date");
  const [expandedNoteId, setExpandedNoteId] = useState(null);
  const [manualGameForm, setManualGameForm] = useState({ home: "", away: "", date: "", time: "", venue: "" });
  const [kreisPdfBusy, setKreisPdfBusy] = useState(false);
  const [gamesInfoMessage, setGamesInfoMessage] = useState("");
  const actionDockRef = useRef(null);
  const [dockReservePx, setDockReservePx] = useState(null);
  const firstGameRoute = useMemo(() => {
    const withExactStartRoute = [...games]
      .filter((game) => Number.isFinite(game?.fromStartRouteDistanceKm))
      .sort((a, b) => {
        const ad = a?.dateObj instanceof Date ? a.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b?.dateObj instanceof Date ? b.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
        if (ad !== bd) {
          return ad - bd;
        }
        return String(a.time || "99:99").localeCompare(String(b.time || "99:99"));
      });

    return withExactStartRoute[0] || null;
  }, [games]);

  const sortedGames = useMemo(() => {
    if (sortMode === "distance") {
      return [...games].sort((a, b) => {
        const da = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.POSITIVE_INFINITY;
        const db = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.POSITIVE_INFINITY;
        if (da !== db) {
          return da - db;
        }
        return Number(b.priority || 0) - Number(a.priority || 0);
      });
    }

    if (sortMode === "date") {
      return [...games].sort((a, b) => {
        const ad = a?.dateObj instanceof Date ? a.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b?.dateObj instanceof Date ? b.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
        if (ad !== bd) {
          return ad - bd;
        }
        return String(a.time || "99:99").localeCompare(String(b.time || "99:99"));
      });
    }

    return [...games].sort((a, b) => {
      const ad = a?.dateObj instanceof Date ? a.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b?.dateObj instanceof Date ? b.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
      if (ad !== bd) {
        return ad - bd;
      }
      return String(a.time || "99:99").localeCompare(String(b.time || "99:99"));
    });
  }, [games, sortMode]);
  const observationMap = useMemo(() => getGameObservationMap(), [getGameObservationMap]);
  const selectedGamesForPlan = useMemo(() => {
    const selectedIds = Object.keys(selectedGameIds || {});
    if (selectedIds.length === 0) {
      return sortedGames;
    }
    return sortedGames.filter((game) => selectedGameIds?.[game.id]);
  }, [selectedGameIds, sortedGames]);
  const selectionConflicts = useMemo(
    () => buildSelectionConflicts(selectedGamesForPlan),
    [selectedGamesForPlan],
  );
  const gamesWithTeamPlanning = useMemo(
    () =>
      sortedGames.map((game) => {
        const planning = observationMap?.[game.id];
        if (!planning?.label) {
          return game;
        }
        return {
          ...game,
          planningLabel: planning.label,
          plannedBy: planning.plannedBy,
          plannedByOtherScouts: planning.plannedByOtherScouts,
          seenBy: planning.seenBy,
        };
      }),
    [observationMap, sortedGames],
  );
  const totalPages = shouldPaginate ? Math.ceil(sortedGames.length / PAGE_SIZE) : 1;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [games.length]);

  const visibleGames = useMemo(() => {
    if (!shouldPaginate) {
      return gamesWithTeamPlanning;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    return gamesWithTeamPlanning.slice(start, start + PAGE_SIZE);
  }, [gamesWithTeamPlanning, currentPage, shouldPaginate]);

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
  }, [usePinnedActionDock, isMobile]);

  const onExportCalendar = () => {
    const selectedIds = Object.keys(selectedGameIds || {});
    const exportGames = selectedIds.length > 0 ? games.filter((game) => selectedGameIds?.[game.id]) : games;
    downloadCalendarIcs(exportGames, {
      kreisLabel: String(kreisLabel || kreis?.label || "").trim(),
    });
  };

  const onConfirmAndGeneratePlan = () => {
    if (selectionConflicts.length > 0) {
      const first = selectionConflicts[0];
      const severityLabel = first.severity === "hard-conflict" ? "Hard-Conflict" : first.severity === "warn" ? "Warnung" : "Info";
      const warning = `Konfliktwarnung vor Planabschluss (${severityLabel}):\n${first.message}\n\nTrotzdem Plan öffnen?`;
      const confirmed = window.confirm(warning);
      if (!confirmed) {
        return;
      }
    }
    onGeneratePlanPdf();
  };

  const onToggleGameSelection = (gameId) => {
    const id = String(gameId || "").trim();
    if (!id) {
      return;
    }
    if (selectedGameIds?.[id]) {
      onTogglePlannedGame(id);
      return;
    }
    const otherScouts = observationMap?.[id]?.plannedByOtherScouts || [];
    if (otherScouts.length > 0) {
      const names = otherScouts.join(", ");
      const confirmed = window.confirm(
        `Dieses Spiel ist bereits im Plan von ${names}. Trotzdem in deinen Plan aufnehmen?`,
      );
      if (!confirmed) {
        return;
      }
    }
    onTogglePlannedGame(id);
  };
  const cardLikeBox = {
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: 14,
  };
  const btnLike = {
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    background: "rgba(255,255,255,0.03)",
    color: C.gray,
    padding: "6px 10px",
    fontSize: 12,
  };

  const onSubmitManualGame = () => {
    const ok = onAppendManualGame?.(manualGameForm);
    if (!ok) {
      setGamesInfoMessage("Bitte Heim- und Auswärtsteam für spontane Spiele ausfüllen.");
      return;
    }
    setManualGameForm({ home: "", away: "", date: "", time: "", venue: "" });
    setGamesInfoMessage("Spontanes Spiel wurde hinzugefügt.");
  };

  const onImportKreisPdfFile = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) {
      return;
    }
    setKreisPdfBusy(true);
    setGamesInfoMessage("");
    try {
      const buffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const preview = await previewTeamKreisPdfImport({
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        fileBase64: base64,
      });
      const previewToken = String(preview?.previewToken || "").trim();
      const confirmed = previewToken ? await confirmTeamKreisPdfImport(previewToken) : preview;
      const importedGames = Array.isArray(confirmed?.games) ? confirmed.games : [];
      if (importedGames.length === 0) {
        setGamesInfoMessage("PDF importiert, aber keine Spiele erkannt.");
      } else {
        onMergeExternalGames?.(importedGames);
        setGamesInfoMessage(`${importedGames.length} Spiele aus Kreisauswahl-PDF übernommen.`);
      }
    } catch (error) {
      setGamesInfoMessage(error?.message || "Kreisauswahl-PDF konnte nicht importiert werden.");
    } finally {
      setKreisPdfBusy(false);
      if (event?.target) {
        event.target.value = "";
      }
    }
  };

  return (
    <div
      className={`fu${usePinnedActionDock ? " page-with-action-dock page-with-action-dock-games" : ""}`}
      style={
        usePinnedActionDock && Number.isFinite(dockReservePx)
          ? {
              "--page-dock-reserve": `${dockReservePx}px`,
              "--page-dock-reserve-native": `${dockReservePx}px`,
            }
          : undefined
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {!usePinnedActionDock ? (
          <GhostButton onClick={onBackSetup}>
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
            Konfiguration
          </GhostButton>
        ) : null}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 800,
              fontSize: 22,
              color: C.white,
              letterSpacing: "-0.3px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {jugend?.label} · {String(kreisLabel || kreis?.label || "").trim()}
            {jugend?.turnier ? (
              <span
                style={{
                  fontSize: 11,
                  color: C.warn,
                  marginLeft: 10,
                  fontWeight: 600,
                  padding: "2px 8px",
                  background: C.warnDim,
                  borderRadius: 4,
                  border: `1px solid rgba(251,191,36,0.15)`,
                }}
              >
                TURNIER
              </span>
            ) : null}
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
            {games.length} {jugend?.turnier ? "Begegnungen" : "Spiele"}
            {includeTournaments || tournamentCount > 0 ? ` · ${tournamentCountLabel}` : ""} · {activeTeams.length} Team-Parameter
          </div>

          {providerWarningText ? (
            <div
              style={{
                fontSize: 11,
                color: C.warn,
                marginTop: 4,
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              }}
            >
              {providerWarningText}
            </div>
          ) : null}

          {showTeamHint ? (
            <div
              style={{
                fontSize: 11,
                color: C.grayDark,
                marginTop: 4,
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              }}
            >
              Team-Hinweise: {matchedGameCount} passende Spiele · {matchedTeamCount}/{requestedTeamCount} Vereine
              erkannt
            </div>
          ) : null}

          {startLocation?.label ? (
            <div
              style={{
                fontSize: 11,
                color: C.grayDark,
                marginTop: 4,
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              }}
            >
              Startort: {startLocation.label}
            </div>
          ) : null}

          {firstGameRoute ? (
            <div
              aria-live="polite"
              style={{
                fontSize: 11,
                color: C.grayDark,
                marginTop: 4,
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              }}
            >
              Straßenroute Start → 1. Spiel: {formatDistanceKm(firstGameRoute.fromStartRouteDistanceKm)} ·{" "}
              {Number.isFinite(firstGameRoute.fromStartRouteMinutes)
                ? `${firstGameRoute.fromStartRouteMinutes} Min`
                : "Zeit unbekannt"}
            </div>
          ) : null}

          {enrichingGames ? (
            <div
              aria-live="polite"
              style={{
                fontSize: 11,
                color: C.grayDark,
                marginTop: 4,
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              }}
            >
              Entfernungen werden gerade aktualisiert.
            </div>
          ) : null}
        </div>
      </div>

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.45, maxWidth: 680 }}>
            <div style={{ color: C.offWhite, fontWeight: 700, marginBottom: 2 }}>Spiele auswählen</div>
            <div>
              Desktop: links neben dem Spiel die <strong>Checkbox</strong> anklicken. Mobil: im Spiel die{" "}
              <strong>Checkbox</strong> aktivieren.
            </div>
            <div>
              Aktuell markiert:{" "}
              <span style={{ color: C.offWhite, fontWeight: 700 }}>
                {selectedGameCount} von {games.length}
              </span>
              . Ohne Auswahl werden automatisch alle Spiele übernommen.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onSelectAllPlannedGames}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                color: C.gray,
                cursor: "pointer",
                padding: "6px 10px",
                minHeight: 34,
                fontSize: 12,
              }}
            >
              Alle markieren
            </button>
            <button
              type="button"
              onClick={onClearPlannedGames}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                color: C.gray,
                cursor: "pointer",
                padding: "6px 10px",
                minHeight: 34,
                fontSize: 12,
              }}
            >
              Auswahl leeren
            </button>
          </div>
        </div>
      </div>

      <div style={{ ...cardLikeBox, marginBottom: 14 }}>
        <div style={{ color: C.offWhite, fontWeight: 700, marginBottom: 8 }}>Spontane Spiele & Kreisauswahl-PDF</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
          <input className="scout-input" placeholder="Heimteam manuell" value={manualGameForm.home} onChange={(event) => setManualGameForm((prev) => ({ ...prev, home: event.target.value }))} />
          <input className="scout-input" placeholder="Auswärtsteam" value={manualGameForm.away} onChange={(event) => setManualGameForm((prev) => ({ ...prev, away: event.target.value }))} />
          <input className="scout-input" type="date" value={manualGameForm.date} onChange={(event) => setManualGameForm((prev) => ({ ...prev, date: event.target.value }))} />
          <input className="scout-input" type="time" value={manualGameForm.time} onChange={(event) => setManualGameForm((prev) => ({ ...prev, time: event.target.value }))} />
          <input className="scout-input" placeholder="Spielort (optional)" value={manualGameForm.venue} onChange={(event) => setManualGameForm((prev) => ({ ...prev, venue: event.target.value }))} />
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={onSubmitManualGame} style={{ ...btnLike, minHeight: 34 }}>
            Spontanes Spiel hinzufügen
          </button>
          <label style={{ ...btnLike, minHeight: 34, display: "inline-flex", alignItems: "center", cursor: kreisPdfBusy ? "not-allowed" : "pointer" }}>
            Kreisauswahl PDF hochladen
            <input type="file" accept="application/pdf" onChange={onImportKreisPdfFile} disabled={kreisPdfBusy} style={{ display: "none" }} />
          </label>
        </div>
        {gamesInfoMessage ? <div style={{ marginTop: 8, fontSize: 12, color: C.gray }}>{gamesInfoMessage}</div> : null}
      </div>

      {selectionConflicts.length > 0 ? (
        <div
          role="alert"
          style={{
            border: `1px solid rgba(251,191,36,0.3)`,
            background: "rgba(251,191,36,0.12)",
            color: C.warn,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          <strong>
            Konfliktwarnung vor Planabschluss ({selectionConflicts[0].severity === "hard-conflict" ? "Hard-Conflict" : "Warnung"}):
          </strong>{" "}
          {selectionConflicts[0].message}
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.gray }}>
          Sortierung
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            className="scout-select"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: C.offWhite,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "6px 10px",
              minHeight: 34,
            }}
          >
            <option value="distance">Entfernung</option>
            <option value="date">Datum/Uhrzeit</option>
          </select>
        </label>
      </div>

      <GameTable
        games={visibleGames}
        sortMode={sortMode}
        notes={gameNotes}
        expandedNoteId={expandedNoteId}
        onToggleNote={(gameId) => setExpandedNoteId((current) => (current === gameId ? null : gameId))}
        onSetNote={onSetGameNote}
        selectionEnabled
        selectedGameIds={selectedGameIds}
        onToggleSelectedGame={onToggleGameSelection}
      />
      <GameCards
        games={visibleGames}
        notes={gameNotes}
        expandedNoteId={expandedNoteId}
        onToggleNote={(gameId) => setExpandedNoteId((current) => (current === gameId ? null : gameId))}
        onSetNote={onSetGameNote}
        selectionEnabled
        selectedGameIds={selectedGameIds}
        onToggleSelectedGame={onToggleGameSelection}
      />

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
          <GhostButton onClick={onBackSetup} style={{ width: "100%" }}>
            Konfiguration
          </GhostButton>
          <GhostButton onClick={onExportCalendar} disabled={games.length === 0} style={{ width: "100%" }}>
            Kalender (.ics)
          </GhostButton>
        </div>
        <PrimaryButton onClick={onConfirmAndGeneratePlan} disabled={pdfExporting} style={{ width: "100%" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {pdfExporting ? "Plan wird erstellt..." : "Plan öffnen"}
          </span>
        </PrimaryButton>
      </div>
    </div>
  );
}
