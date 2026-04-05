import { GhostButton, PrimaryButton } from "../components/Buttons";
import { GameCards } from "../components/GameCards";
import { GameTable } from "../components/GameTable";
import { SkeletonLoader } from "../components/SkeletonLoader";
import { TopFive } from "../components/TopFive";
import { DATA_SOURCE_LABELS } from "../services/dataProvider";
import { useScoutX } from "../context/ScoutXContext";
import { C } from "../styles/theme";

export function GamesPage() {
  const {
    games,
    jugend,
    kreis,
    activeTeams,
    teamValidation,
    prioritized,
    llmModel,
    loadingAI,
    dataSourceUsed,
    onBackSetup,
    onGeneratePlanPdf,
  } = useScoutX();

  const dataSourceLabel = DATA_SOURCE_LABELS[dataSourceUsed] || DATA_SOURCE_LABELS.mock;
  const requestedTeamCount = Number(teamValidation?.requestedCount || 0);
  const matchedTeamCount = Number(teamValidation?.matchedTeamCount || 0);
  const matchedGameCount =
    typeof teamValidation?.matchedCount === "number"
      ? teamValidation.matchedCount
      : games.filter((game) => game.selectedTeamMatch).length;
  const showTeamHint = requestedTeamCount > 0;

  return (
    <div className="fu">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <GhostButton onClick={onBackSetup}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Setup
        </GhostButton>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Inter',sans-serif",
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
              <span style={{
                fontSize: 11,
                color: C.warn,
                marginLeft: 10,
                fontWeight: 600,
                padding: "2px 8px",
                background: C.warnDim,
                borderRadius: 4,
                border: `1px solid rgba(251,191,36,0.15)`,
              }}>
                TURNIER
              </span>
            ) : null}
          </div>

          <div style={{ fontSize: 12, color: C.gray, marginTop: 2, fontFamily: "'Inter',sans-serif" }}>
            {games.length} {jugend?.turnier ? "Begegnungen" : "Spiele"} · {activeTeams.length} Team-Parameter · {dataSourceLabel}
          </div>

          {showTeamHint ? (
            <div style={{ fontSize: 11, color: C.grayDark, marginTop: 4, fontFamily: "'Inter',sans-serif" }}>
              Team-Hinweise: {matchedGameCount} passende Spiele · {matchedTeamCount}/{requestedTeamCount} Vereine erkannt
            </div>
          ) : null}
        </div>
      </div>

      <TopFive games={prioritized} />

      <GameTable games={games} />
      <GameCards games={games} />

      <PrimaryButton onClick={onGeneratePlanPdf} disabled={loadingAI} style={{ width: "100%" }}>
        {loadingAI ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <span className="skeleton" style={{ width: 16, height: 16, borderRadius: "50%" }} />
            Plan wird erstellt mit {llmModel}...
          </span>
        ) : (
          <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Scout-Plan erstellen
          </span>
        )}
      </PrimaryButton>

      {loadingAI ? <SkeletonLoader rows={6} /> : null}
    </div>
  );
}
