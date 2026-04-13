import { useState } from "react";
import { KREISE } from "../data/kreise";
import { JUGEND_KLASSEN } from "../data/altersklassen";
import { useScoutX } from "../context/ScoutXContext";
import { AgeGroupSelector } from "../components/AgeGroupSelector";
import { DateFocusPanel } from "../components/DateFocusPanel";
import { KreisSelector } from "../components/KreisSelector";
import { TeamPicker } from "../components/TeamPicker";
import { PrimaryButton } from "../components/Buttons";
import { SectionHeader } from "../components/SectionHeader";
import { C, card, inp, lbl, secH } from "../styles/theme";
import { clearRuntimeGoogleMapsApiKey, getGoogleRoutingConfig, setRuntimeGoogleMapsApiKey } from "../utils/geo";

export function SetupPage() {
  const {
    isMobile,
    kreisId,
    jugendId,
    jugend,
    selectedTeams,
    activeTeams,
    jugendSubLevels,
    availableJugendSubLevels,
    teamDraft,
    teamValidation,
    fromDate,
    focus,
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
    onSetFocus,
    onBuildAndGo,
    onSetLocationDraft,
    onResolveLocation,
    onUseCurrentLocation,
    onClearLocation,
    onSetScoutName,
    onSetKmPauschale,
  } = useScoutX();
  const [googleStatusVersion, setGoogleStatusVersion] = useState(0);
  const [googleKeyDraft, setGoogleKeyDraft] = useState("");
  const [googleKeyNotice, setGoogleKeyNotice] = useState("");
  const googleRouting = getGoogleRoutingConfig();
  const selectedKreis = KREISE.find((item) => item.id === kreisId) || null;
  const summaryParts = [
    selectedKreis?.label || "Kein Kreis",
    jugend?.label || "Keine Altersklasse",
    `${activeTeams.length || 0} Vereinsparameter`,
    hasLocation ? "Startort gesetzt" : "Ohne Startort",
  ];
  const teamParameterCount = activeTeams.length || 0;
  const statusLabel = loadingGames || resolvingLocation ? "System arbeitet..." : "System bereit / Live-Daten";
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

  const onSaveRuntimeGoogleKey = () => {
    const ok = setRuntimeGoogleMapsApiKey(googleKeyDraft);
    setGoogleKeyDraft("");
    setGoogleKeyNotice(ok ? "API-Key lokal im Browser gespeichert." : "Bitte einen gültigen API-Key eintragen.");
    setGoogleStatusVersion((value) => value + 1);
  };

  const onClearRuntimeGoogleKey = () => {
    clearRuntimeGoogleMapsApiKey();
    setGoogleKeyNotice("Lokal gespeicherter API-Key entfernt.");
    setGoogleStatusVersion((value) => value + 1);
  };

  return (
    <div className="fu">
      <header className="setup-exec-head">
        <div>
          <span className="setup-exec-eyebrow">Systemkonfiguration</span>
          <h1 className="setup-exec-title">Scouting-Plan konfigurieren</h1>
          <p className="setup-exec-subline">
            Definiere Kreis, Altersklasse und optional Mannschaften/Vereine für eine saubere, schnelle Spielauswahl.
          </p>
        </div>
        <div className="setup-exec-status" aria-live="polite">
          <span className="setup-exec-status-dot" />
          <span>{statusLabel}</span>
        </div>
      </header>

      <div className="setup-exec-grid">
        <div className="setup-exec-left">
          <KreisSelector kreise={KREISE} kreisId={kreisId} onSelect={onSelectKreis} isMobile={isMobile} />
          <AgeGroupSelector
            jugendKlassen={JUGEND_KLASSEN}
            jugendId={jugendId}
            onSelect={onSelectJugend}
            jugend={jugend}
            availableSubLevels={availableJugendSubLevels}
            selectedSubLevels={jugendSubLevels}
            onToggleSubLevel={onToggleJugendSubLevel}
            onClearSubLevels={onClearJugendSubLevels}
          />

          <DateFocusPanel
            fromDate={fromDate}
            onFromDate={onSetFromDate}
            focus={focus}
            onFocus={onSetFocus}
            jugend={jugend}
            jugendId={jugendId}
          />
        </div>

        <div className="setup-exec-right">
          <div>
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

          <div>
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ ...secH, marginBottom: 14 }}>
                <span className="section-number">06</span>
                Startort
              </div>

              <div style={{ marginBottom: 10 }}>
                <label htmlFor="start-location-input" style={lbl}>
                  Startort / Abfahrtsadresse
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
                  key={googleStatusVersion}
                  style={{
                    marginTop: 8,
                    borderRadius: 8,
                    border: `1px solid ${googleRouting.googleConfigured ? C.greenBorder : "rgba(251,191,36,0.2)"}`,
                    background: googleRouting.googleConfigured ? C.greenDim : C.warnDim,
                    padding: "8px 10px",
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: googleRouting.googleConfigured ? C.grayLight : "#fcd34d",
                  }}
                >
                  <strong style={{ color: googleRouting.googleConfigured ? C.greenLight : C.warn }}>
                    Routen-API: {googleRouting.googleConfigured ? "Google Maps aktiv" : "Google Maps API-Key fehlt"}
                  </strong>
                  <div>
                    {googleRouting.googleConfigured
                      ? "Entfernungen für Route/Fahrtkosten werden über Google Routes API berechnet."
                      : `Für exakte Fahrtkosten bitte ${googleRouting.keyEnvVar} in .env.local setzen und App neu starten.`}
                  </div>
                  {!googleRouting.googleConfigured ? (
                    <div style={{ marginTop: 6 }}>
                      <div>
                        Setup: <code>VITE_GOOGLE_MAPS_API_KEY=...</code> · optional{" "}
                        <code>VITE_GOOGLE_MAPS_STRICT=true</code> ·{" "}
                        <a
                          href="https://console.cloud.google.com/apis/credentials"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: C.warn, textDecoration: "underline" }}
                        >
                          Google Cloud Console
                        </a>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                        <input
                          type="password"
                          value={googleKeyDraft}
                          onChange={(event) => setGoogleKeyDraft(event.target.value)}
                          placeholder="Google API-Key lokal speichern"
                          style={{
                            ...inp,
                            flex: 1,
                            minWidth: 210,
                            height: 34,
                            padding: "6px 10px",
                            fontSize: 12,
                          }}
                        />
                        <button
                          type="button"
                          onClick={onSaveRuntimeGoogleKey}
                          style={{
                            ...inp,
                            width: "auto",
                            minWidth: 140,
                            height: 34,
                            padding: "6px 10px",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          API-Key speichern
                        </button>
                      </div>
                      {googleKeyNotice ? (
                        <div style={{ marginTop: 6, color: C.grayLight }}>{googleKeyNotice}</div>
                      ) : null}
                    </div>
                  ) : (
                    <div>
                      Provider: <code>{googleRouting.routeProvider}</code>
                      {googleRouting.strictActive ? " · Strict aktiv" : googleRouting.strictRequested ? " · Strict angefordert" : ""}
                      {googleRouting.keySource === "runtime" ? " · Key lokal gespeichert" : ""}
                      {googleRouting.keySource === "env" ? " · Key via ENV" : ""}
                      {googleRouting.keySource === "runtime" ? (
                        <button
                          type="button"
                          onClick={onClearRuntimeGoogleKey}
                          style={{
                            marginLeft: 10,
                            border: "none",
                            background: "transparent",
                            color: C.grayLight,
                            cursor: "pointer",
                            textDecoration: "underline",
                            fontSize: 11,
                            padding: 0,
                          }}
                        >
                          lokalen Key entfernen
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
                {locationError ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#fca5a5" }}>{locationError}</div>
                ) : null}
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

            <div id="fahrtkosten" style={{ ...card, marginTop: 16, scrollMarginTop: 96 }}>
              <SectionHeader>Fahrtkosten</SectionHeader>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12, alignItems: "end" }}>
                <div>
                  <label htmlFor="scout-name-input" style={lbl}>Scout-Name (für Abrechnung)</label>
                  <input
                    id="scout-name-input"
                    style={inp}
                    type="text"
                    value={scoutName}
                    onChange={(e) => onSetScoutName(e.target.value)}
                    placeholder="Vor- und Nachname"
                    autoComplete="name"
                    inputMode="text"
                    maxLength={80}
                  />
                </div>
                <div>
                  <label htmlFor="km-pauschale-input" style={lbl}>€ / km</label>
                  <input
                    id="km-pauschale-input"
                    style={inp}
                    type="number"
                    value={kmPauschale}
                    step="0.01"
                    min="0.01"
                    max="2.00"
                    onChange={(e) => onSetKmPauschale(e.target.value)}
                  />
                </div>
              </div>
              <p style={{ fontSize: 11, color: C.gray, marginTop: 8, marginBottom: 0 }}>
                Kilometerpauschale für die automatische Fahrtkosten-Abrechnung im Scout-Plan.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="setup-action-bar">
        <div className="setup-action-meta">
          <span className="setup-action-eyebrow">Ausgewählte Konfiguration</span>
          <span>{summaryParts.join(" / ")}</span>
        </div>
        <PrimaryButton
          onClick={onBuildAndGo}
          disabled={!canBuild || loadingGames}
          style={{
            width: isMobile ? "100%" : "auto",
            minWidth: isMobile ? "100%" : 300,
            fontSize: isMobile ? 13 : 14,
          }}
        >
          {loadingGames ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <span className="skeleton" style={{ width: 16, height: 16, borderRadius: "50%" }} />
              Spiele werden geladen...
            </span>
          ) : !canBuild ? (
            !kreisId ? (
              "Kreis wählen"
            ) : !jugendId ? (
              "Jugendklasse wählen"
            ) : (
              "Ungültige Auswahl"
            )
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
              {teamParameterCount > 0
                ? `Spielplan generieren — ${teamParameterCount} Team-Parameter`
                : "Spielplan generieren"}
            </span>
          )}
        </PrimaryButton>
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
