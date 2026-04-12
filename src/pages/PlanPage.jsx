import { useEffect, useMemo, useState } from "react";
import { GhostButton } from "../components/Buttons";
import { GameCards } from "../components/GameCards";
import { GameTable } from "../components/GameTable";
import { PDFExport } from "../components/PDFExport";
import { PlanView } from "../components/PlanView";
import { FahrtkostenTabelle } from "../components/FahrtkostenTabelle";
import { SectionHeader } from "../components/SectionHeader";
import { useScoutX } from "../context/ScoutXContext";
import { C } from "../styles/theme";
import { downloadCalendarIcs } from "../utils/calendar";
import { formatDistanceKm } from "../utils/geo";

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
    isMobile,
    cfg,
    routeOverview,
    routeCalculating,
    startLocation,
    scoutName,
    kmPauschale,
    setErr,
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

  useEffect(() => {
    setCurrentPage(1);
  }, [activeGames.length]);

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
            Scout-Plan · {jugend?.label}
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
            {kreis?.label}
          </div>
        </div>

        <PDFExport
          games={activeGames}
          plan={plan}
          cfg={{
            ...cfg,
            routeOverview,
            startLocation,
            startLocationLabel: startLocation?.label || cfg?.startLocationLabel || "",
            scoutName,
            kmPauschale,
            kmOverrides,
          }}
          syncContext={{
            source: dataSourceUsed,
            adapterEndpoint,
            adapterToken,
            kreisId,
            jugendId,
            fromDate,
            teams: activeTeams,
            turnier: Boolean(jugend?.turnier),
          }}
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

      {startLocation && routeCalculating ? (
        <div aria-live="polite" style={{ fontSize: 12, color: C.grayDark, marginBottom: 10 }}>
          Route wird berechnet. Danach ist der PDF-Export vollständig.
        </div>
      ) : null}

      <PlanView plan={plan} jugendLabel={jugend?.label} kreisLabel={kreis?.label} isMobile={isMobile} games={activeGames} />

      {activeGames.length > 0 ? (
        <div style={{ marginTop: 28, marginBottom: 28 }} className="fu2">
          <SectionHeader>Fahrtkosten-Abrechnung</SectionHeader>
          <FahrtkostenTabelle
            games={activeGames}
            routeOverview={routeOverview}
            kmPauschale={kmPauschale}
            isMobile={isMobile}
            onKmChange={handleKmChange}
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
            {hasManualSelection ? "Ausgewählte" : "Alle"} {activeGames.length} Spiele · {jugend?.label} ·{" "}
            {kreis?.label}
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
