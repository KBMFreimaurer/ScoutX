# ScoutX – Codex-Prompt: Fahrtkosten-Vergütung

> Diesen Prompt direkt an Claude Code / Codex übergeben.

---

## Kontext

ScoutX ist ein React-SPA für KI-gestütztes Jugendfußball-Scouting bei Borussia Mönchengladbach.
Lies zuerst `CLAUDE.md` im Root-Verzeichnis.

Wir fügen jetzt eine **neue Fahrtkosten-Funktion** hinzu. ScoutX berechnet bereits für jedes Spiel
die Entfernung vom konfigurierten Startort (`game.distanceKm`). Diese Entfernungsdaten sollen
nun genutzt werden, um automatisch eine Fahrtkosten-Abrechnung zu erstellen – als Tabelle
auf der Plan-Seite, als CSV-Download und als neue Seite im PDF-Export.

Die neuen Features werden direkt in die bestehenden Strukturen integriert:

- Neuer State in `src/context/SetupContext.jsx` (gleicher Stil wie vorhandene Felder)
- Neue Komponente in `src/components/`
- Erweiterung von `src/pages/PlanPage.jsx` und `src/services/pdf/`

---

## Was gebaut wird

### 1. Zwei neue Felder im Setup

**Datei:** `src/config/storage.js` → neuen Key hinzufügen:

```js
abrechnungMeta: "scoutplan.abrechnung.v1",
```

**Datei:** `src/context/SetupContext.jsx`

Füge nach den bestehenden `useState`-Deklarationen zwei neue State-Felder hinzu,
die aus `localStorage` (`STORAGE_KEYS.abrechnungMeta`) geladen und dort gespeichert werden:

```js
// Initialisierung aus localStorage
const [abrechnungMeta, setAbrechnungMetaRaw] = useState(() => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.abrechnungMeta);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        scoutName: String(parsed?.scoutName || "").trim(),
        kmPauschale: Number(parsed?.kmPauschale) > 0 ? Number(parsed.kmPauschale) : 0.3,
      };
    }
  } catch {}
  return { scoutName: "", kmPauschale: 0.3 };
});

// Setter mit automatischer Persistenz
const setAbrechnungMeta = useCallback((partial) => {
  setAbrechnungMetaRaw((prev) => {
    const next = { ...prev, ...partial };
    try {
      window.localStorage.setItem(STORAGE_KEYS.abrechnungMeta, JSON.stringify(next));
    } catch {}
    return next;
  });
}, []);
```

Ergänze im `value`-Objekt des `useMemo` (am Ende von `SetupProvider`):

```js
scoutName: abrechnungMeta.scoutName,
kmPauschale: abrechnungMeta.kmPauschale,
onSetScoutName: (val) => setAbrechnungMeta({ scoutName: String(val || "").trim() }),
onSetKmPauschale: (val) => { const n = Number(val); if (n > 0) setAbrechnungMeta({ kmPauschale: n }); },
```

Ergänze im `resetSetupState`-Callback:

```js
setAbrechnungMetaRaw({ scoutName: "", kmPauschale: 0.3 });
try {
  window.localStorage.removeItem(STORAGE_KEYS.abrechnungMeta);
} catch {}
```

Füge `abrechnungMeta` und `setAbrechnungMeta` zu den `deps` des `useMemo` hinzu.

Da `useScoutX()` in `ScoutXContext.jsx` alle drei Kontexte per Spread zusammenführt,
sind `scoutName`, `kmPauschale`, `onSetScoutName` und `onSetKmPauschale` danach
**automatisch** über `useScoutX()` verfügbar – `ScoutXContext.jsx` braucht keine Änderung.

---

**Datei:** `src/pages/SetupPage.jsx`

Destructure aus dem bestehenden `useScoutX()`-Aufruf zusätzlich:

```js
scoutName, kmPauschale, onSetScoutName, onSetKmPauschale,
```

Füge unterhalb des Startort-Blocks (nach `onClearLocation` im JSX) einen neuen Abschnitt ein.
Nutze die bereits importierten Style-Objekte `inp`, `lbl`, `card` und `C` aus `../styles/theme`:

```jsx
<div style={{ ...card, marginTop: 16 }}>
  <SectionHeader>Fahrtkosten</SectionHeader>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12, alignItems: "end" }}>
    <div>
      <label style={lbl}>Scout-Name (für Abrechnung)</label>
      <input
        style={inp}
        type="text"
        value={scoutName}
        onChange={(e) => onSetScoutName(e.target.value)}
        placeholder="Dein Name"
        maxLength={80}
      />
    </div>
    <div>
      <label style={lbl}>€ / km</label>
      <input
        style={inp}
        type="number"
        value={kmPauschale}
        step="0.01"
        min="0.01"
        max="2.00"
        onChange={(e) => onSetKmPauschale(e.target.value)}
      />
    </div>
  </div>
  <p style={{ fontSize: 11, color: C.gray, marginTop: 8, marginBottom: 0 }}>
    Kilometerpauschale für die automatische Fahrtkosten-Abrechnung im Scout-Plan.
  </p>
</div>
```

---

### 2. Neue Komponente: Fahrtkosten-Tabelle

**Neue Datei:** `src/components/FahrtkostenTabelle.jsx`

Diese Komponente liest ausschließlich Daten, die bereits auf jedem `game`-Objekt vorhanden sind:
`game.id`, `game.home`, `game.away`, `game.venue`, `game.date`, `game.dateObj`,
`game.time`, `game.distanceKm`.

```jsx
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

function eur(n) {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function dateDe(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj)) return "–";
  return dateObj.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function FahrtkostenTabelle({ games, kmPauschale, isMobile, onKmChange }) {
  const [overrides, setOverrides] = useState({});

  const rows = (Array.isArray(games) ? games : []).filter((g) => Number.isFinite(g.distanceKm) && g.distanceKm > 0);

  const km = (g) => (Number.isFinite(overrides[g.id]) ? overrides[g.id] : g.distanceKm || 0);
  const rate = Number.isFinite(kmPauschale) && kmPauschale > 0 ? kmPauschale : 0.3;

  const totalKm = rows.reduce((s, g) => s + km(g) * 2, 0);
  const totalEur = totalKm * rate;

  const handleChange = (gameId, raw) => {
    const val = parseFloat(String(raw).replace(",", "."));
    setOverrides((prev) => {
      const next = { ...prev };
      Number.isFinite(val) && val >= 0 ? (next[gameId] = val) : delete next[gameId];
      return next;
    });
    onKmChange?.(gameId, Number.isFinite(val) ? val : null);
  };

  const exportCsv = () => {
    const date = new Date().toLocaleDateString("de-DE").replace(/\./g, "-");
    const head = "Nr;Datum;Zeit;Sichtung;Spielort;km einfach;km H+R;Betrag EUR\n";
    const body = rows
      .map((g, i) => {
        const e = km(g),
          hr = e * 2,
          b = hr * rate;
        return [
          i + 1,
          g.dateObj instanceof Date ? g.dateObj.toLocaleDateString("de-DE") : g.date || "",
          g.time || "",
          `"Sichtung: ${g.home || "–"} – ${g.away || "–"}"`,
          `"${g.venue || "–"}"`,
          e.toFixed(1).replace(".", ","),
          hr.toFixed(1).replace(".", ","),
          b.toFixed(2).replace(".", ","),
        ].join(";");
      })
      .join("\n");

    const blob = new Blob(["\uFEFF" + head + body], { type: "text/csv;charset=utf-8;" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `Fahrtkosten_ScoutX_${date}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
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
          {rows.map((g, i) => {
            const e = km(g),
              hr = e * 2,
              b = hr * rate;
            return (
              <tr key={g.id}>
                <td style={{ ...TD, color: C.gray }}>{i + 1}</td>
                {!isMobile && <td style={TD}>{dateDe(g.dateObj)}</td>}
                {!isMobile && <td style={{ ...TD, color: C.gray }}>{g.time || "–"}</td>}
                <td style={TD}>
                  <strong>{g.home}</strong>
                  <span style={{ color: C.gray }}> – </span>
                  {g.away}
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
                    {g.venue || "–"}
                  </td>
                )}
                <td style={{ ...TD, textAlign: "right" }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={Number.isFinite(overrides[g.id]) ? overrides[g.id] : e.toFixed(1)}
                    onChange={(ev) => handleChange(g.id, ev.target.value)}
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
                <td style={{ ...TD, textAlign: "right", color: C.gray }}>{hr.toFixed(1)} km</td>
                <td style={{ ...TD, textAlign: "right", color: C.green, fontWeight: 600 }}>{eur(b)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <td colSpan={isMobile ? 3 : 5} style={{ ...TD, fontWeight: 700 }}>
              Gesamt
            </td>
            <td style={{ ...TD, textAlign: "right", fontWeight: 600 }}></td>
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
```

---

### 3. Fahrtkosten-Abschnitt auf der Plan-Seite einbauen

**Datei:** `src/pages/PlanPage.jsx`

Füge die folgenden Imports hinzu:

```js
import { FahrtkostenTabelle } from "../components/FahrtkostenTabelle";
import { SectionHeader } from "../components/SectionHeader";
```

Ergänze im `useScoutX()`-Destructuring:

```js
scoutName, kmPauschale,
```

Füge nach den bestehenden `useState`-Aufrufen hinzu:

```js
const [kmOverrides, setKmOverrides] = useState({});
const handleKmChange = (gameId, newKm) =>
  setKmOverrides((prev) => {
    const next = { ...prev };
    newKm === null ? delete next[gameId] : (next[gameId] = newKm);
    return next;
  });
```

Füge im JSX **unterhalb von `<PlanView />`** und **oberhalb der Spieletabelle** ein:

```jsx
{
  games.length > 0 && (
    <div style={{ marginTop: 28, marginBottom: 28 }} className="fu2">
      <SectionHeader>Fahrtkosten-Abrechnung</SectionHeader>
      <FahrtkostenTabelle games={games} kmPauschale={kmPauschale} isMobile={isMobile} onKmChange={handleKmChange} />
    </div>
  );
}
```

Erweitere den bestehenden `<PDFExport />` Aufruf – füge `scoutName`, `kmPauschale`
und `kmOverrides` in das `cfg`-Objekt ein (alle anderen Props bleiben unverändert):

```jsx
cfg={{
  ...cfg,
  routeOverview,
  startLocation,
  startLocationLabel: startLocation?.label || cfg?.startLocationLabel || "",
  scoutName,       // NEU
  kmPauschale,     // NEU
  kmOverrides,     // NEU
}}
```

---

### 4. Fahrtkosten-Seite im PDF

**Datei:** `src/services/pdf/sections.js`

Füge am Ende der Datei eine neue Funktion `drawFahrtkostenPage` hinzu.
Orientiere dich am Stil der bestehenden `drawScheduleTable`-Funktion:

```js
export function drawFahrtkostenPage(doc, state, games, cfg) {
  const scoutName = String(cfg?.scoutName || "").trim();
  const rate = Number(cfg?.kmPauschale) > 0 ? Number(cfg.kmPauschale) : 0.3;
  const overrides = cfg?.kmOverrides ?? {};

  const rows = (Array.isArray(games) ? games : []).filter((g) => Number.isFinite(g.distanceKm) && g.distanceKm > 0);
  if (rows.length === 0) return;

  doc.addPage();
  state.y = 20;
  const L = 14,
    W = 182;

  // Titel
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(230, 230, 230);
  doc.text("FAHRTKOSTEN-ABRECHNUNG", L, state.y);
  state.y += 7;

  // Meta
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110, 110, 110);
  const meta = [
    scoutName ? `Scout: ${scoutName}` : null,
    `Datum: ${new Date().toLocaleDateString("de-DE")}`,
    `Pauschale: ${rate.toFixed(2).replace(".", ",")} €/km`,
  ]
    .filter(Boolean)
    .join("   ·   ");
  doc.text(meta, L, state.y);
  state.y += 7;

  // Linie
  doc.setDrawColor(50, 50, 50).line(L, state.y, L + W, state.y);
  state.y += 5;

  // Tabellen-Header
  const cols = [8, 22, 18, 62, 28, 22, 22];
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(90, 90, 90);
  ["Nr.", "Datum", "Zeit", "Sichtung", "Spielort", "km (H+R)", "Betrag"].forEach((h, i) => {
    doc.text(h, L + cols.slice(0, i).reduce((a, b) => a + b, 0), state.y);
  });
  state.y += 4;
  doc.line(L, state.y, L + W, state.y);
  state.y += 4;

  // Zeilen
  doc.setFont("helvetica", "normal").setFontSize(8);
  let totalHR = 0,
    totalEur = 0;

  rows.forEach((g, idx) => {
    const einfach = Number.isFinite(overrides[g.id]) ? overrides[g.id] : g.distanceKm;
    const hr = einfach * 2;
    const betrag = hr * rate;
    totalHR += hr;
    totalEur += betrag;

    const dateStr =
      g.dateObj instanceof Date && !isNaN(g.dateObj)
        ? g.dateObj.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })
        : g.date || "";

    const values = [
      String(idx + 1),
      dateStr,
      g.time || "–",
      `${String(g.home || "–").slice(0, 16)} – ${String(g.away || "–").slice(0, 14)}`,
      String(g.venue || "–").slice(0, 14),
      `${hr.toFixed(1).replace(".", ",")} km`,
      `${betrag.toFixed(2).replace(".", ",")} €`,
    ];

    let x = L;
    values.forEach((v, i) => {
      doc.setTextColor(i === 6 ? 0 : 190, i === 6 ? 135 : 190, i === 6 ? 62 : 190);
      doc.text(v, x, state.y);
      x += cols[i];
    });
    state.y += 5;

    if (state.y > 268) {
      doc.addPage();
      state.y = 20;
    }
  });

  // Summe
  state.y += 2;
  doc.setDrawColor(60, 60, 60).line(L, state.y, L + W, state.y);
  state.y += 5;
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(200, 200, 200);
  doc.text("GESAMT", L, state.y);

  const sumX = L + cols.slice(0, 5).reduce((a, b) => a + b, 0);
  doc.text(`${totalHR.toFixed(1).replace(".", ",")} km`, sumX, state.y);
  doc.setTextColor(0, 135, 62);
  doc.text(`${totalEur.toFixed(2).replace(".", ",")} €`, sumX + cols[5], state.y);

  // Unterschrift
  state.y += 14;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(70, 70, 70);
  doc.text("Datum / Unterschrift: _________________________________", L, state.y);

  state.sections.push("Fahrtkosten");
}
```

**Datei:** `src/services/pdf/index.js`

Ergänze den bestehenden Import aus `./sections`:

```js
import {
  drawGamesOverviewPage,
  drawHeaderFooter,
  drawRouteCalculationPage,
  drawFahrtkostenPage, // NEU
} from "./sections";
```

In der bestehenden `buildPdf`-Funktion, direkt nach `drawRouteCalculationPage(...)`:

```js
drawFahrtkostenPage(doc, state, normalizedGames, cfgWithBuild);
```

---

## Qualitätssicherung

```bash
npm run lint
npm run format
npm run test
npm run build
```

Wenn Tests brechen: Nur die Mock-Contexts in den Test-Dateien anpassen –
`scoutName: ""` und `kmPauschale: 0.30` als neue Standardwerte ergänzen.
Bestehende Test-Logik nicht verändern.

---

## Betroffene Dateien – Übersicht

| Datei                                   | Was ändert sich                             |
| --------------------------------------- | ------------------------------------------- |
| `src/config/storage.js`                 | +1 Key                                      |
| `src/context/SetupContext.jsx`          | +2 State-Felder + Setter + Reset            |
| `src/pages/SetupPage.jsx`               | +1 neuer Card-Block mit 2 Eingabefeldern    |
| `src/components/FahrtkostenTabelle.jsx` | Neue Datei                                  |
| `src/pages/PlanPage.jsx`                | +Import, +State, +JSX-Abschnitt, +cfg-Props |
| `src/services/pdf/sections.js`          | +Funktion `drawFahrtkostenPage`             |
| `src/services/pdf/index.js`             | +Import, +1 Funktionsaufruf in `buildPdf`   |
