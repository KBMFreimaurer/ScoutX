import { C, card, inp } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function TeamPicker({
  allTeams,
  filteredTeams,
  selectedTeams,
  teamFilter,
  onTeamFilter,
  onToggleTeam,
  onRemoveTeam,
  onSelectAll,
  onClearAll,
  onSelectFiltered,
}) {
  if (!allTeams.length) {
    return null;
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <SectionHeader num="03">Mannschaften</SectionHeader>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={onSelectAll}
            style={{
              fontSize: 12,
              color: C.green,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              padding: "2px 0",
              minHeight: 0,
            }}
          >
            Alle
          </button>

          {selectedTeams.length > 0 ? (
            <button
              onClick={onClearAll}
              style={{
                fontSize: 12,
                color: C.gray,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                padding: "2px 0",
                minHeight: 0,
              }}
            >
              Reset
            </button>
          ) : null}

          <span
            style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              color: selectedTeams.length > 0 ? C.green : C.grayDark,
              background: selectedTeams.length > 0 ? C.greenDim : "rgba(255,255,255,0.03)",
              border: `1px solid ${selectedTeams.length > 0 ? C.greenBorder : C.border}`,
              padding: "3px 10px",
              borderRadius: 6,
            }}
          >
            {selectedTeams.length > 0 ? `${selectedTeams.length}/${allTeams.length}` : `${allTeams.length}`}
          </span>
        </div>
      </div>

      {selectedTeams.length > 0 ? (
        <div className="pills-bar">
          {selectedTeams.map((team) => (
            <div
              key={team}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 8,
                background: C.greenDim,
                border: `1px solid ${C.greenBorder}`,
                fontSize: 12,
                color: C.white,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <span>{team}</span>
              <span onClick={() => onRemoveTeam(team)} style={{ cursor: "pointer", fontSize: 14, lineHeight: 1, color: C.green, opacity: 0.7 }}>
                x
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          className="scout-input"
          placeholder="Verein suchen..."
          value={teamFilter}
          onChange={(event) => onTeamFilter(event.target.value)}
          style={{ ...inp, flex: 1, marginBottom: 0 }}
        />

        {teamFilter && filteredTeams.some((team) => !selectedTeams.includes(team)) ? (
          <button
            onClick={onSelectFiltered}
            style={{
              padding: "0 14px",
              borderRadius: 10,
              minHeight: 44,
              border: `1px solid ${C.greenBorder}`,
              background: C.greenDim,
              color: C.green,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + Alle
          </button>
        ) : null}
      </div>

      <div className="team-grid">
        {filteredTeams.map((team) => {
          const isSelected = selectedTeams.includes(team);
          const dimmed = selectedTeams.length > 0 && !isSelected;

          return (
            <button
              key={team}
              className={`team-chip${isSelected ? " sel" : ""}`}
              onClick={() => onToggleTeam(team)}
              style={{
                padding: "9px 12px",
                borderRadius: 10,
                textAlign: "left",
                border: `1px solid ${isSelected ? C.greenBorder : C.border}`,
                background: isSelected ? C.greenDim : "rgba(255,255,255,0.03)",
                color: dimmed ? C.grayDark : isSelected ? C.white : C.offWhite,
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                gap: 8,
                minHeight: 44,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  border: `1.5px solid ${isSelected ? C.green : "rgba(255,255,255,0.15)"}`,
                  background: isSelected ? C.green : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: C.bg,
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}
              >
                {isSelected ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : ""}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team}</span>
            </button>
          );
        })}
      </div>

      {teamFilter && filteredTeams.length === 0 ? (
        <div style={{ color: C.gray, fontSize: 13, textAlign: "center", padding: 20 }}>Kein Verein gefunden</div>
      ) : null}

      <div
        style={{
          marginTop: 12,
          padding: "10px 14px",
          background: "rgba(255,255,255,0.02)",
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          fontSize: 12,
          color: C.grayDark,
          fontFamily: "'Inter', sans-serif",
          lineHeight: 1.5,
        }}
      >
        Keine Auswahl = alle {allTeams.length} Vereine werden berücksichtigt.
      </div>
    </div>
  );
}
