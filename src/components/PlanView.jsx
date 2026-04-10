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
            gap: 8,
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
            Direktlinks zu den Spielen
          </div>
          {linkedReviewGames.map(({ game, matchUrl }, index) => (
            <a
              key={`${game.id || game.home}-${game.away}-${index}`}
              href={matchUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Zum Spiel auf fussball.de für ${game.home} gegen ${game.away}`}
              style={{
                color: C.green,
                textDecoration: "underline",
                fontSize: isMobile ? 12 : 13,
                lineHeight: 1.5,
                cursor: "pointer",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              }}
            >
              {index + 1}. {game.home} vs. {game.away} auf fussball.de
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
