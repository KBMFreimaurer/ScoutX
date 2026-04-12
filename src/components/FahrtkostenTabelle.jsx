import { useMemo, useState } from "react";
import { C, card } from "../styles/theme";
import { buildAttendanceRows, formatPresenceMinutes, normalizePresenceMinutes } from "../utils/arbeitszeit";
import { buildFahrtkostenRows } from "../utils/fahrtkosten";

const TH = {
  fontSize: 10,
  color: C.gray,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.3px",
  padding: "6px 8px",
  textAlign: "left",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const TD = {
  fontSize: 12,
  color: C.offWhite,
  padding: "8px 8px",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};

function eur(value) {
  return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function FahrtkostenTabelle({
  games,
  routeOverview,
  kmPauschale,
  isMobile,
  onKmChange,
  presenceMinutesByGame,
  onPresenceChange,
}) {
  const [overrides, setOverrides] = useState({});
  const model = useMemo(() => buildFahrtkostenRows(games, routeOverview), [games, routeOverview]);
  const attendanceRows = useMemo(() => buildAttendanceRows(games), [games]);
  const rows = model.rows;
  const isRouteMode = model.mode === "route";

  const kmBase = (row) => (Number.isFinite(overrides[row.id]) ? overrides[row.id] : row.baseKm || 0);
  const kmAbrechnung = (row) => (isRouteMode ? kmBase(row) : kmBase(row) * 2);
  const rate = Number.isFinite(kmPauschale) && kmPauschale > 0 ? kmPauschale : 0.3;

  const totalKm = rows.reduce((sum, row) => sum + kmAbrechnung(row), 0);
  const totalEur = totalKm * rate;

  const handleChange = (rowId, rawValue) => {
    const value = Number.parseFloat(String(rawValue).replace(",", "."));
    setOverrides((prev) => {
      const next = { ...prev };
      if (Number.isFinite(value) && value >= 0) {
        next[rowId] = value;
      } else {
        delete next[rowId];
      }
      return next;
    });
    onKmChange?.(rowId, Number.isFinite(value) ? value : null);
  };

  const exportCsv = () => {
    const date = new Date().toLocaleDateString("de-DE").replace(/\./g, "-");
    const head = "Nr;Datum;Strecke;km Abrechnung;Betrag EUR\n";
    const body = rows
      .map((row, index) => {
        const kmGesamt = kmAbrechnung(row);
        const betrag = kmGesamt * rate;

        return [
          index + 1,
          row.dateLabel || "",
          `"${row.label || "–"}"`,
          kmGesamt.toFixed(1).replace(".", ","),
          betrag.toFixed(2).replace(".", ","),
        ].join(";");
      })
      .join("\n");

    const blob = new Blob([`\uFEFF${head}${body}`], { type: "text/csv;charset=utf-8;" });
    const link = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `Fahrtkosten_ScoutX_${date}.csv`,
    });
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const presenceMap = presenceMinutesByGame && typeof presenceMinutesByGame === "object" ? presenceMinutesByGame : {};
  const attendanceTrackedCount = attendanceRows.filter((row) =>
    Number.isFinite(normalizePresenceMinutes(presenceMap[row.id])),
  ).length;
  const attendanceTotalMinutes = attendanceRows.reduce((sum, row) => {
    const minutes = normalizePresenceMinutes(presenceMap[row.id]);
    return sum + (Number.isFinite(minutes) ? minutes : 0);
  }, 0);

  return (
    <div style={{ overflowX: "auto" }}>
      {rows.length === 0 ? (
        <div style={{ ...card, color: C.gray, fontSize: 13 }}>
          Keine abrechenbaren Strecken verfügbar. Bitte Startort setzen und Route berechnen lassen.
        </div>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH}>Nr.</th>
                {!isMobile && <th style={TH}>Datum</th>}
                <th style={TH}>Strecke</th>
                <th style={{ ...TH, textAlign: "right" }}>km (Abrechnung)</th>
                <th style={{ ...TH, textAlign: "right" }}>Betrag</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const kmGesamt = kmAbrechnung(row);
                const betrag = kmGesamt * rate;

                return (
                  <tr key={row.id}>
                    <td style={{ ...TD, color: C.gray }}>{index + 1}</td>
                    {!isMobile && <td style={TD}>{row.dateLabel || "–"}</td>}
                    <td style={TD}>
                      <span style={{ color: C.offWhite }}>{row.label || "–"}</span>
                    </td>
                    <td style={{ ...TD, textAlign: "right", whiteSpace: "nowrap" }}>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={Number.isFinite(overrides[row.id]) ? overrides[row.id] : kmBase(row).toFixed(1)}
                        onChange={(event) => handleChange(row.id, event.target.value)}
                        style={{
                          width: 64,
                          textAlign: "right",
                          padding: "3px 6px",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 6,
                          color: C.offWhite,
                          fontSize: 12,
                        }}
                      />
                      <span style={{ color: C.gray, marginLeft: 4 }}>km</span>
                    </td>
                    <td style={{ ...TD, textAlign: "right", color: C.green, fontWeight: 600 }}>{eur(betrag)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <td colSpan={isMobile ? 2 : 3} style={{ ...TD, fontWeight: 700 }}>
                  Gesamt
                </td>
                <td style={{ ...TD, textAlign: "right", color: C.gray }}>{totalKm.toFixed(1)} km</td>
                <td style={{ ...TD, textAlign: "right", color: C.green, fontWeight: 700 }}>{eur(totalEur)}</td>
              </tr>
            </tfoot>
          </table>

          {!isRouteMode ? (
            <div style={{ marginTop: 8, fontSize: 11, color: C.gray }}>
              Fallback aktiv: Eingabe ist einfache Strecke; für Abrechnung wird automatisch Hin- und Rückweg berechnet.
            </div>
          ) : null}

          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={exportCsv}
              style={{
                fontSize: 12,
                padding: "8px 14px",
                borderRadius: 10,
                cursor: "pointer",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: C.offWhite,
              }}
            >
              Als CSV exportieren
            </button>
          </div>
        </>
      )}

      <div
        style={{
          marginTop: 16,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: 14,
        }}
      >
        <div style={{ fontSize: 12, color: C.offWhite, fontWeight: 700, marginBottom: 10 }}>
          Arbeitszeiterfassung (manuell)
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>Nr.</th>
              {!isMobile && <th style={TH}>Datum</th>}
              <th style={TH}>Spiel</th>
              <th style={{ ...TH, textAlign: "right" }}>Vor Ort</th>
            </tr>
          </thead>
          <tbody>
            {attendanceRows.map((row, index) => {
              const normalized = normalizePresenceMinutes(presenceMap[row.id]);
              return (
                <tr key={row.id}>
                  <td style={{ ...TD, color: C.gray }}>{index + 1}</td>
                  {!isMobile && <td style={TD}>{row.dateLabel}</td>}
                  <td style={TD}>
                    <div style={{ color: C.offWhite, lineHeight: 1.25 }}>{row.matchLabel}</div>
                    <div style={{ color: C.gray, fontSize: 11, marginTop: 2 }}>
                      {row.timeLabel} · {row.venueLabel}
                    </div>
                  </td>
                  <td style={{ ...TD, textAlign: "right", whiteSpace: "nowrap" }}>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={Number.isFinite(normalized) ? normalized : ""}
                      onChange={(event) => {
                        const next = normalizePresenceMinutes(event.target.value);
                        onPresenceChange?.(row.id, next);
                      }}
                      placeholder="Min"
                      style={{
                        width: 72,
                        textAlign: "right",
                        padding: "3px 6px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 6,
                        color: C.offWhite,
                        fontSize: 12,
                      }}
                    />
                    <span style={{ color: C.gray, marginLeft: 4 }}>Min</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 8, fontSize: 11, color: C.gray }}>
          Erfasst: {attendanceTrackedCount}/{attendanceRows.length} Spiele · Gesamt vor Ort:{" "}
          {attendanceTrackedCount > 0 ? formatPresenceMinutes(attendanceTotalMinutes) : "nicht erfasst"}
        </div>
      </div>
    </div>
  );
}
