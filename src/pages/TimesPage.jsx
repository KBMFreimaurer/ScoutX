import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GhostButton, PrimaryButton } from "../components/Buttons";
import { useScoutX } from "../context/ScoutXContext";
import { C } from "../styles/theme";

const RANGE_OPTIONS = [
  { id: "7", label: "7 Tage", days: 7 },
  { id: "30", label: "30 Tage", days: 30 },
  { id: "all", label: "Alle", days: null },
];

function toEntryDate(entry) {
  const gameIsoDate = String(entry?.gameIsoDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(gameIsoDate)) {
    const parsed = new Date(`${gameIsoDate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const updated = new Date(entry?.updatedAt || "");
  return Number.isNaN(updated.getTime()) ? null : updated;
}

function formatMinutesLabel(minutes) {
  const safe = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (!hours) {
    return `${mins} Min`;
  }
  return `${hours} h ${String(mins).padStart(2, "0")} Min`;
}

function formatTimestamp(isoText) {
  const parsed = new Date(isoText);
  if (Number.isNaN(parsed.getTime())) {
    return "unbekannt";
  }
  return parsed.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (!/[;"\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function buildCsv(entries) {
  const header = ["Datum", "Spiel", "Dauer_Minuten", "Dauer_h_mm", "Ort", "Notiz"];
  const rows = entries.map((entry) => {
    const date = entry.gameDateLabel || formatTimestamp(entry.updatedAt);
    const minutes = Number(entry.minutes || 0);
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    return [
      date,
      entry.gameLabel || "",
      String(minutes),
      `${hh}:${mm}`,
      entry.gameVenue || "",
      entry.note || "",
    ].map(escapeCsvValue);
  });

  return [header.join(";"), ...rows.map((row) => row.join(";"))].join("\n");
}

function buildGameLabel(game) {
  const home = String(game?.home || "").trim();
  const away = String(game?.away || "").trim();
  if (home && away) {
    return `${home} vs ${away}`;
  }
  return home || away || "Unbekanntes Spiel";
}

function toSortKey(game) {
  const dateMs = game?.dateObj instanceof Date ? game.dateObj.getTime() : Number.MAX_SAFE_INTEGER;
  const kickoff = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(game?.time || "").trim()) ? String(game.time) : "99:99";
  return `${String(dateMs).padStart(16, "0")}|${kickoff}`;
}

export function TimesPage() {
  const navigate = useNavigate();
  const { games, timeEntries, timeTotalMinutes, onUpsertTimeEntry, onDeleteTimeEntry } = useScoutX();

  const [selectedGameId, setSelectedGameId] = useState("");
  const [minutesDraft, setMinutesDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [activeRange, setActiveRange] = useState("30");
  const [editingEntryId, setEditingEntryId] = useState("");
  const [formError, setFormError] = useState("");

  const gameOptions = useMemo(
    () =>
      [...(Array.isArray(games) ? games : [])]
        .sort((left, right) => toSortKey(left).localeCompare(toSortKey(right)))
        .map((game) => ({
          id: game.id,
          label: buildGameLabel(game),
          dateLabel: game.dateLabel || "",
          venue: game.venue || "",
          gameIsoDate:
            game?.dateObj instanceof Date && !Number.isNaN(game.dateObj.getTime())
              ? `${game.dateObj.getFullYear()}-${String(game.dateObj.getMonth() + 1).padStart(2, "0")}-${String(game.dateObj.getDate()).padStart(2, "0")}`
              : "",
          source: "live",
        })),
    [games],
  );

  const archivedGameOptions = useMemo(() => {
    const usedIds = new Set(gameOptions.map((item) => item.id));
    const seenIds = new Set();
    return timeEntries
      .filter((entry) => entry?.gameId && !usedIds.has(entry.gameId) && !seenIds.has(entry.gameId))
      .map((entry) => {
        seenIds.add(entry.gameId);
        return {
          id: entry.gameId,
          label: entry.gameLabel || "Archiviertes Spiel",
          dateLabel: entry.gameDateLabel || "",
          venue: entry.gameVenue || "",
          gameIsoDate: entry.gameIsoDate || "",
          source: "archive",
        };
      });
  }, [gameOptions, timeEntries]);

  const selectableGames = useMemo(() => [...gameOptions, ...archivedGameOptions], [gameOptions, archivedGameOptions]);
  const gameById = useMemo(
    () => new Map(selectableGames.map((game) => [game.id, game])),
    [selectableGames],
  );

  useEffect(() => {
    if (!selectableGames.length) {
      setSelectedGameId("");
      return;
    }

    if (!selectedGameId || !gameById.has(selectedGameId)) {
      setSelectedGameId(selectableGames[0].id);
    }
  }, [selectedGameId, selectableGames, gameById]);

  const filteredEntries = useMemo(() => {
    const rangeConfig = RANGE_OPTIONS.find((item) => item.id === activeRange) || RANGE_OPTIONS[1];
    if (!rangeConfig.days) {
      return timeEntries;
    }

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (rangeConfig.days - 1));

    return timeEntries.filter((entry) => {
      const date = toEntryDate(entry);
      return date && date >= cutoff;
    });
  }, [timeEntries, activeRange]);

  const filteredMinutes = useMemo(
    () => filteredEntries.reduce((sum, entry) => sum + Number(entry?.minutes || 0), 0),
    [filteredEntries],
  );

  const currentEditEntry = useMemo(
    () => timeEntries.find((entry) => entry.id === editingEntryId) || null,
    [timeEntries, editingEntryId],
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError("");

    const game = gameById.get(selectedGameId);
    if (!game) {
      setFormError("Bitte ein Spiel auswählen.");
      return;
    }

    const minutes = Number.parseInt(minutesDraft, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setFormError("Bitte eine gültige Dauer in Minuten eingeben.");
      return;
    }

    const saved = onUpsertTimeEntry({
      entryId: editingEntryId,
      game: {
        id: game.id,
        label: game.label,
        dateLabel: game.dateLabel,
        venue: game.venue,
        gameIsoDate: game.gameIsoDate,
      },
      minutes,
      note: noteDraft,
    });

    if (!saved) {
      setFormError("Eintrag konnte nicht gespeichert werden.");
      return;
    }

    setEditingEntryId("");
    setMinutesDraft("");
    setNoteDraft("");
  };

  const handleEditEntry = (entry) => {
    setEditingEntryId(entry.id);
    setSelectedGameId(entry.gameId);
    setMinutesDraft(String(entry.minutes || ""));
    setNoteDraft(entry.note || "");
    setFormError("");
  };

  const handleCancelEdit = () => {
    setEditingEntryId("");
    setMinutesDraft("");
    setNoteDraft("");
    setFormError("");
  };

  const handleExportCsv = () => {
    if (filteredEntries.length === 0 || typeof window === "undefined") {
      return;
    }

    const csv = buildCsv(filteredEntries);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    anchor.href = objectUrl;
    anchor.download = `ScoutX_Zeiten_${activeRange}_${today}.csv`;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(objectUrl);
  };

  return (
    <div className="fu">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <GhostButton onClick={() => navigate("/games")}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Spiele
        </GhostButton>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 800,
              fontSize: 22,
              color: C.white,
              letterSpacing: "-0.3px",
            }}
          >
            Arbeitszeiterfassung
          </div>
          <div
            style={{
              fontSize: 12,
              color: C.gray,
              marginTop: 2,
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >
            Manuelle Eingabe pro Spiel ohne Timer, mehrere Zeitblöcke möglich
          </div>
        </div>
      </div>

      <div
        className="fu2"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, color: C.gray }}>
            Zeitraum:{" "}
            <strong style={{ color: C.offWhite, fontWeight: 700 }}>
              {RANGE_OPTIONS.find((option) => option.id === activeRange)?.label || "30 Tage"}
            </strong>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveRange(option.id)}
                style={{
                  border: `1px solid ${activeRange === option.id ? C.greenBorder : C.border}`,
                  borderRadius: 8,
                  background: activeRange === option.id ? C.greenDim : "rgba(255,255,255,0.03)",
                  color: activeRange === option.id ? C.green : C.gray,
                  cursor: "pointer",
                  padding: "6px 10px",
                  minHeight: 34,
                  fontSize: 12,
                  fontWeight: activeRange === option.id ? 700 : 500,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 12, color: C.gray }}>
            Einträge: <strong style={{ color: C.offWhite, fontWeight: 700 }}>{filteredEntries.length}</strong>
          </div>
          <div style={{ fontSize: 12, color: C.gray }}>
            Summe ({activeRange === "all" ? "alle" : "gefiltert"}):{" "}
            <strong style={{ color: C.offWhite, fontWeight: 700 }}>{formatMinutesLabel(filteredMinutes)}</strong>
          </div>
          <div style={{ fontSize: 12, color: C.gray }}>
            Gesamt: <strong style={{ color: C.offWhite, fontWeight: 700 }}>{formatMinutesLabel(timeTotalMinutes)}</strong>
          </div>
        </div>
      </div>

      <form
        className="fu2"
        onSubmit={handleSubmit}
        style={{
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 12, color: C.offWhite, fontWeight: 700, marginBottom: 12 }}>
          {currentEditEntry ? "Eintrag bearbeiten" : "Neuen Eintrag erfassen"}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: C.gray }}>
            Spiel
            <select
              value={selectedGameId}
              onChange={(event) => setSelectedGameId(event.target.value)}
              disabled={selectableGames.length === 0}
              className="scout-select"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: C.offWhite,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "9px 10px",
                minHeight: 40,
              }}
            >
              {selectableGames.length === 0 ? <option value="">Keine Spiele verfügbar</option> : null}
              {selectableGames.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.label}
                  {game.dateLabel ? ` · ${game.dateLabel}` : ""}
                  {game.source === "archive" ? " · (Archiv)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: C.gray }}>
            Dauer (Minuten)
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              placeholder="z. B. 150"
              value={minutesDraft}
              onChange={(event) => setMinutesDraft(event.target.value)}
              style={{
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: "rgba(255,255,255,0.02)",
                color: C.offWhite,
                padding: "9px 10px",
                fontSize: 13,
                minHeight: 40,
              }}
            />
          </label>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: C.gray, marginTop: 10 }}>
          Notiz (optional)
          <textarea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="z. B. vollständige Beobachtung vor Ort"
            style={{
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.02)",
              color: C.offWhite,
              padding: "10px 12px",
              fontSize: 12,
              minHeight: 74,
              resize: "vertical",
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          />
        </label>

        {formError ? (
          <div style={{ marginTop: 10, fontSize: 12, color: "#fca5a5" }} aria-live="polite">
            {formError}
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <PrimaryButton type="submit" disabled={selectableGames.length === 0}>
            {currentEditEntry ? "Eintrag aktualisieren" : "Eintrag speichern"}
          </PrimaryButton>
          {currentEditEntry ? (
            <GhostButton onClick={handleCancelEdit}>
              Abbrechen
            </GhostButton>
          ) : null}
        </div>
      </form>

      <div
        className="fu3"
        style={{
          background: C.surfaceSolid,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            borderBottom: `1px solid ${C.border}`,
            background: "rgba(255,255,255,0.02)",
            padding: "10px 12px",
          }}
        >
          <div style={{ fontSize: 12, color: C.gray }}>
            Erfasste Zeiten ({filteredEntries.length})
          </div>
          <GhostButton onClick={handleExportCsv} disabled={filteredEntries.length === 0} style={{ minHeight: 34, padding: "6px 10px", fontSize: 12 }}>
            CSV exportieren
          </GhostButton>
        </div>

        {filteredEntries.length === 0 ? (
          <div style={{ padding: 14, fontSize: 13, color: C.gray }}>
            Keine Einträge im gewählten Zeitraum.
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="row-item"
              style={{
                padding: "12px 14px",
                borderBottom: entry.id === filteredEntries[filteredEntries.length - 1]?.id ? "none" : `1px solid ${C.border}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 220, flex: 1 }}>
                  <div style={{ color: C.offWhite, fontSize: 13, fontWeight: 700 }}>{entry.gameLabel || "Unbekanntes Spiel"}</div>
                  <div style={{ color: C.gray, fontSize: 12, marginTop: 2 }}>
                    {entry.gameDateLabel || "Datum unbekannt"}
                    {entry.gameVenue ? ` · ${entry.gameVenue}` : ""}
                  </div>
                  {entry.note ? <div style={{ color: C.grayLight, fontSize: 12, marginTop: 6 }}>{entry.note}</div> : null}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 12, color: C.gray }}>
                    Dauer: <strong style={{ color: C.offWhite, fontWeight: 700 }}>{formatMinutesLabel(entry.minutes)}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: C.grayDark }}>Aktualisiert: {formatTimestamp(entry.updatedAt)}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleEditEntry(entry)}
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
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTimeEntry(entry.id)}
                      style={{
                        border: `1px solid rgba(239,68,68,0.22)`,
                        borderRadius: 8,
                        background: "rgba(239,68,68,0.08)",
                        color: "#fca5a5",
                        cursor: "pointer",
                        padding: "6px 10px",
                        minHeight: 34,
                        fontSize: 12,
                      }}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
