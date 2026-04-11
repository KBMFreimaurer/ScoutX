import { useState } from "react";
import { C, card } from "../styles/theme";

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

function dateDe(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) {
    return "–";
  }
  return dateObj.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function FahrtkostenTabelle({ games, kmPauschale, isMobile, onKmChange }) {
  const [overrides, setOverrides] = useState({});

  const rows = (Array.isArray(games) ? games : []).filter(
    (game) => Number.isFinite(game.distanceKm) && game.distanceKm > 0,
  );
  const km = (game) => (Number.isFinite(overrides[game.id]) ? overrides[game.id] : game.distanceKm || 0);
  const rate = Number.isFinite(kmPauschale) && kmPauschale > 0 ? kmPauschale : 0.3;

  const totalKm = rows.reduce((sum, game) => sum + km(game) * 2, 0);
  const totalEur = totalKm * rate;

  const handleChange = (gameId, rawValue) => {
    const value = Number.parseFloat(String(rawValue).replace(",", "."));
    setOverrides((prev) => {
      const next = { ...prev };
      if (Number.isFinite(value) && value >= 0) {
        next[gameId] = value;
      } else {
        delete next[gameId];
      }
      return next;
    });
    onKmChange?.(gameId, Number.isFinite(value) ? value : null);
  };

  const exportCsv = () => {
    const date = new Date().toLocaleDateString("de-DE").replace(/\./g, "-");
    const head = "Nr;Datum;Zeit;Sichtung;Spielort;km einfach;km H+R;Betrag EUR\n";
    const body = rows
      .map((game, index) => {
        const einfach = km(game);
        const hinRueck = einfach * 2;
        const betrag = hinRueck * rate;

        return [
          index + 1,
          game.dateObj instanceof Date ? game.dateObj.toLocaleDateString("de-DE") : game.date || "",
          game.time || "",
          `"Sichtung: ${game.home || "–"} – ${game.away || "–"}"`,
          `"${game.venue || "–"}"`,
          einfach.toFixed(1).replace(".", ","),
          hinRueck.toFixed(1).replace(".", ","),
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

  if (rows.length === 0) {
    return (
      <div style={{ ...card, color: C.gray, fontSize: 13 }}>
        Kein Startort konfiguriert oder keine Entfernungsdaten verfügbar. Bitte im Setup einen Startort setzen.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={TH}>Nr.</th>
            {!isMobile && <th style={TH}>Datum</th>}
            {!isMobile && <th style={TH}>Zeit</th>}
            <th style={TH}>Sichtung</th>
            {!isMobile && <th style={TH}>Spielort</th>}
            <th style={{ ...TH, textAlign: "right" }}>km (einfach)</th>
            <th style={{ ...TH, textAlign: "right" }}>km (H+R)</th>
            <th style={{ ...TH, textAlign: "right" }}>Betrag</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((game, index) => {
            const einfach = km(game);
            const hinRueck = einfach * 2;
            const betrag = hinRueck * rate;

            return (
              <tr key={game.id}>
                <td style={{ ...TD, color: C.gray }}>{index + 1}</td>
                {!isMobile && <td style={TD}>{dateDe(game.dateObj)}</td>}
                {!isMobile && <td style={{ ...TD, color: C.gray }}>{game.time || "–"}</td>}
                <td style={TD}>
                  <strong>{game.home}</strong>
                  <span style={{ color: C.gray }}> – </span>
                  {game.away}
                </td>
                {!isMobile && (
                  <td
                    style={{
                      ...TD,
                      color: C.gray,
                      maxWidth: 130,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {game.venue || "–"}
                  </td>
                )}
                <td style={{ ...TD, textAlign: "right" }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={Number.isFinite(overrides[game.id]) ? overrides[game.id] : einfach.toFixed(1)}
                    onChange={(event) => handleChange(game.id, event.target.value)}
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
                <td style={{ ...TD, textAlign: "right", color: C.gray }}>{hinRueck.toFixed(1)} km</td>
                <td style={{ ...TD, textAlign: "right", color: C.green, fontWeight: 600 }}>{eur(betrag)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <td colSpan={isMobile ? 3 : 5} style={{ ...TD, fontWeight: 700 }}>
              Gesamt
            </td>
            <td style={{ ...TD, textAlign: "right", fontWeight: 600 }} />
            <td style={{ ...TD, textAlign: "right", color: C.gray }}>{totalKm.toFixed(1)} km</td>
            <td style={{ ...TD, textAlign: "right", color: C.green, fontWeight: 700 }}>{eur(totalEur)}</td>
          </tr>
        </tfoot>
      </table>

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
    </div>
  );
}
