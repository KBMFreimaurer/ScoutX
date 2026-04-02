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
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: C.green }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <SectionHeader num="03">Mannschaften</SectionHeader>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={onSelectAll}
            style={{
              fontSize: 12,
              color: C.green,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "'Barlow', sans-serif",
              fontWeight: 600,
              padding: "2px 0",
              minHeight: 0,
            }}
          >
            Alle wählen
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
                fontFamily: "'Barlow', sans-serif",
                padding: "2px 0",
                minHeight: 0,
              }}
            >
              Abwählen
            </button>
          ) : null}

          <span
            style={{
              fontSize: 12,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              letterSpacing: "0.5px",
              color: selectedTeams.length > 0 ? C.green : C.grayDark,
              background: selectedTeams.length > 0 ? C.greenDim : "transparent",
              border: `1px solid ${selectedTeams.length > 0 ? C.greenDark : C.border}`,
              padding: "3px 10px",
              borderRadius: 20,
            }}
          >
            {selectedTeams.length > 0 ? `${selectedTeams.length} / ${allTeams.length} aktiv` : `Alle ${allTeams.length}`}
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
                borderRadius: 4,
                background: C.greenDark,
                border: `1px solid ${C.green}44`,
                fontSize: 12,
                color: C.white,
                fontFamily: "'Barlow', sans-serif",
              }}
            >
              <span>{team}</span>
              <span onClick={() => onRemoveTeam(team)} style={{ cursor: "pointer", fontSize: 15, lineHeight: 1, color: C.green }}>
                ×
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
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
              borderRadius: 5,
              minHeight: 44,
              border: `1px solid ${C.greenDark}`,
              background: C.greenDim,
              color: C.green,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              letterSpacing: "0.5px",
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
                borderRadius: 5,
                textAlign: "left",
                border: `1px solid ${isSelected ? C.green : C.border}`,
                background: isSelected ? C.greenDark : "#111",
                color: dimmed ? C.grayDark : isSelected ? C.white : C.offWhite,
                fontFamily: "'Barlow', sans-serif",
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.12s",
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
                  borderRadius: 3,
                  border: `1.5px solid ${isSelected ? C.green : C.border}`,
                  background: isSelected ? C.green : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: C.white,
                  flexShrink: 0,
                  transition: "all 0.12s",
                }}
              >
                {isSelected ? "✓" : ""}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team}</span>
            </button>
          );
        })}
      </div>

      {teamFilter && filteredTeams.length === 0 ? (
        <div style={{ color: C.gray, fontSize: 13, textAlign: "center", padding: 16 }}>Kein Verein gefunden</div>
      ) : null}

      <div
        style={{
          marginTop: 12,
          padding: "9px 12px",
          background: "#111",
          borderRadius: 5,
          border: `1px solid ${C.border}`,
          fontSize: 12,
          color: C.grayDark,
          fontFamily: "'Barlow', sans-serif",
        }}
      >
        💡 Wähle Vereine aus, die für das Scouting in Frage kommen. Keine Auswahl → alle {allTeams.length} Vereine werden berücksichtigt.
      </div>
    </div>
  );
}
