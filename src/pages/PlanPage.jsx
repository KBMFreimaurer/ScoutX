import { useEffect, useMemo, useState } from "react";
import { GhostButton } from "../components/Buttons";
import { GameCards } from "../components/GameCards";
import { GameTable } from "../components/GameTable";
import { PDFExport } from "../components/PDFExport";
import { PlanView } from "../components/PlanView";
import { useScoutX } from "../context/ScoutXContext";
import { C } from "../styles/theme";

export function PlanPage() {
  const {
    games,
    plan,
    kreis,
    jugend,
    isMobile,
    cfg,
    onBackGames,
    onResetSoft,
    onResetHard,
  } = useScoutX();
  const PAGE_SIZE = 20;
  const shouldPaginate = games.length > 100;
  const totalPages = shouldPaginate ? Math.ceil(games.length / PAGE_SIZE) : 1;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [games.length]);

  const visibleGames = useMemo(() => {
    if (!shouldPaginate) {
      return games;
    }
    const start = (currentPage - 1) * PAGE_SIZE;
    return games.slice(start, start + PAGE_SIZE);
  }, [games, currentPage, shouldPaginate]);

  return (
    <div className="fu">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <GhostButton onClick={onBackGames}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Spiele
        </GhostButton>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
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

          <div style={{ fontSize: 12, color: C.gray, marginTop: 2, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
            {kreis?.label}
          </div>
        </div>

        <PDFExport
          games={games}
          plan={plan}
          cfg={cfg}
          variant="primary"
          label="PDF herunterladen"
          disabled={!String(plan || "").trim()}
        />
      </div>

      <PlanView plan={plan} jugendLabel={jugend?.label} kreisLabel={kreis?.label} isMobile={isMobile} />

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
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
          fontWeight: 600,
          }}
        >
          Alle {games.length} Spiele · {jugend?.label} · {kreis?.label}
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

      {shouldPaginate ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Neuer Plan
        </GhostButton>
        <GhostButton onClick={onResetHard} style={{ width: "100%", justifyContent: "center", textAlign: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Komplett neu
        </GhostButton>
      </div>
    </div>
  );
}
