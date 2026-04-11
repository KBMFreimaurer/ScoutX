import { C } from "../styles/theme";
import { formatDistanceKm } from "../utils/geo";
import { resolveGameMatchUrl } from "../utils/gameLinks";

function weatherLabel(weather) {
  if (!weather) {
    return "—";
  }

  const temperature = Number.isFinite(weather.temperatureC) ? `${Math.round(weather.temperatureC)}°C` : "n/a";
  const precipitation = Number.isFinite(weather.precipitationProbability) ? `${Math.round(weather.precipitationProbability)}%` : "n/a";
  return `${temperature} · ${precipitation}`;
}

function weatherIcon(type) {
  if (type === "rain") {
    return "🌧";
  }
  if (type === "snow") {
    return "❄";
  }
  if (type === "storm") {
    return "⛈";
  }
  if (type === "clear") {
    return "☀";
  }
  return "☁";
}

export function GameCards({
  games,
  notes = {},
  onSetNote,
  expandedNoteId = null,
  onToggleNote,
  selectionEnabled = false,
  selectedGameIds = {},
  onToggleSelectedGame,
}) {
  const formatKickoff = (time) =>
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(time || "").trim()) ? `${time} Uhr` : "Anstoß offen";

  return (
    <div className="game-cards" style={{ marginBottom: 16 }}>
      {games.map((game) => {
        const noteOpen = expandedNoteId === game.id;
        const gameUrl = resolveGameMatchUrl(game);

        return (
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
              {game.isFavoriteGame ? <span style={{ color: C.green, marginRight: 5 }}>★</span> : null}
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
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18"/><path d="M12 3v18"/></svg>
                {formatDistanceKm(game.distanceKm)}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span>{weatherIcon(game.weather?.type)}</span>
                {weatherLabel(game.weather)}
              </span>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {selectionEnabled ? (
                  <button
                    type="button"
                    onClick={() => onToggleSelectedGame?.(game.id)}
                    aria-pressed={selectedGameIds?.[game.id]}
                    aria-label={`Spiel auswählen: ${game.home} gegen ${game.away}`}
                    style={{
                      border: `1px solid ${selectedGameIds?.[game.id] ? C.greenBorder : C.border}`,
                      borderRadius: 8,
                      background: selectedGameIds?.[game.id] ? C.greenDim : "rgba(255,255,255,0.03)",
                      color: selectedGameIds?.[game.id] ? C.green : C.gray,
                      cursor: "pointer",
                      padding: "6px 10px",
                      minHeight: 34,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {selectedGameIds?.[game.id] ? "Für Besuch ausgewählt" : "Für Besuch auswählen"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onToggleNote?.(game.id)}
                  aria-expanded={noteOpen}
                  style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    color: C.gray,
                    cursor: "pointer",
                    padding: "6px 10px",
                    minHeight: 34,
                    fontSize: 12,
                  }}
                >
                  Notiz {noteOpen ? "schließen" : "öffnen"}
                </button>
                {gameUrl ? (
                  <a
                    href={gameUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Zum Spiel für ${game.home} vs ${game.away}`}
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.03)",
                      color: C.green,
                      textDecoration: "underline",
                      padding: "6px 10px",
                      minHeight: 34,
                      fontSize: 12,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    Zum Spiel
                  </a>
                ) : null}
              </div>
            </div>

            {noteOpen ? (
              <div style={{ marginTop: 8 }}>
                <textarea
                  aria-label={`Notiz für ${game.home} gegen ${game.away}`}
                  value={notes[game.id] || ""}
                  onChange={(event) => onSetNote?.(game.id, event.target.value)}
                  placeholder="Notiz zum Spiel..."
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: "rgba(255,255,255,0.02)",
                    color: C.offWhite,
                    padding: "10px 12px",
                    fontSize: 12,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                    minHeight: 74,
                    resize: "vertical",
                  }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
