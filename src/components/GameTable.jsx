import { C } from "../styles/theme";

export function GameTable({ games, mode = "games" }) {
  if (mode === "plan") {
    return (
      <div
        className="game-table"
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderTop: "none",
          borderRadius: "0 0 8px 8px",
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
              transition: "background 0.12s",
              background: "transparent",
              fontFamily: "'Barlow',sans-serif",
            }}
          >
            <span style={{ width: 18, textAlign: "center", color: C.grayDark, fontSize: 11, flexShrink: 0 }}>{index + 1}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ color: C.white }}>{game.home}</strong>
              <span style={{ color: C.grayDark }}> vs </span>
              {game.away}
            </span>
            <span style={{ fontSize: 12, color: C.gray, whiteSpace: "nowrap" }}>{game.dateLabel}</span>
            <span style={{ fontSize: 12, color: C.gray, whiteSpace: "nowrap", marginLeft: 8 }}>{game.time} Uhr</span>
            <span
              style={{
                fontSize: 12,
                color: game.km < 15 ? C.green : C.gray,
                whiteSpace: "nowrap",
                marginLeft: 8,
                fontWeight: game.km < 15 ? 700 : 400,
              }}
            >
              {game.km} km
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="game-table"
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2.2fr 1.2fr 0.7fr 1.4fr 0.5fr",
          padding: "10px 16px",
          borderBottom: `1px solid ${C.border}`,
          background: "#161616",
        }}
      >
        {["Begegnung", "Datum", "Anstoß", "Spielort", "km"].map((header) => (
          <span
            key={header}
            style={{
              fontSize: 10,
              color: C.gray,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontFamily: "'Barlow Condensed',sans-serif",
              fontWeight: 700,
            }}
          >
            {header}
          </span>
        ))}
      </div>

      {games.map((game, index) => (
        <div
          key={game.id}
          className="row-item"
          style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 1.2fr 0.7fr 1.4fr 0.5fr",
            padding: "11px 16px",
            fontSize: 13,
            borderBottom: index < games.length - 1 ? `1px solid ${C.border}` : "none",
            transition: "background 0.12s",
            background: "transparent",
            fontFamily: "'Barlow',sans-serif",
          }}
        >
          <span>
            <strong style={{ color: C.white }}>{game.home}</strong>
            <span style={{ color: C.grayDark }}> vs </span>
            {game.away}
          </span>
          <span style={{ color: C.gray }}>{game.dateLabel}</span>
          <span style={{ color: C.gray }}>{game.time}</span>
          <span style={{ color: C.gray, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.venue}</span>
          <span style={{ color: game.km < 15 ? C.green : C.gray, fontWeight: game.km < 15 ? 600 : 400 }}>{game.km}</span>
        </div>
      ))}
    </div>
  );
}
