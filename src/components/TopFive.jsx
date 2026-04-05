import { C, secH } from "../styles/theme";

export function TopFive({ games }) {
  const formatKickoff = (time) => (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(time || "").trim()) ? time : "offen");

  return (
    <div
      className="fu2"
      style={{
        background: C.greenDim,
        border: `1px solid ${C.greenBorder}`,
        borderRadius: 14,
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div style={{ ...secH, marginBottom: 14 }}>
        <span className="section-number">
          <svg width="10" height="10" viewBox="0 0 24 24" fill={C.green} stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </span>
        Top-Empfehlungen
      </div>

      {games.map((game, index) => (
        <div
          key={game.id}
          className="top-pick-row"
          style={{
            marginBottom: index < games.length - 1 ? 6 : 0,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(0,200,83,0.04)",
            border: `1px solid rgba(0,200,83,0.06)`,
            transition: "all 0.15s ease",
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: index === 0 ? C.green : "rgba(0,200,83,0.15)",
              color: index === 0 ? C.bg : C.green,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >
            {index + 1}
          </span>

          <span style={{ flex: 1, fontSize: 13, color: C.white, minWidth: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
            <strong>{game.home}</strong>
            <span style={{ color: C.gray, fontWeight: 400 }}> vs </span>
            {game.away}
          </span>

          <span style={{ fontSize: 12, color: C.gray, whiteSpace: "nowrap" }}>{game.dateLabel}</span>
          <span style={{ fontSize: 12, color: C.gray, whiteSpace: "nowrap" }}>{formatKickoff(game.time)}</span>
        </div>
      ))}
    </div>
  );
}
