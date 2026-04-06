import { KREISE } from "../data/kreise";
import { JUGEND_KLASSEN } from "../data/altersklassen";
import { useScoutX } from "../context/ScoutXContext";
import { AgeGroupSelector } from "../components/AgeGroupSelector";
import { DateFocusPanel } from "../components/DateFocusPanel";
import { DataSourceConfig } from "../components/DataSourceConfig";
import { KreisSelector } from "../components/KreisSelector";
import { TeamPicker } from "../components/TeamPicker";
import { PrimaryButton } from "../components/Buttons";
import { C, card, inp, lbl, secH } from "../styles/theme";

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
    err,
    adapterEndpoint,
    adapterToken,
    startLocation,
    locationDraft,
    locationError,
    resolvingLocation,
    hasLocation,
    favorites,
    favoriteDraft,
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
    onAdapterEndpointChange,
    onAdapterTokenChange,
    onSetLocationDraft,
    onResolveLocation,
    onUseCurrentLocation,
    onClearLocation,
    onSetFavoriteDraft,
    onAddFavoriteTeam,
    onRemoveFavoriteTeam,
    onClearFavoriteTeams,
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
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ ...secH, marginBottom: 14 }}>
                <span className="section-number">06</span>
                Startort & Favoriten
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
                    onClick={onUseCurrentLocation}
                    disabled={resolvingLocation}
                    style={{
                      ...inp,
                      width: "auto",
                      minWidth: 210,
                      cursor: resolvingLocation ? "not-allowed" : "pointer",
                    }}
                  >
                    Aktuellen Standort verwenden
                  </button>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: hasLocation ? C.green : C.gray }}>
                  {hasLocation ? "Standort gesetzt ✓" : "Kein Standort gesetzt"}
                  {startLocation?.label ? ` · ${startLocation.label}` : ""}
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

              <div>
                <label htmlFor="favorite-team-input" style={lbl}>
                  Beobachtete Teams (immer priorisieren)
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    id="favorite-team-input"
                    className="scout-input"
                    value={favoriteDraft}
                    onChange={(event) => onSetFavoriteDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onAddFavoriteTeam();
                      }
                    }}
                    placeholder="Verein/Team eingeben"
                    style={{ ...inp, flex: 1, minWidth: 220 }}
                  />
                  <button
                    type="button"
                    onClick={() => onAddFavoriteTeam()}
                    style={{ ...inp, width: "auto", minWidth: 120, cursor: "pointer" }}
                  >
                    Favorit +
                  </button>
                </div>

                {favorites.length ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {favorites.map((team, index) => (
                        <button
                          key={`${team}-${index}`}
                          type="button"
                          onClick={() => onRemoveFavoriteTeam(index)}
                          style={{
                            border: `1px solid ${C.greenBorder}`,
                            background: C.greenDim,
                            color: C.green,
                            borderRadius: 999,
                            padding: "5px 10px",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          ★ {team}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={onClearFavoriteTeams}
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
                      Alle Favoriten entfernen
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 12, color: C.gray }}>Keine Favoriten gesetzt.</div>
                )}
              </div>
            </div>
          </div>

          <div className="setup-span-two">
            <DataSourceConfig
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
