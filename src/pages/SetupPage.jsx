import { KREISE } from "../data/kreise";
import { JUGEND_KLASSEN } from "../data/altersklassen";
import { useScoutX } from "../context/ScoutXContext";
import { AgeGroupSelector } from "../components/AgeGroupSelector";
import { DateFocusPanel } from "../components/DateFocusPanel";
import { DataSourceConfig } from "../components/DataSourceConfig";
import { KreisSelector } from "../components/KreisSelector";
import { TeamPicker } from "../components/TeamPicker";
import { PrimaryButton } from "../components/Buttons";

export function SetupPage() {
  const {
    isMobile,
    kreisId,
    jugendId,
    jugend,
    selectedTeams,
    teamDraft,
    teamValidation,
    fromDate,
    focus,
    canBuild,
    loadingGames,
    dataMode,
    adapterEndpoint,
    adapterToken,
    uploadName,
    uploadedGames,
    uploadError,
    uploadSummary,
    onSelectKreis,
    onSelectJugend,
    onAddTeamField,
    onUpdateTeamField,
    onNormalizeTeamField,
    onRemoveTeamField,
    onSetTeamDraft,
    onClearAllTeams,
    onSetFromDate,
    onSetFocus,
    onBuildAndGo,
    onDataModeChange,
    onFileImport,
    onAdapterEndpointChange,
    onAdapterTokenChange,
  } = useScoutX();

  return (
    <div className="fu">
      <div className="setup-headline">
        <h1>Scouting Setup</h1>
        <p>Konfiguriere Region, Altersklasse und optionale Vereinsparameter für deinen Scout-Plan.</p>
      </div>

      <div className="setup-layout">
        <KreisSelector kreise={KREISE} kreisId={kreisId} onSelect={onSelectKreis} isMobile={isMobile} />

        <div className="setup-left-grid">
          <AgeGroupSelector jugendKlassen={JUGEND_KLASSEN} jugendId={jugendId} onSelect={onSelectJugend} jugend={jugend} />

          <DateFocusPanel
            fromDate={fromDate}
            onFromDate={onSetFromDate}
            focus={focus}
            onFocus={onSetFocus}
            jugend={jugend}
            jugendId={jugendId}
          />

          <div className="setup-span-two">
            <TeamPicker
              selectedTeams={selectedTeams}
              teamDraft={teamDraft}
              teamValidation={teamValidation}
              onTeamDraft={onSetTeamDraft}
              onAddTeam={onAddTeamField}
              onUpdateTeam={onUpdateTeamField}
              onNormalizeTeams={onNormalizeTeamField}
              onRemoveTeam={onRemoveTeamField}
              onClearAll={onClearAllTeams}
            />
          </div>

          <div className="setup-span-two">
            <DataSourceConfig
              dataMode={dataMode}
              onDataModeChange={onDataModeChange}
              onFileImport={onFileImport}
              uploadName={uploadName}
              importedCount={uploadedGames.length}
              uploadError={uploadError}
              uploadSummary={uploadSummary}
              adapterEndpoint={adapterEndpoint}
              adapterToken={adapterToken}
              onAdapterEndpointChange={onAdapterEndpointChange}
              onAdapterTokenChange={onAdapterTokenChange}
            />
          </div>
        </div>
      </div>

      <PrimaryButton
        onClick={onBuildAndGo}
        disabled={!canBuild || loadingGames}
        style={{ width: "100%", fontSize: isMobile ? 13 : 14, marginTop: 16 }}
      >
        {loadingGames ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <span className="skeleton" style={{ width: 16, height: 16, borderRadius: "50%" }} />
            Spiele werden geladen...
          </span>
        ) : !canBuild ? (
          !kreisId
            ? "Kreis wählen"
            : !jugendId
              ? "Jugendklasse wählen"
              : "Ungültige Auswahl"
        ) : (
          <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            Spielplan generieren — {selectedTeams.length || 0} Team-Parameter
          </span>
        )}
      </PrimaryButton>
    </div>
  );
}
