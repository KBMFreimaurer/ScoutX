import { C, card, inp, lbl } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

function buildLookup(values) {
  const map = new Map();
  for (const value of values || []) {
    map.set(String(value || "").toLowerCase(), true);
  }
  return map;
}

export function TeamPicker({
  selectedTeams,
  teamDraft,
  teamValidation,
  onTeamDraft,
  onAddTeam,
  onUpdateTeam,
  onNormalizeTeams,
  onRemoveTeam,
  onClearAll,
}) {
  const matchedLookup = buildLookup(teamValidation?.matchedTeams || []);
  const missingLookup = buildLookup(teamValidation?.missingTeams || []);

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <SectionHeader num="03">Mannschaften auswählen (optional)</SectionHeader>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              fontSize: 11,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 600,
              color: selectedTeams.length > 0 ? C.green : C.grayDark,
              background: selectedTeams.length > 0 ? C.greenDim : "rgba(255,255,255,0.03)",
              border: `1px solid ${selectedTeams.length > 0 ? C.greenBorder : C.border}`,
              padding: "3px 10px",
              borderRadius: 6,
            }}
          >
            {selectedTeams.length}
          </span>

          {selectedTeams.length > 0 ? (
            <button
              type="button"
              onClick={onClearAll}
              aria-label="Alle Vereins-Parameter löschen"
              style={{
                fontSize: 12,
                color: C.gray,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                padding: "2px 0",
                minHeight: 0,
              }}
            >
              Alle löschen
            </button>
          ) : null}
        </div>
      </div>

      <p
        style={{
          marginTop: -2,
          marginBottom: 12,
          fontSize: 12,
          color: C.gray,
          lineHeight: 1.45,
        }}
      >
        Hier trägst du Vereine/Mannschaften ein, die in der Spielliste hervorgehoben werden sollen.
      </p>

      <label htmlFor="team-draft-input" style={lbl}>Mannschaft/Verein hinzufügen</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          id="team-draft-input"
          className="scout-input"
          placeholder="z. B. TSV Heimaterde"
          value={teamDraft}
          onChange={(event) => onTeamDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAddTeam(teamDraft);
            }
          }}
          style={{ ...inp, flex: 1, marginBottom: 0 }}
        />

        <button
          type="button"
          onClick={() => onAddTeam(teamDraft)}
          aria-label="Vereinsfeld hinzufügen"
          style={{
            padding: "0 14px",
            borderRadius: 10,
            minHeight: 44,
            border: `1px solid ${C.greenBorder}`,
            background: C.greenDim,
            color: C.green,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + Feld
        </button>
      </div>

      {selectedTeams.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {selectedTeams.map((team, index) => {
            const key = String(team || "").toLowerCase();
            const isFound = matchedLookup.has(key);
            const isMissing = missingLookup.has(key);

            return (
              <div
                key={`team-${index}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: 8,
                }}
              >
                <input
                  id={`team-param-${index}`}
                  className="scout-input"
                  value={team}
                  onChange={(event) => onUpdateTeam(index, event.target.value)}
                  onBlur={onNormalizeTeams}
                  placeholder={`Verein ${index + 1}`}
                  aria-label={`Verein ${index + 1}`}
                  style={{ ...inp, marginBottom: 0, minHeight: 38 }}
                />

                {teamValidation?.requested ? (
                  <span
                    style={{
                      minWidth: 92,
                      fontSize: 11,
                      textAlign: "center",
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: `1px solid ${
                        isFound ? C.greenBorder : isMissing ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)"
                      }`,
                      color: isFound ? C.green : isMissing ? "#fca5a5" : C.gray,
                      background: isFound ? C.greenDim : isMissing ? C.errorDim : "rgba(255,255,255,0.02)",
                      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    {isFound ? "Gefunden" : isMissing ? "Nicht gefunden" : "Ungeprüft"}
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={() => onRemoveTeam(index)}
                  aria-label={`Verein ${index + 1} entfernen`}
                  style={{
                    minHeight: 38,
                    minWidth: 38,
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: "rgba(255,255,255,0.02)",
                    color: C.gray,
                    cursor: "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  x
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            color: C.gray,
            fontSize: 13,
            textAlign: "center",
            padding: 14,
            border: `1px dashed ${C.border}`,
            borderRadius: 10,
            marginBottom: 4,
          }}
        >
          Keine Vereinsparameter gesetzt.
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          padding: "10px 14px",
          background: "rgba(255,255,255,0.02)",
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          fontSize: 12,
          color: C.grayDark,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
          lineHeight: 1.5,
        }}
      >
        Vereinsparameter sind nur ein Hinweis für die Recherche. Der Plan bleibt immer offen und kann auch ohne Vereine
        erstellt werden.
      </div>
    </div>
  );
}
