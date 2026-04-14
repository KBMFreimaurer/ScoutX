import { useEffect, useMemo, useState } from "react";
import { fetchClubSuggestions } from "../services/clubSearch";
import { C, card, inp, lbl } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

function buildLookup(values) {
  const map = new Map();
  for (const value of values || []) {
    map.set(String(value || "").toLowerCase(), true);
  }
  return map;
}

function toLookupKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function normalizeLogoUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (text.startsWith("//")) {
    return `https:${text}`;
  }
  return isAbsoluteUrl(text) ? text : "";
}

function initials(value) {
  const tokens = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return "??";
  }
  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }
  return `${tokens[0][0] || ""}${tokens[1][0] || ""}`.toUpperCase();
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
  adapterEndpoint = "",
  adapterToken = "",
}) {
  const matchedLookup = buildLookup(teamValidation?.matchedTeams || []);
  const missingLookup = buildLookup(teamValidation?.missingTeams || []);
  const [teamInputFocused, setTeamInputFocused] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [remoteSuggestions, setRemoteSuggestions] = useState([]);

  useEffect(() => {
    const query = String(teamDraft || "").trim().replace(/\s+/g, " ");
    if (query.length < 2) {
      setRemoteSuggestions([]);
      setLookupLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLookupLoading(true);

      try {
        const suggestions = await fetchClubSuggestions(adapterEndpoint, adapterToken, query, 8);
        if (!cancelled) {
          setRemoteSuggestions(suggestions);
        }
      } catch {
        if (!cancelled) {
          setRemoteSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setLookupLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [teamDraft, adapterEndpoint, adapterToken]);

  const teamSuggestions = useMemo(() => {
    const queryKey = toLookupKey(teamDraft);
    if (!queryKey) {
      return [];
    }

    const merged = new Map();
    for (const item of remoteSuggestions) {
      const name = String(item?.name || "").trim();
      if (!name) {
        continue;
      }

      const key = toLookupKey(name);
      if (!key || !key.includes(queryKey)) {
        continue;
      }

      merged.set(key, {
        key,
        name,
        logoUrl: normalizeLogoUrl(item?.logoUrl),
        location: String(item?.location || "").trim(),
      });
    }

    return [...merged.values()].slice(0, 8);
  }, [remoteSuggestions, teamDraft]);

  const showSuggestions = teamInputFocused && String(teamDraft || "").trim().length >= 2 && (teamSuggestions.length > 0 || lookupLoading);

  const onSelectSuggestion = (suggestion) => {
    const name = String(suggestion?.name || "").trim();
    if (!name) {
      return;
    }
    onTeamDraft(name);
    setTeamInputFocused(false);
  };

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
      <div style={{ display: "flex", gap: 8, marginBottom: 12, position: "relative" }}>
        <input
          id="team-draft-input"
          className="scout-input"
          placeholder="z. B. TSV Heimaterde"
          value={teamDraft}
          onChange={(event) => onTeamDraft(event.target.value)}
          onFocus={() => setTeamInputFocused(true)}
          onBlur={() => {
            setTimeout(() => setTeamInputFocused(false), 120);
          }}
          autoComplete="off"
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

        {showSuggestions ? (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              borderRadius: 10,
              border: `1px solid ${C.borderHi}`,
              background: C.surface,
              boxShadow: "0 14px 28px rgba(0,0,0,0.35)",
              zIndex: 40,
              overflow: "hidden",
            }}
          >
            {teamSuggestions.length === 0 ? (
              <div style={{ padding: "10px 12px", color: C.gray, fontSize: 12 }}>Vereine werden geladen...</div>
            ) : (
              <div style={{ maxHeight: 240, overflowY: "auto" }}>
                {teamSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.key}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelectSuggestion(suggestion);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 10px",
                      border: "none",
                      borderBottom: `1px solid ${C.border}`,
                      background: "transparent",
                      color: C.offWhite,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: `1px solid ${C.border}`,
                        background: "rgba(255,255,255,0.04)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: C.grayLight,
                        fontSize: 10,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {suggestion.logoUrl ? (
                        <img
                          src={suggestion.logoUrl}
                          alt={`Logo ${suggestion.name}`}
                          loading="lazy"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        initials(suggestion.name)
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: C.offWhite, lineHeight: 1.2 }}>{suggestion.name}</div>
                      {suggestion.location ? (
                        <div style={{ marginTop: 2, fontSize: 11, color: C.gray }}>{suggestion.location}</div>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
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
