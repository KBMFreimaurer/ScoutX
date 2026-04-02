import { C } from "../styles/theme";

export function GameCards({ games }) {
  return (
    <div className="game-cards" style={{ marginBottom: 14 }}>
      {games.map((game) => (
        <div
          key={game.id}
          className="row-item"
          style={{
            padding: "14px",
            borderRadius: 6,
            background: C.surface,
            border: `1px solid ${C.border}`,
            marginBottom: 8,
            transition: "background 0.12s",
            borderLeft: `3px solid ${C.green}`,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: C.white,
              fontSize: 14,
              marginBottom: 6,
              fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: "0.3px",
            }}
          >
            {game.home} <span style={{ color: C.gray, fontWeight: 400 }}>vs</span> {game.away}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "5px 14px",
              fontSize: 12,
              color: C.gray,
              fontFamily: "'Barlow', sans-serif",
            }}
          >
            <span>📅 {game.dateLabel}</span>
            <span>⏰ {game.time} Uhr</span>
            <span>📍 {game.venue}</span>
            <span style={{ color: game.km < 15 ? C.green : C.gray }}>🚗 {game.km} km</span>
          </div>
        </div>
      ))}
    </div>
  );
}
