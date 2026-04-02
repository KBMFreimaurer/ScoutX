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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <GhostButton onClick={onBackGames}>← Spiele</GhostButton>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontWeight: 900,
              fontSize: isMobile ? 18 : 22,
              color: C.white,
              textTransform: "uppercase",
              letterSpacing: "1px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Scout-Plan · {jugend?.label}
          </div>

          <div style={{ fontSize: 12, color: C.gray }}>
            {kreis?.label} · {llmModel}
          </div>
        </div>

        <PDFExport games={games} plan={plan} cfg={cfg} variant="primary" label="↓ PDF" />
      </div>

      <PlanView plan={plan} jugendLabel={jugend?.label} kreisLabel={kreis?.label} isMobile={isMobile} />

      <div className="fu3" style={{ marginBottom: 14 }}>
        <div
          style={{
            padding: "10px 16px",
            background: "#161616",
            borderRadius: "8px 8px 0 0",
            border: `1px solid ${C.border}`,
            borderBottom: "none",
            fontSize: 10,
            color: C.gray,
            letterSpacing: "2px",
            textTransform: "uppercase",
            fontFamily: "'Barlow Condensed',sans-serif",
            fontWeight: 700,
          }}
        >
          Alle {games.length} Spiele · {jugend?.label} · {kreis?.label}
        </div>

        <GameTable games={games} mode="plan" />

        <div
          className="game-cards"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderTop: "none",
            borderRadius: "0 0 8px 8px",
            padding: "10px",
          }}
        >
          <GameCards games={games} />
        </div>
      </div>

      <div className="reset-row">
        <GhostButton onClick={onResetSoft} style={{ width: "100%", justifyContent: "center", textAlign: "center" }}>
          ↺ Gleicher Kreis, neuer Plan
        </GhostButton>
        <GhostButton onClick={onResetHard} style={{ width: "100%", justifyContent: "center", textAlign: "center" }}>
          ⊕ Komplett neu starten
        </GhostButton>
      </div>
    </div>
  );
}
