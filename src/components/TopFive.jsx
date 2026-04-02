import { C, secH } from "../styles/theme";

export function TopFive({ games }) {
  return (
    <div
      style={{
        background: C.greenDim,
        border: `1px solid ${C.greenDark}`,
        borderRadius: 8,
        padding: 16,
        marginBottom: 14,
        borderLeft: `4px solid ${C.green}`,
      }}
    >
      <div style={{ ...secH, marginBottom: 12 }}>
        <span className="section-number">★</span>
        Top-Empfehlungen
      </div>

      {games.map((game, index) => (
        <div
          key={game.id}
          className="top-pick-row"
          style={{
            marginBottom: index < games.length - 1 ? 8 : 0,
            padding: "10px 12px",
            borderRadius: 5,
            background: "#0a1a0d",
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              background: C.green,
              color: C.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 900,
              flexShrink: 0,
              fontFamily: "'Barlow Condensed',sans-serif",
            }}
          >
            {index + 1}
          </span>

          <span style={{ flex: 1, fontSize: 13, color: C.white, minWidth: 0, fontFamily: "'Barlow',sans-serif" }}>
            <strong>{game.home}</strong>
            <span style={{ color: C.gray, fontWeight: 400 }}> vs </span>
            {game.away}
          </span>

          <span style={{ fontSize: 12, color: C.gray, whiteSpace: "nowrap" }}>{game.dateLabel}</span>
          <span style={{ fontSize: 12, color: C.gray, whiteSpace: "nowrap" }}>{game.time}</span>
          <span style={{ fontSize: 12, color: C.green, fontWeight: 700, whiteSpace: "nowrap" }}>{game.km} km</span>
        </div>
      ))}
    </div>
  );
}
