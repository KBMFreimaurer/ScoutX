import { GhostButton, PrimaryButton } from "../components/Buttons";
import { GameCards } from "../components/GameCards";
import { GameTable } from "../components/GameTable";
import { PDFExport } from "../components/PDFExport";
import { SkeletonLoader } from "../components/SkeletonLoader";
import { TopFive } from "../components/TopFive";
import { DATA_SOURCE_LABELS } from "../services/dataProvider";
import { useScoutPlan } from "../context/ScoutPlanContext";
import { C } from "../styles/theme";

export function GamesPage() {
  const {
    games,
    jugend,
    kreis,
    activeTeams,
    prioritized,
    cfg,
    llmModel,
    loadingAI,
    dataSourceUsed,
    onBackSetup,
    onGenerateAI,
  } = useScoutPlan();

  const dataSourceLabel = DATA_SOURCE_LABELS[dataSourceUsed] || DATA_SOURCE_LABELS.mock;

  return (
    <div className="fu">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <GhostButton onClick={onBackSetup}>← Setup</GhostButton>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontWeight: 900,
              fontSize: 24,
              color: C.white,
              textTransform: "uppercase",
              letterSpacing: "1px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {jugend?.label} · {kreis?.label}
            {jugend?.turnier ? <span style={{ fontSize: 12, color: C.warn, marginLeft: 10, fontWeight: 600 }}>TURNIER</span> : null}
          </div>

          <div style={{ fontSize: 12, color: C.gray }}>
            {games.length} {jugend?.turnier ? "Begegnungen" : "Spiele"} · {activeTeams.length} Teams · Quelle: {dataSourceLabel}
          </div>
        </div>

        <PDFExport games={games} cfg={cfg} />
      </div>

      <TopFive games={prioritized} />

      <GameTable games={games} />
      <GameCards games={games} />

      <PrimaryButton onClick={onGenerateAI} disabled={loadingAI} style={{ width: "100%" }}>
        {loadingAI ? `Analyse läuft mit ${llmModel}...` : `KI Scout-Plan für ${jugend?.label} erstellen →`}
      </PrimaryButton>

      {loadingAI ? <SkeletonLoader rows={6} /> : null}
    </div>
  );
}
