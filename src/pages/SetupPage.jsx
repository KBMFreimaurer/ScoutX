import { KREISE } from "../data/kreise";
import { JUGEND_KLASSEN } from "../data/altersklassen";
import { LLM_PRESETS } from "../data/constants";
import { useScoutX } from "../context/ScoutXContext";
import { AgeGroupSelector } from "../components/AgeGroupSelector";
import { DateFocusPanel } from "../components/DateFocusPanel";
import { DataSourceConfig } from "../components/DataSourceConfig";
import { KreisSelector } from "../components/KreisSelector";
import { LLMConfig } from "../components/LLMConfig";
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
    llmType,
    llmModel,
    llmEndpoint,
    llmKey,
    llmIsOllama,
    connStatus,
    canBuild,
    loadingGames,
    dataMode,
    adapterEndpoint,
    adapterToken,
    uploadName,
    uploadedGames,
    uploadError,
    uploadSummary,
    rememberApiKey,
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
    onApplyPreset,
    onSetLlmModel,
    onSetLlmEndpoint,
    onSetLlmKey,
    onSetRememberApiKey,
    onToggleLlmProtocol,
    onTestConnection,
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
        <div className="right-stack">
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
          </div>
        </div>

        <div className="right-stack">
          <LLMConfig
            llmType={llmType}
            llmModel={llmModel}
            llmEndpoint={llmEndpoint}
            llmKey={llmKey}
            rememberApiKey={rememberApiKey}
            llmIsOllama={llmIsOllama}
            connStatus={connStatus}
            presets={LLM_PRESETS}
            onApplyPreset={onApplyPreset}
            onSetLlmModel={onSetLlmModel}
            onSetLlmEndpoint={onSetLlmEndpoint}
            onSetLlmKey={onSetLlmKey}
            onSetRememberApiKey={onSetRememberApiKey}
            onToggleProtocol={onToggleLlmProtocol}
            onTestConnection={onTestConnection}
          />

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
