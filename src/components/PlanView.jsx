import { C, secH } from "../styles/theme";
import { resolveGameMatchUrl } from "../utils/gameLinks";

function sortByDateAndKickoff(left, right) {
  const leftDate = left?.dateObj instanceof Date ? left.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
  const rightDate = right?.dateObj instanceof Date ? right.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
  if (leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  const leftTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(left?.time || "")) ? String(left.time) : "99:99";
  const rightTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(right?.time || "")) ? String(right.time) : "99:99";
  return leftTime.localeCompare(rightTime);
}

function kickoffLabel(time) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(time || "").trim()) ? `${time} Uhr` : "Anstoß offen";
}

export function PlanView({ plan, jugendLabel, kreisLabel, isMobile, games = [] }) {
  const linkedReviewGames = [...games]
    .sort(sortByDateAndKickoff)
    .map((game) => ({ game, matchUrl: resolveGameMatchUrl(game) }))
    .filter((entry) => Boolean(entry.matchUrl));

  return (
    <div
      className="fu2"
      style={{
        background: C.greenDim,
        border: `1px solid ${C.greenBorder}`,
        borderRadius: 14,
        padding: isMobile ? 18 : 24,
        marginBottom: 16,
      }}
    >
      <div style={{ ...secH, marginBottom: 16 }}>
        <span className="section-number">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/></svg>
        </span>
        Scout-Analyse · {jugendLabel} · {kreisLabel}
      </div>

      <div
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.75,
          fontSize: isMobile ? 13 : 14,
          color: C.offWhite,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        }}
      >
        {plan}
      </div>

      {linkedReviewGames.length > 0 ? (
        <div
          style={{
            marginTop: 18,
            borderTop: `1px solid ${C.greenBorder}`,
            paddingTop: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: C.gray,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              fontWeight: 600,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >
            Direktlinks zu den Spielen ({linkedReviewGames.length})
          </div>
          {linkedReviewGames.map(({ game, matchUrl }, index) => (
            <div
              key={`${game.id || game.home}-${game.away}-${index}`}
              style={{
                display: "flex",
                alignItems: isMobile ? "flex-start" : "center",
                justifyContent: "space-between",
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? 6 : 10,
                border: `1px solid ${C.greenBorder}`,
                background: "rgba(0,200,83,0.04)",
                borderRadius: 10,
                padding: isMobile ? "9px 10px" : "10px 12px",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? 12 : 13, color: C.offWhite, lineHeight: 1.4 }}>
                  <span
                    style={{
                      color: C.green,
                      fontWeight: 700,
                      marginRight: 6,
                    }}
                  >
                    {index + 1}.
                  </span>
                  <strong>{game.home}</strong>
                  <span style={{ color: C.gray, margin: "0 4px" }}>vs</span>
                  <span>{game.away}</span>
                </div>
                <div style={{ fontSize: 11, color: C.grayDark, marginTop: 2 }}>
                  {game.dateLabel || "Datum offen"} · {kickoffLabel(game.time)}
                </div>
              </div>

              <a
                href={matchUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Zum Spiel auf fussball.de für ${game.home} gegen ${game.away}`}
                style={{
                  color: C.green,
                  textDecoration: "none",
                  border: `1px solid ${C.greenBorder}`,
                  background: C.greenDim,
                  borderRadius: 999,
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                }}
              >
                fussball.de öffnen
              </a>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
