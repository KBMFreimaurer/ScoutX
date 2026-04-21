import { Fragment } from "react";
import { C } from "../styles/theme";
import { formatDistanceKm } from "../utils/geo";
import { resolveGameMatchUrl } from "../utils/gameLinks";

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

function sortByDistance(left, right) {
  const leftDistance = Number.isFinite(left?.distanceKm) ? Number(left.distanceKm) : Number.POSITIVE_INFINITY;
  const rightDistance = Number.isFinite(right?.distanceKm) ? Number(right.distanceKm) : Number.POSITIVE_INFINITY;
  if (leftDistance !== rightDistance) {
    return leftDistance - rightDistance;
  }
  return sortByPriority(left, right);
}

function sortByDateTime(left, right) {
  const leftDate = left?.dateObj instanceof Date ? left.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
  const rightDate = right?.dateObj instanceof Date ? right.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
  if (leftDate !== rightDate) {
    return leftDate - rightDate;
  }

  const leftTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(left?.time || "")) ? String(left.time) : "99:99";
  const rightTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(right?.time || "")) ? String(right.time) : "99:99";
  return leftTime.localeCompare(rightTime);
}

function sortGames(games, sortMode) {
  if (sortMode === "distance") {
    return [...games].sort(sortByDistance);
  }
  if (sortMode === "date") {
    return [...games].sort(sortByDateTime);
  }
  return [...games].sort(sortByPriority);
}

export function GameTable({
  games,
  mode = "games",
  sortMode = "priority",
  notes = {},
  onSetNote,
  expandedNoteId = null,
  onToggleNote,
  selectionEnabled = false,
  selectedGameIds = {},
  onToggleSelectedGame,
}) {
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
        {games.map((game, index) => {
          const gameUrl = resolveGameMatchUrl(game);
          return (
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
              <span style={{ fontSize: 12, color: C.gray, whiteSpace: "nowrap", marginLeft: 8 }}>{formatDistanceKm(game.distanceKm)}</span>
              {gameUrl ? (
                <a
                  href={gameUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Zum Spiel für ${game.home} vs ${game.away}`}
                  style={{ fontSize: 11, color: C.green, textDecoration: "underline", whiteSpace: "nowrap", marginLeft: 8 }}
                >
                  Link
                </a>
              ) : (
                <span style={{ fontSize: 11, color: C.grayDark, whiteSpace: "nowrap", marginLeft: 8 }}>—</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const sortedGames = sortGames(games, sortMode);
  const noteColSpan = selectionEnabled ? 8 : 7;

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
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: selectionEnabled ? 980 : 900,
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
            {selectionEnabled ? (
              <th
                scope="col"
                style={{
                  width: "8%",
                  textAlign: "center",
                  padding: "10px 12px",
                  fontSize: 10,
                  color: C.grayDark,
                  letterSpacing: "0.8px",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Auswahl
              </th>
            ) : null}
            <th scope="col" style={{ width: "26%", textAlign: "left", padding: "10px 16px", fontSize: 10, color: C.grayDark, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>Begegnung</th>
            <th scope="col" style={{ width: "12%", textAlign: "left", padding: "10px 8px", fontSize: 10, color: C.grayDark, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>Datum</th>
            <th scope="col" style={{ width: "8%", textAlign: "left", padding: "10px 8px", fontSize: 10, color: C.grayDark, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>Anstoß</th>
            <th scope="col" style={{ width: "24%", textAlign: "left", padding: "10px 8px", fontSize: 10, color: C.grayDark, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>Spielort</th>
            <th scope="col" style={{ width: "8%", textAlign: "left", padding: "10px 8px", fontSize: 10, color: C.grayDark, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>Entfernung</th>
            <th scope="col" style={{ width: "7%", textAlign: "left", padding: "10px 8px", fontSize: 10, color: C.grayDark, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>Link</th>
            <th scope="col" style={{ width: "7%", textAlign: "left", padding: "10px 8px", fontSize: 10, color: C.grayDark, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>Notiz</th>
          </tr>
        </thead>

        <tbody>
          {sortedGames.map((game, index) => {
            const noteOpen = expandedNoteId === game.id;
            const gameUrl = resolveGameMatchUrl(game);
            return (
              <Fragment key={game.id}>
                <tr
                  className="row-item"
                  style={{
                    borderBottom: noteOpen ? "none" : index < sortedGames.length - 1 ? `1px solid ${C.border}` : "none",
                    background:
                      selectionEnabled && Boolean(selectedGameIds?.[game.id]) ? "rgba(0,200,83,0.08)" : "transparent",
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                  }}
                >
                  {selectionEnabled ? (
                    <td style={{ padding: "11px 12px", fontSize: 12, color: C.gray, textAlign: "center" }}>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Spiel auswählen: ${game.home} gegen ${game.away}`}
                          checked={Boolean(selectedGameIds?.[game.id])}
                          onChange={() => onToggleSelectedGame?.(game.id)}
                          style={{
                            width: 16,
                            height: 16,
                            accentColor: C.green,
                            cursor: "pointer",
                          }}
                        />
                      </label>
                    </td>
                  ) : null}
                  <td style={{ padding: "11px 16px", fontSize: 13 }}>
                    {game.isFavoriteGame ? <span style={{ color: C.green, marginRight: 5 }}>★</span> : null}
                    <strong style={{ color: C.white }}>{game.home}</strong>
                    <span style={{ color: C.grayDark, margin: "0 4px" }}>vs</span>
                    <span style={{ color: C.offWhite }}>{game.away}</span>
                  </td>
                  <td style={{ padding: "11px 8px", fontSize: 13, color: C.gray }}>{game.dateLabel}</td>
                  <td style={{ padding: "11px 8px", fontSize: 13, color: C.gray }}>{formatKickoff(game.time)}</td>
                  <td style={{ padding: "11px 8px", fontSize: 13, color: C.gray, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.venue}</td>
                  <td style={{ padding: "11px 8px", fontSize: 13, color: C.gray }}>{formatDistanceKm(game.distanceKm)}</td>
                  <td style={{ padding: "11px 8px", fontSize: 12, color: C.gray }}>
                    {gameUrl ? (
                      <a
                        href={gameUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Zum Spiel für ${game.home} vs ${game.away}`}
                        style={{ color: C.green, textDecoration: "underline" }}
                      >
                        Zum Spiel
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ padding: "11px 8px", fontSize: 12, color: C.gray }}>
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
                        padding: "4px 8px",
                        minHeight: 30,
                      }}
                    >
                      Notiz
                    </button>
                  </td>
                </tr>
                {noteOpen ? (
                  <tr key={`${game.id}-note`} style={{ borderBottom: index < sortedGames.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <td colSpan={noteColSpan} style={{ padding: "8px 12px" }}>
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
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
        </table>
      </div>
    </div>
  );
}
