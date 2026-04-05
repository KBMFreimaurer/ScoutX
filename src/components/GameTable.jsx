import { C } from "../styles/theme";

function formatKickoff(time) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(time || "").trim()) ? time : "offen";
}

function sortByPriority(left, right) {
  const priorityDelta = Number(right?.priority || 0) - Number(left?.priority || 0);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const leftDate = left?.dateObj instanceof Date ? left.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
  const rightDate = right?.dateObj instanceof Date ? right.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
  if (leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  const leftTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(left?.time || "")) ? String(left.time) : "99:99";
  const rightTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(right?.time || "")) ? String(right.time) : "99:99";
  return leftTime.localeCompare(rightTime);
}

export function GameTable({ games, mode = "games" }) {
  if (mode === "plan") {
    return (
      <div
        className="game-table"
        style={{
          background: C.surfaceSolid,
          border: `1px solid ${C.border}`,
          borderTop: "none",
          borderRadius: "0 0 14px 14px",
          overflow: "hidden",
        }}
      >
        {games.map((game, index) => (
          <div
            key={game.id}
            className="row-item"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              borderBottom: index < games.length - 1 ? `1px solid ${C.border}` : "none",
              fontSize: 13,
              transition: "background 0.15s ease",
              background: "transparent",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >
            <span style={{ width: 20, textAlign: "center", color: C.grayDark, fontSize: 11, flexShrink: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>{index + 1}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ color: C.white }}>{game.home}</strong>
              <span style={{ color: C.grayDark, margin: "0 4px" }}>vs</span>
              <span style={{ color: C.offWhite }}>{game.away}</span>
            </span>
            <span style={{ fontSize: 12, color: C.gray, whiteSpace: "nowrap" }}>{game.dateLabel}</span>
            <span style={{ fontSize: 12, color: C.gray, whiteSpace: "nowrap", marginLeft: 8 }}>{formatKickoff(game.time)}</span>
          </div>
        ))}
      </div>
    );
  }

  const sortedGames = [...games].sort(sortByPriority);

  return (
    <div
      className="game-table"
      style={{
        background: C.surfaceSolid,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
            <th scope="col" style={{ width: "38%", textAlign: "left", padding: "10px 16px", fontSize: 10, color: C.grayDark, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>Begegnung</th>
            <th scope="col" style={{ width: "20%", textAlign: "left", padding: "10px 8px", fontSize: 10, color: C.grayDark, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>Datum</th>
            <th scope="col" style={{ width: "14%", textAlign: "left", padding: "10px 8px", fontSize: 10, color: C.grayDark, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>Anstoß</th>
            <th scope="col" style={{ width: "28%", textAlign: "left", padding: "10px 8px", fontSize: 10, color: C.grayDark, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>Spielort</th>
          </tr>
        </thead>

        <tbody>
          {sortedGames.map((game, index) => (
            <tr
              key={game.id}
              className="row-item"
              style={{
                borderBottom: index < sortedGames.length - 1 ? `1px solid ${C.border}` : "none",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              }}
            >
              <td style={{ padding: "11px 16px", fontSize: 13 }}>
                <strong style={{ color: C.white }}>{game.home}</strong>
                <span style={{ color: C.grayDark, margin: "0 4px" }}>vs</span>
                <span style={{ color: C.offWhite }}>{game.away}</span>
              </td>
              <td style={{ padding: "11px 8px", fontSize: 13, color: C.gray }}>{game.dateLabel}</td>
              <td style={{ padding: "11px 8px", fontSize: 13, color: C.gray }}>{formatKickoff(game.time)}</td>
              <td style={{ padding: "11px 8px", fontSize: 13, color: C.gray, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.venue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
