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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <SectionHeader num="03">Mannschaften-Auswahl</SectionHeader>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={onSelectAll}
            style={{
              fontSize: 12,
              color: "#70dd88",
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
              color: selectedTeams.length > 0 ? "#70dd88" : C.grayDark,
              background: selectedTeams.length > 0 ? "rgba(0,31,16,0.85)" : "transparent",
              border: `1px solid ${selectedTeams.length > 0 ? C.greenBorder : "rgba(255,255,255,0.08)"}`,
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
                borderRadius: 999,
                background: "rgba(0,31,16,0.8)",
                border: `1px solid ${C.greenBorder}`,
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
              borderRadius: 6,
              minHeight: 44,
              border: `1px solid ${C.greenBorder}`,
              background: "rgba(0,31,16,0.8)",
              color: "#70dd88",
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
                borderRadius: 6,
                textAlign: "left",
                border: `1px solid ${isSelected ? C.green : "rgba(255,255,255,0.08)"}`,
                background: isSelected ? "linear-gradient(135deg, rgba(112,221,136,0.2), rgba(0,135,62,0.12))" : "#242424",
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
                  borderRadius: 4,
                  border: `1.5px solid ${isSelected ? C.green : "rgba(255,255,255,0.2)"}`,
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
          background: "#202020",
          borderRadius: 7,
          border: "1px solid rgba(255,255,255,0.07)",
          fontSize: 12,
          color: C.grayDark,
          fontFamily: "'Barlow', sans-serif",
        }}
      >
        Wähle Vereine aus, die für das Scouting in Frage kommen. Keine Auswahl bedeutet: alle {allTeams.length} Vereine werden berücksichtigt.
      </div>
    </div>
  );
}
