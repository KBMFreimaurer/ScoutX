import { useEffect, useMemo, useState } from "react";
import { GhostButton, PrimaryButton } from "../components/Buttons";
import { GameCards } from "../components/GameCards";
import { GameTable } from "../components/GameTable";
import { TopFive } from "../components/TopFive";
import { useScoutX } from "../context/ScoutXContext";
import { C } from "../styles/theme";
import { formatDistanceKm } from "../utils/geo";

export function GamesPage() {
  const {
    games,
    jugend,
    kreis,
    activeTeams,
    startLocation,
    teamValidation,
    enrichingGames,
    prioritized,
    gameNotes,
    pdfExporting,
    onSetGameNote,
    onBackSetup,
    onGeneratePlanPdf,
  } = useScoutX();
  const PAGE_SIZE = 20;
  const requestedTeamCount = Number(teamValidation?.requestedCount || 0);
  const matchedTeamCount = Number(teamValidation?.matchedTeamCount || 0);
  const matchedGameCount =
    typeof teamValidation?.matchedCount === "number"
      ? teamValidation.matchedCount
      : games.filter((game) => game.selectedTeamMatch).length;
  const showTeamHint = requestedTeamCount > 0;
  const shouldPaginate = games.length > 100;
  const [sortMode, setSortMode] = useState("priority");
  const [expandedNoteId, setExpandedNoteId] = useState(null);
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

    return [...games].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  }, [games, sortMode]);
  const totalPages = shouldPaginate ? Math.ceil(sortedGames.length / PAGE_SIZE) : 1;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [games.length]);

  const visibleGames = useMemo(() => {
    if (!shouldPaginate) {
      return sortedGames;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedGames.slice(start, start + PAGE_SIZE);
  }, [sortedGames, currentPage, shouldPaginate]);

  return (
    <div className="fu">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
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
            {jugend?.label} · {kreis?.label}
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
            {games.length} {jugend?.turnier ? "Begegnungen" : "Spiele"} · {activeTeams.length} Team-Parameter
          </div>

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
              Entfernungen und Wetter werden gerade aktualisiert.
            </div>
          ) : null}
        </div>
      </div>

      <TopFive games={prioritized} />

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
            <option value="priority">Priorität</option>
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
      />
      <GameCards
        games={visibleGames}
        notes={gameNotes}
        expandedNoteId={expandedNoteId}
        onToggleNote={(gameId) => setExpandedNoteId((current) => (current === gameId ? null : gameId))}
        onSetNote={onSetGameNote}
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

      <PrimaryButton onClick={onGeneratePlanPdf} disabled={pdfExporting} style={{ width: "100%" }}>
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
          {pdfExporting ? "Scout-Plan wird erstellt..." : "Scout-Plan erstellen"}
        </span>
      </PrimaryButton>
    </div>
  );
}
