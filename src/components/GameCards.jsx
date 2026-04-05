import { C } from "../styles/theme";

export function GameCards({ games }) {
  const formatKickoff = (time) =>
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(time || "").trim()) ? `${time} Uhr` : "Anstoß offen";

  return (
    <div className="game-cards" style={{ marginBottom: 16 }}>
      {games.map((game) => (
        <div
          key={game.id}
          className="row-item"
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${C.border}`,
            marginBottom: 8,
            transition: "all 0.15s ease",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              color: C.white,
              fontSize: 14,
              marginBottom: 8,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >
            {game.home} <span style={{ color: C.grayDark, fontWeight: 400 }}>vs</span> {game.away}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px 14px",
              fontSize: 12,
              color: C.gray,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {game.dateLabel}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {formatKickoff(game.time)}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {game.venue}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
