import { GhostButton } from "../components/Buttons";
import { GameCards } from "../components/GameCards";
import { GameTable } from "../components/GameTable";
import { PDFExport } from "../components/PDFExport";
import { PlanView } from "../components/PlanView";
import { useScoutPlan } from "../context/ScoutPlanContext";
import { C } from "../styles/theme";

export function PlanPage() {
  const {
    games,
    plan,
    kreis,
    jugend,
    llmModel,
    isMobile,
    cfg,
    onBackGames,
    onResetSoft,
    onResetHard,
  } = useScoutPlan();

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
              fontFamily: "'Inter',sans-serif",
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

          <div style={{ fontSize: 12, color: C.gray, marginTop: 2, fontFamily: "'Inter',sans-serif" }}>
            {kreis?.label} · {llmModel}
          </div>
        </div>

        <PDFExport games={games} plan={plan} cfg={cfg} variant="primary" label="PDF Export" />
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
            fontFamily: "'Inter',sans-serif",
            fontWeight: 600,
          }}
        >
          Alle {games.length} Spiele · {jugend?.label} · {kreis?.label}
        </div>

        <GameTable games={games} mode="plan" />

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
          <GameCards games={games} />
        </div>
      </div>

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
