import { useMemo, useState } from "react";
import { JUGEND_KLASSEN } from "../data/altersklassen";
import { GhostButton, PrimaryButton } from "../components/Buttons";
import { AgeGroupSelector } from "../components/AgeGroupSelector";
import { DateFocusPanel } from "../components/DateFocusPanel";
import { KreisSelector } from "../components/KreisSelector";
import { StateSelector } from "../components/StateSelector";
import { SectionHeader } from "../components/SectionHeader";
import { getLeaguePresetsByState } from "../data/leaguePresets";
import { useScoutX } from "../context/ScoutXContext";
import { isNativeCapacitorRuntime } from "../native/deepLinks";
import { C, card, inp, lbl, secH } from "../styles/theme";
import { getGoogleRoutingConfig } from "../utils/geo";

const SETUP_STEPS = [
  { id: 1, title: "Bundesland" },
  { id: 2, title: "Region & Kreis" },
  { id: 3, title: "Altersklasse" },
  { id: 4, title: "Zeitraum" },
  { id: 5, title: "Startpunkt" },
  { id: 6, title: "Fahrtkosten" },
  { id: 7, title: "Zusammenfassung" },
];

function formatIsoDateLabel(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "Nicht gesetzt";
  }
  const parsed = new Date(`${text}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

function formatDateRangeLabel(fromDate, toDate) {
  const fromLabel = formatIsoDateLabel(fromDate);
  const toLabel = formatIsoDateLabel(toDate);
  return `${fromLabel} bis ${toLabel}`;
}

function buildKreisSelectionLabel(kreise) {
  const safeKreise = Array.isArray(kreise) ? kreise.filter(Boolean) : [];
  if (safeKreise.length === 0) {
    return "Kein Kreis";
  }

  if (safeKreise.length === 1) {
    return safeKreise[0].displayName || safeKreise[0].label || safeKreise[0].name;
  }

  return `${safeKreise.length} Kreise (${safeKreise.map((item) => item.shortCode || item.kurz).join(", ")})`;
}

function buildStepCompletionMap({ selectedStateCode, kreisIds, jugendIds, fromDate, toDate, scoutName, kmPauschale }) {
  const hasValidRange = Boolean(fromDate && toDate && String(toDate) >= String(fromDate));
  const hasScoutName = Boolean(String(scoutName || "").trim());
  const hasKmPauschale = Number(kmPauschale) > 0;
  const hasKreisSelection = Array.isArray(kreisIds) && kreisIds.length > 0;

  return {
    1: Boolean(selectedStateCode),
    2: hasKreisSelection,
    3: Array.isArray(jugendIds) && jugendIds.length > 0,
    4: hasValidRange,
    5: true,
    6: hasScoutName && hasKmPauschale,
    7: canBuildStepCompletion({
      hasKreisSelection,
      hasJugendSelection: Array.isArray(jugendIds) && jugendIds.length > 0,
      hasValidRange,
      hasScoutName,
      hasKmPauschale,
    }),
  };
}

function canBuildStepCompletion({ hasKreisSelection, hasJugendSelection, hasValidRange, hasScoutName, hasKmPauschale }) {
  return Boolean(hasKreisSelection && hasJugendSelection && hasValidRange && hasScoutName && hasKmPauschale);
}

export function SetupPage() {
  const {
    isMobile,
    states,
    selectedStateCode,
    selectedState,
    availableRegions,
    kreisIds,
    jugendId,
    jugendIds,
    jugend,
    jugendSubLevels,
    availableJugendSubLevels,
    selectedTeams,
    teamDraft,
    fromDate,
    toDate,
    canBuild,
    loadingGames,
    err,
    startLocation,
    locationDraft,
    locationError,
    resolvingLocation,
    hasLocation,
    scoutName,
    kmPauschale,
    onSelectState,
    onSelectKreis,
    onSelectJugend,
    onToggleJugendSubLevel,
    onClearJugendSubLevels,
    onAddTeamField,
    onUpdateTeamField,
    onNormalizeTeamField,
    onRemoveTeamField,
    onSetTeamDraft,
    onClearAllTeams,
    onSetFromDate,
    onSetToDate,
    onBuildAndGo,
    onSetLocationDraft,
    onResolveLocation,
    onUseCurrentLocation,
    onClearLocation,
    onSetScoutName,
    onSetKmPauschale,
    favorites,
    favoriteDraft,
    includeNationalGames,
    includeTournaments,
    onSetFavoriteDraft,
    onAddFavoriteTeam,
    onRemoveFavoriteTeam,
    onClearFavoriteTeams,
    onSetIncludeNationalGames,
    onSetIncludeTournaments,
  } = useScoutX();

  const [currentStep, setCurrentStep] = useState(1);

  const googleRouting = getGoogleRoutingConfig();
  const isNativeRuntime = isNativeCapacitorRuntime();
  const usePinnedActionBar = isMobile || isNativeRuntime;
  const useNativeTabOffset = isNativeRuntime;
  const totalSteps = SETUP_STEPS.length;
  const selectedKreise = useMemo(() => availableRegions.filter((item) => (Array.isArray(kreisIds) ? kreisIds : []).includes(item.id)), [
    availableRegions,
    kreisIds,
  ]);
  const selectedKreisLabel = useMemo(() => buildKreisSelectionLabel(selectedKreise), [selectedKreise]);
  const stepCompletionMap = buildStepCompletionMap({
    selectedStateCode,
    kreisIds,
    jugendIds,
    fromDate,
    toDate,
    scoutName,
    kmPauschale,
  });
  const leaguePresets = useMemo(() => getLeaguePresetsByState(selectedStateCode), [selectedStateCode]);
  const currentStepMeta = SETUP_STEPS[currentStep - 1];
  const nextStepMeta = SETUP_STEPS[currentStep] || null;
  const summaryParts = [
    selectedKreisLabel,
    Array.isArray(jugendIds) && jugendIds.length > 1 ? `${jugendIds.length} Altersklassen` : jugend?.label || "Keine Altersklasse",
    hasLocation ? "Startpunkt gesetzt" : "Ohne Startpunkt",
  ];
  const statusLabel = loadingGames || resolvingLocation ? "System arbeitet..." : "System bereit / Live-Daten";

  const canContinueToNext = useMemo(() => {
    if (currentStep >= totalSteps) {
      return false;
    }
    return Boolean(stepCompletionMap[currentStep]);
  }, [currentStep, totalSteps, stepCompletionMap]);

  const nextButtonLabel = useMemo(() => {
    if (currentStep === 1 && !selectedStateCode) {
      return "Bundesland auswählen";
    }
    if (currentStep === 2 && (!Array.isArray(kreisIds) || kreisIds.length === 0)) {
      return "Region & Kreis auswählen";
    }
    if (currentStep === 3 && (!Array.isArray(jugendIds) || jugendIds.length === 0)) {
      return "Altersklasse auswählen";
    }
    if (currentStep === 4 && (!fromDate || !toDate || String(toDate) < String(fromDate))) {
      return "Zeitraum auswählen";
    }
    if (currentStep === 6 && !String(scoutName || "").trim()) {
      return "Scout-Name eintragen";
    }
    return nextStepMeta ? `Weiter zu ${nextStepMeta.title}` : "Weiter";
  }, [currentStep, fromDate, toDate, jugendIds, kreisIds, scoutName, nextStepMeta, selectedStateCode]);

  const onConfirmUseCurrentLocation = () => {
    const shouldProceed =
      typeof window === "undefined" || typeof window.confirm !== "function"
        ? true
        : window.confirm("Soll der genaue Standort jetzt ermittelt werden?");

    if (!shouldProceed) {
      return;
    }

    onUseCurrentLocation();
  };

  const onBackStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const onNextStep = () => {
    if (!canContinueToNext) {
      return;
    }
    setCurrentStep((prev) => Math.min(totalSteps, prev + 1));
  };

  const onJumpToStep = (targetStep) => {
    const numericStep = Number(targetStep);
    if (!Number.isFinite(numericStep) || numericStep >= currentStep || numericStep < 1) {
      return;
    }
    setCurrentStep(numericStep);
  };

  const renderStartpunktCard = () => (
    <div style={card}>
      <div style={{ ...secH, marginBottom: 14 }}>
        <span className="section-number">05</span>
        Startpunkt
      </div>

      <div style={{ marginBottom: 10 }}>
        <label htmlFor="start-location-input" style={lbl}>
          Startpunkt / Einsatzadresse
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            id="start-location-input"
            className="scout-input"
            value={locationDraft}
            onChange={(event) => onSetLocationDraft(event.target.value)}
            placeholder="Straße, PLZ, Ort"
            style={{ ...inp, flex: 1, minWidth: 220 }}
          />
          <button
            type="button"
            onClick={() => onResolveLocation()}
            disabled={resolvingLocation}
            style={{
              ...inp,
              width: "auto",
              minWidth: 132,
              cursor: resolvingLocation ? "not-allowed" : "pointer",
            }}
          >
            {resolvingLocation ? "Prüfe..." : "Adresse prüfen"}
          </button>
          <button
            type="button"
            onClick={onConfirmUseCurrentLocation}
            disabled={resolvingLocation}
            style={{
              ...inp,
              width: "auto",
              minWidth: 210,
              cursor: resolvingLocation ? "not-allowed" : "pointer",
            }}
          >
            Genauen Standort ermitteln
          </button>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: hasLocation ? C.green : C.gray }}>
          {hasLocation ? "Standort gesetzt ✓" : "Kein Standort gesetzt"}
          {startLocation?.label ? ` · ${startLocation.label}` : ""}
        </div>
        <div
          style={{
            marginTop: 8,
            borderRadius: 8,
            border: `1px solid ${C.greenBorder}`,
            background: C.greenDim,
            padding: "8px 10px",
            fontSize: 11,
            lineHeight: 1.5,
            color: C.grayLight,
          }}
        >
          <strong style={{ color: C.greenLight }}>Routen-API: Google Maps aktiv</strong>
          <div>Entfernungen für Route/Fahrtkosten werden über Google Routes API berechnet.</div>
          <div>
            Provider: <code>{googleRouting.routeProvider}</code>
            {googleRouting.strictActive
              ? " · Strict aktiv"
              : googleRouting.strictRequested
                ? " · Strict angefordert"
                : ""}
            {googleRouting.keySource ? ` · Key-Quelle: ${googleRouting.keySource}` : ""}
          </div>
        </div>
        {locationError ? <div style={{ marginTop: 6, fontSize: 12, color: "#fca5a5" }}>{locationError}</div> : null}
        {hasLocation ? (
          <button
            type="button"
            onClick={onClearLocation}
            style={{
              marginTop: 8,
              border: "none",
              background: "transparent",
              color: C.gray,
              cursor: "pointer",
              padding: 0,
              fontSize: 12,
            }}
          >
            Standort entfernen
          </button>
        ) : null}
      </div>
    </div>
  );

  const renderFahrtkostenCard = () => (
    <div id="fahrtkosten" style={{ ...card, scrollMarginTop: 96 }}>
      <SectionHeader num="06">Fahrtkosten</SectionHeader>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12, alignItems: "end" }}>
        <div>
          <label htmlFor="scout-name-input" style={lbl}>
            Scout-Name (für Abrechnung)
          </label>
          <input
            id="scout-name-input"
            style={inp}
            type="text"
            value={scoutName}
            onChange={(event) => onSetScoutName(event.target.value)}
            placeholder="Vor- und Nachname"
            autoComplete="name"
            inputMode="text"
            maxLength={80}
          />
        </div>
        <div>
          <label htmlFor="km-pauschale-input" style={lbl}>
            € / km
          </label>
          <input
            id="km-pauschale-input"
            style={inp}
            type="number"
            value={kmPauschale}
            step="0.01"
            min="0.01"
            max="2.00"
            onChange={(event) => onSetKmPauschale(event.target.value)}
          />
        </div>
      </div>
      <p style={{ fontSize: 11, color: C.gray, marginTop: 8, marginBottom: 0 }}>
        Kilometerpauschale für die automatische Fahrtkosten-Abrechnung im Scout-Plan.
      </p>
    </div>
  );

  const renderLigaParameterCard = () => (
    <div style={{ ...card, marginTop: 12 }}>
      <div style={{ ...secH, marginBottom: 10 }}>
        <span className="section-number">03b</span>
        Liga-Parameter (optional)
      </div>
      <p style={{ fontSize: 12, color: C.gray, marginTop: 0 }}>
        Wenn du hier eine Liga angibst, nimmt ScoutX nur passende Spiele in den Plan auf. Regionale Varianten wie
        Leistungsklasse oder Kreisleistungsklasse werden dabei tolerant abgeglichen.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          aria-label="Liga-Parameter hinzufügen"
          className="scout-input"
          value={teamDraft}
          onChange={(event) => onSetTeamDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAddTeamField();
              onNormalizeTeamField();
            }
          }}
          placeholder="z. B. Niederrheinliga, Leistungsklasse, Bezirksliga"
          style={{ ...inp, flex: 1, minWidth: 260 }}
        />
        <button
          type="button"
          onClick={() => {
            onAddTeamField();
            onNormalizeTeamField();
          }}
          style={{ ...inp, width: "auto", minWidth: 132 }}
        >
          Liga hinzufügen
        </button>
      </div>
      {leaguePresets.length > 0 ? (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {leaguePresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onAddTeamField(preset)}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 999,
                background: "rgba(255,255,255,0.03)",
                color: C.grayLight,
                cursor: "pointer",
                padding: "5px 10px",
                fontSize: 12,
              }}
            >
              {preset}
            </button>
          ))}
        </div>
      ) : null}

      {Array.isArray(selectedTeams) && selectedTeams.length > 0 ? (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {selectedTeams.map((value, index) => (
            <div key={`${value}-${index}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                aria-label={`Liga-Parameter ${index + 1}`}
                className="scout-input"
                value={value}
                onChange={(event) => onUpdateTeamField(index, event.target.value)}
                onBlur={() => onNormalizeTeamField()}
                style={{ ...inp, flex: 1 }}
              />
              <button
                type="button"
                aria-label={`Liga-Parameter ${index + 1} entfernen`}
                onClick={() => onRemoveTeamField(index)}
                style={{ ...inp, width: "auto" }}
              >
                Entfernen
              </button>
            </div>
          ))}
          <button
            type="button"
            aria-label="Alle Liga-Parameter entfernen"
            onClick={onClearAllTeams}
            style={{
              marginTop: 2,
              border: "none",
              background: "transparent",
              color: C.gray,
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
              textAlign: "left",
              fontSize: 12,
            }}
          >
            Alle Liga-Parameter entfernen
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 8, fontSize: 12, color: C.gray }}>
          Noch keine Liga-Parameter gesetzt.
        </div>
      )}
    </div>
  );

  const renderFavoritesCard = () => (
    <div style={{ ...card, marginTop: 12 }}>
      <div style={{ ...secH, marginBottom: 10 }}>
        <span className="section-number">03c</span>
        Lieblingsvereine (optional)
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          aria-label="Lieblingsverein hinzufügen"
          className="scout-input"
          value={favoriteDraft}
          onChange={(event) => onSetFavoriteDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAddFavoriteTeam();
            }
          }}
          placeholder="z. B. Borussia Mönchengladbach U17"
          style={{ ...inp, flex: 1, minWidth: 260 }}
        />
        <button type="button" onClick={() => onAddFavoriteTeam()} style={{ ...inp, width: "auto", minWidth: 132 }}>
          Favorit +
        </button>
      </div>
      {Array.isArray(favorites) && favorites.length > 0 ? (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {favorites.map((team, index) => (
            <button key={`${team}-${index}`} type="button" onClick={() => onRemoveFavoriteTeam(index)} style={{ ...inp, width: "auto" }}>
              {team} ×
            </button>
          ))}
          <button type="button" onClick={onClearFavoriteTeams} style={{ ...inp, width: "auto" }}>
            Alle entfernen
          </button>
        </div>
      ) : null}
    </div>
  );

  const renderCompetitionSourceCard = () => (
    <div style={{ ...card, marginTop: 12 }}>
      <div style={{ ...secH, marginBottom: 10 }}>
        <span className="section-number">03d</span>
        Zusätzliche Wettbewerbe
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", color: C.grayLight, fontSize: 13 }}>
          <input type="checkbox" checked={includeNationalGames} onChange={(event) => onSetIncludeNationalGames(event.target.checked)} />
          Länderspiele (DFB.de) zusätzlich laden
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", color: C.grayLight, fontSize: 13 }}>
          <input type="checkbox" checked={includeTournaments} onChange={(event) => onSetIncludeTournaments(event.target.checked)} />
          Turniere zusätzlich laden
        </label>
      </div>
    </div>
  );

  const renderSummaryCard = () => (
    <div style={card}>
      <SectionHeader>Zusammenfassung</SectionHeader>
      <div className="setup-summary-grid">
        <div className="setup-summary-item">
          <span className="setup-summary-label">Bundesland</span>
          <span className="setup-summary-value">{selectedState?.name || "Nicht gesetzt"}</span>
        </div>
        <div className="setup-summary-item">
          <span className="setup-summary-label">Region & Kreis</span>
          <span className="setup-summary-value">{selectedKreisLabel || "Nicht gesetzt"}</span>
        </div>
        <div className="setup-summary-item">
          <span className="setup-summary-label">Altersklasse</span>
          <span className="setup-summary-value">{jugend?.label || "Nicht gesetzt"}</span>
        </div>
        <div className="setup-summary-item">
          <span className="setup-summary-label">Liga-Parameter</span>
          <span className="setup-summary-value">
            {Array.isArray(selectedTeams) && selectedTeams.length > 0 ? selectedTeams.join(", ") : "Keine gesetzt"}
          </span>
        </div>
        <div className="setup-summary-item">
          <span className="setup-summary-label">Zeitraum</span>
          <span className="setup-summary-value">{formatDateRangeLabel(fromDate, toDate)}</span>
        </div>
        <div className="setup-summary-item">
          <span className="setup-summary-label">Startpunkt</span>
          <span className="setup-summary-value">{startLocation?.label || "Nicht gesetzt"}</span>
        </div>
        <div className="setup-summary-item">
          <span className="setup-summary-label">Fahrtkosten</span>
          <span className="setup-summary-value">
            {String(scoutName || "").trim() || "Scout nicht gesetzt"} · {Number(kmPauschale || 0).toFixed(2)} €/km
          </span>
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return <StateSelector states={states} selectedStateCode={selectedStateCode} onSelect={onSelectState} isMobile={isMobile} />;
      case 2:
        return (
          <KreisSelector
            kreise={availableRegions}
            kreisIds={kreisIds}
            onSelect={onSelectKreis}
            isMobile={isMobile}
            stateName={selectedState?.name || ""}
            disabled={!selectedStateCode}
          />
        );
      case 3:
        return (
          <>
            <AgeGroupSelector
              jugendKlassen={JUGEND_KLASSEN}
              jugendId={jugendId}
              jugendIds={jugendIds}
              onSelect={onSelectJugend}
              jugend={jugend}
              availableSubLevels={availableJugendSubLevels}
              selectedSubLevels={jugendSubLevels}
              onToggleSubLevel={onToggleJugendSubLevel}
              onClearSubLevels={onClearJugendSubLevels}
            />
            {renderLigaParameterCard()}
            {renderFavoritesCard()}
            {renderCompetitionSourceCard()}
          </>
        );
      case 4:
        return <DateFocusPanel fromDate={fromDate} toDate={toDate} onFromDate={onSetFromDate} onToDate={onSetToDate} />;
      case 5:
        return renderStartpunktCard();
      case 6:
        return renderFahrtkostenCard();
      case 7:
        return <>{renderSummaryCard()}</>;
      default:
        return null;
    }
  };

  return (
    <div className={`setup-screen${usePinnedActionBar ? " setup-screen-mobile" : ""}`}>
      <header className="setup-exec-head">
        <div>
          <span className="setup-exec-eyebrow">Systemkonfiguration</span>
          <h1 className="setup-exec-title">Scouting-Plan konfigurieren</h1>
          <p className="setup-exec-subline">
            Du wirst durch alle Parameter geführt. Wähle pro Seite einen Schritt und gehe dann weiter.
          </p>
        </div>
        <div className="setup-exec-status" aria-live="polite">
          <span className="setup-exec-status-dot" />
          <span>{statusLabel}</span>
        </div>
      </header>

      <div className="setup-wizard-progress" aria-label="Setup-Fortschritt" role="list">
        {SETUP_STEPS.map((step) => {
          const isActive = step.id === currentStep;
          const isDone = step.id < currentStep || (step.id === currentStep && stepCompletionMap[step.id]);
          const canJumpBack = step.id < currentStep;
          const className = `setup-wizard-chip${isActive ? " active" : ""}${isDone ? " done" : ""}`;

          return (
            <button
              type="button"
              key={step.id}
              className={className}
              onClick={() => onJumpToStep(step.id)}
              disabled={!canJumpBack}
              aria-label={`Schritt ${step.title}${canJumpBack ? " öffnen" : " nicht verfügbar"}`}
            >
              <span className="setup-wizard-chip-num">{String(step.id).padStart(2, "0")}</span>
              <span className="setup-wizard-chip-title">{step.title}</span>
            </button>
          );
        })}
      </div>

      <div className="setup-exec-grid">
        <div className="setup-wizard-page">
          <div className="setup-step-fill">{renderCurrentStep()}</div>
        </div>
      </div>

      {useNativeTabOffset ? <div className="setup-action-gap-guard" aria-hidden="true" /> : null}

      <div
        className={`setup-action-bar${usePinnedActionBar ? " setup-action-bar-mobile" : ""}${useNativeTabOffset ? " setup-action-bar-native-tabs" : ""}`}
      >
        <div className="setup-action-meta">
          <span className="setup-action-eyebrow">
            Schritt {currentStep} von {totalSteps}
          </span>
          <span>{currentStepMeta?.title}</span>
          {currentStep === totalSteps ? <span className="setup-action-summary">{summaryParts.join(" / ")}</span> : null}
        </div>

        <div className="setup-wizard-actions">
          {currentStep > 1 ? (
            <GhostButton aria-label="Zurück zum vorherigen Schritt" onClick={onBackStep} style={{ minWidth: 138 }}>
              Zurück
            </GhostButton>
          ) : null}

          {currentStep < totalSteps ? (
            <PrimaryButton
              aria-label="Weiter zum nächsten Schritt"
              onClick={onNextStep}
              disabled={!canContinueToNext}
              style={{
                minWidth: isMobile ? "100%" : 230,
                justifyContent: "center",
                width: isMobile ? "100%" : "auto",
              }}
            >
              {nextButtonLabel}
            </PrimaryButton>
          ) : (
            <PrimaryButton
              aria-label="Spielplan generieren"
              onClick={onBuildAndGo}
              disabled={!canBuild || loadingGames}
              style={{
                minWidth: isMobile ? "100%" : 300,
                fontSize: isMobile ? 13 : 14,
                justifyContent: "center",
                width: isMobile ? "100%" : "auto",
              }}
            >
              {loadingGames ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                  <span className="skeleton" style={{ width: 16, height: 16, borderRadius: "50%" }} />
                  Spiele werden geladen...
                </span>
              ) : (
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
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                  Spielplan generieren
                </span>
              )}
            </PrimaryButton>
          )}
        </div>
      </div>

      {err ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: 12,
            borderRadius: 10,
            border: "1px solid rgba(248,113,113,0.35)",
            background: "rgba(127,29,29,0.28)",
            color: "#fecaca",
            padding: "10px 12px",
            fontSize: 13,
          }}
        >
          {err}
        </div>
      ) : null}
    </div>
  );
}
