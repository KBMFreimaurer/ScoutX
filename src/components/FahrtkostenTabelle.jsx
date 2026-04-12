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
  padding: "8px 10px",
  textAlign: "left",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const TD = {
  fontSize: 12,
  color: C.offWhite,
  padding: "10px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};

const sectionCardStyle = {
  ...card,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
};

const inputStyle = {
  width: 78,
  textAlign: "right",
  padding: "5px 8px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: C.offWhite,
  fontSize: 12,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
};

function eur(value) {
  return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function StatPill({ label, value, tone = "default" }) {
  const color = tone === "ok" ? C.green : tone === "warn" ? C.warn : C.offWhite;
  const border = tone === "ok" ? "rgba(0,200,83,0.25)" : tone === "warn" ? "rgba(251,191,36,0.3)" : C.borderHi;
  const bg = tone === "ok" ? "rgba(0,200,83,0.12)" : tone === "warn" ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)";

  return (
    <div
      style={{
        border: `1px solid ${border}`,
        background: bg,
        borderRadius: 999,
        padding: "5px 10px",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
      }}
    >
      <span style={{ color: C.gray, letterSpacing: "0.2px" }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function SectionHeader({ title, subtitle, stats }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
        marginBottom: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontSize: 13, color: C.offWhite, fontWeight: 700 }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: 11, color: C.gray, marginTop: 4, lineHeight: 1.35, maxWidth: 640 }}>{subtitle}</div>
        ) : null}
      </div>

      {Array.isArray(stats) && stats.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {stats.map((item) => (
            <StatPill key={item.label} label={item.label} value={item.value} tone={item.tone} />
          ))}
        </div>
      ) : null}
    </div>
  );
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
  const attendanceOpenCount = Math.max(0, attendanceRows.length - attendanceTrackedCount);
  const attendanceTotalMinutes = attendanceRows.reduce((sum, row) => {
    const minutes = normalizePresenceMinutes(presenceMap[row.id]);
    return sum + (Number.isFinite(minutes) ? minutes : 0);
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={sectionCardStyle}>
        <SectionHeader
          title="Fahrtkosten"
          subtitle="Kilometerwerte können je Strecke manuell angepasst werden. Alle Beträge werden automatisch neu berechnet."
          stats={[
            { label: "Gesamt-km", value: `${totalKm.toFixed(1)} km`, tone: "default" },
            { label: "Gesamt", value: eur(totalEur), tone: "ok" },
          ]}
        />

        {rows.length === 0 ? (
          <div style={{ color: C.gray, fontSize: 13 }}>
            Keine abrechenbaren Strecken verfügbar. Bitte Startort setzen und Route berechnen lassen.
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "rgba(255,255,255,0.03)" }}>
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
                      <tr key={row.id} style={index % 2 === 1 ? { background: "rgba(255,255,255,0.015)" } : undefined}>
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
                            style={inputStyle}
                            aria-label={`Kilometer für Strecke ${index + 1}`}
                          />
                          <span style={{ color: C.gray, marginLeft: 5 }}>km</span>
                        </td>
                        <td style={{ ...TD, textAlign: "right", color: C.green, fontWeight: 700 }}>{eur(betrag)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
                    <td colSpan={isMobile ? 2 : 3} style={{ ...TD, fontWeight: 700 }}>
                      Gesamt
                    </td>
                    <td style={{ ...TD, textAlign: "right", color: C.gray }}>{totalKm.toFixed(1)} km</td>
                    <td style={{ ...TD, textAlign: "right", color: C.green, fontWeight: 700 }}>{eur(totalEur)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {!isRouteMode ? (
              <div style={{ marginTop: 8, fontSize: 11, color: C.gray }}>
                Hinweis: Aktuell wird eine einfache Strecke eingegeben; für die Abrechnung wird automatisch Hin- und
                Rückweg berücksichtigt.
              </div>
            ) : null}

            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={exportCsv}
                style={{
                  fontSize: 12,
                  padding: "8px 14px",
                  borderRadius: 10,
                  cursor: "pointer",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: C.offWhite,
                }}
              >
                Als CSV exportieren
              </button>
            </div>
          </>
        )}
      </div>

      <div style={sectionCardStyle}>
        <SectionHeader
          title="Arbeitszeiterfassung (manuell)"
          subtitle="Trage pro Spiel die tatsächliche Vor-Ort-Dauer ein. So bleibt die spätere Abrechnung nachvollziehbar."
          stats={[
            { label: "Erfasst", value: `${attendanceTrackedCount}/${attendanceRows.length}`, tone: "ok" },
            { label: "Offen", value: String(attendanceOpenCount), tone: attendanceOpenCount > 0 ? "warn" : "default" },
            {
              label: "Gesamt vor Ort",
              value: attendanceTrackedCount > 0 ? formatPresenceMinutes(attendanceTotalMinutes) : "nicht erfasst",
              tone: "default",
            },
          ]}
        />

        {attendanceRows.length === 0 ? (
          <div style={{ color: C.gray, fontSize: 13 }}>Keine Spiele für die Arbeitszeiterfassung vorhanden.</div>
        ) : isMobile ? (
          <div style={{ display: "grid", gap: 10 }}>
            {attendanceRows.map((row, index) => {
              const normalized = normalizePresenceMinutes(presenceMap[row.id]);
              return (
                <div
                  key={row.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    padding: 10,
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>
                    Spiel {index + 1} · {row.dateLabel} · {row.timeLabel}
                  </div>
                  <div style={{ fontSize: 12, color: C.offWhite, fontWeight: 600, lineHeight: 1.25 }}>{row.matchLabel}</div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 3 }}>{row.venueLabel}</div>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: 11, color: Number.isFinite(normalized) ? C.green : C.gray }}>
                      {Number.isFinite(normalized) ? formatPresenceMinutes(normalized) : "nicht erfasst"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
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
                        style={inputStyle}
                        inputMode="numeric"
                        aria-label={`Vor-Ort-Minuten für Spiel ${index + 1}`}
                      />
                      <span style={{ color: C.gray, fontSize: 12 }}>Min</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "rgba(255,255,255,0.03)" }}>
                <tr>
                  <th style={TH}>Nr.</th>
                  <th style={TH}>Datum</th>
                  <th style={TH}>Spiel</th>
                  <th style={TH}>Status</th>
                  <th style={{ ...TH, textAlign: "right" }}>Vor Ort</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map((row, index) => {
                  const normalized = normalizePresenceMinutes(presenceMap[row.id]);
                  const isRecorded = Number.isFinite(normalized);
                  return (
                    <tr key={row.id} style={index % 2 === 1 ? { background: "rgba(255,255,255,0.015)" } : undefined}>
                      <td style={{ ...TD, color: C.gray }}>{index + 1}</td>
                      <td style={TD}>
                        <div>{row.dateLabel}</div>
                        <div style={{ color: C.gray, fontSize: 11, marginTop: 2 }}>{row.timeLabel}</div>
                      </td>
                      <td style={TD}>
                        <div style={{ color: C.offWhite, lineHeight: 1.25 }}>{row.matchLabel}</div>
                        <div style={{ color: C.gray, fontSize: 11, marginTop: 2 }}>{row.venueLabel}</div>
                      </td>
                      <td style={TD}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            borderRadius: 999,
                            padding: "4px 9px",
                            fontSize: 11,
                            fontWeight: 700,
                            color: isRecorded ? C.green : C.grayLight,
                            border: `1px solid ${isRecorded ? "rgba(0,200,83,0.22)" : "rgba(255,255,255,0.14)"}`,
                            background: isRecorded ? "rgba(0,200,83,0.10)" : "rgba(255,255,255,0.03)",
                          }}
                        >
                          {isRecorded ? "Erfasst" : "Offen"}
                        </span>
                      </td>
                      <td style={{ ...TD, textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={isRecorded ? normalized : ""}
                              onChange={(event) => {
                                const next = normalizePresenceMinutes(event.target.value);
                                onPresenceChange?.(row.id, next);
                              }}
                              placeholder="Min"
                              style={inputStyle}
                              inputMode="numeric"
                              aria-label={`Vor-Ort-Minuten für Spiel ${index + 1}`}
                            />
                            <span style={{ color: C.gray, fontSize: 12 }}>Min</span>
                          </div>
                          <div style={{ fontSize: 11, color: isRecorded ? C.green : C.gray }}>
                            {isRecorded ? formatPresenceMinutes(normalized) : "nicht erfasst"}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
