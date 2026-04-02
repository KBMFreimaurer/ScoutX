import { KREISE } from "../data/kreise";
import { JUGEND_KLASSEN } from "../data/altersklassen";
import { LLM_PRESETS } from "../data/constants";
import { useScoutPlan } from "../context/ScoutPlanContext";
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
    allTeams,
    filteredTeams,
    selectedTeams,
    teamFilter,
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
    onToggleTeam,
    onRemoveTeam,
    onSelectAll,
    onClearAll,
    onSetTeamFilter,
    onSelectFiltered,
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
  } = useScoutPlan();

  return (
    <div className="fu">
      <KreisSelector kreise={KREISE} kreisId={kreisId} onSelect={onSelectKreis} isMobile={isMobile} />

      <AgeGroupSelector jugendKlassen={JUGEND_KLASSEN} jugendId={jugendId} onSelect={onSelectJugend} jugend={jugend} />

      <TeamPicker
        allTeams={allTeams}
        filteredTeams={filteredTeams}
        selectedTeams={selectedTeams}
        teamFilter={teamFilter}
        onTeamFilter={onSetTeamFilter}
        onToggleTeam={onToggleTeam}
        onRemoveTeam={onRemoveTeam}
        onSelectAll={onSelectAll}
        onClearAll={onClearAll}
        onSelectFiltered={onSelectFiltered}
      />

      <DateFocusPanel fromDate={fromDate} onFromDate={onSetFromDate} focus={focus} onFocus={onSetFocus} jugend={jugend} jugendId={jugendId} />

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

      <PrimaryButton onClick={onBuildAndGo} disabled={!canBuild || loadingGames} style={{ width: "100%", fontSize: isMobile ? 14 : 16 }}>
        {loadingGames
          ? "Spiele werden geladen..."
          : !canBuild
            ? !kreisId
              ? "→ Kreis wählen"
              : !jugendId
                ? "→ Jugendklasse wählen"
                : "Mind. 1 Team benötigt"
            : `Spielplan generieren — ${selectedTeams.length || allTeams.length} Teams · ${jugend?.label} · ${
                KREISE.find((kreis) => kreis.id === kreisId)?.label || ""
              }`}
      </PrimaryButton>
    </div>
  );
}
