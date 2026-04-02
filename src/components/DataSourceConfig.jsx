import { C, card, inp, lbl } from "../styles/theme";
import { DATA_SOURCE_OPTIONS } from "../data/constants";
import { SectionHeader } from "./SectionHeader";

export function DataSourceConfig({
  dataMode,
  onDataModeChange,
  onFileImport,
  uploadName,
  importedCount,
  uploadError,
  uploadSummary,
  adapterEndpoint,
  adapterToken,
  onAdapterEndpointChange,
  onAdapterTokenChange,
}) {
  const usesAdapter = dataMode === "adapter" || dataMode === "auto";

  return (
    <div style={card}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: C.green }} />
      <SectionHeader num="06">Spieldatenquelle</SectionHeader>

      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Datenquelle</label>
        <select value={dataMode} onChange={(event) => onDataModeChange(event.target.value)} style={{ ...inp, cursor: "pointer" }}>
          {DATA_SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>CSV/JSON Import</label>
        <input type="file" accept=".csv,.json,application/json,text/csv" onChange={onFileImport} style={inp} />
      </div>

      {usesAdapter ? (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>Live-Adapter Endpoint</label>
            <input
              value={adapterEndpoint}
              onChange={(event) => onAdapterEndpointChange(event.target.value)}
              placeholder="http://localhost:8787/api/games"
              style={inp}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Adapter Token (optional)</label>
            <input
              type="password"
              value={adapterToken}
              onChange={(event) => onAdapterTokenChange(event.target.value)}
              placeholder="Bearer Token"
              style={inp}
            />
          </div>
        </>
      ) : null}

      {uploadName ? (
        <div
          style={{
            marginBottom: 10,
            padding: "10px 12px",
            borderRadius: 5,
            background: C.greenDim,
            border: `1px solid ${C.greenDark}`,
            color: C.green,
            fontSize: 12,
          }}
        >
          Datei geladen: <strong>{uploadName}</strong> · {importedCount} Spiele erkannt
          {uploadSummary?.totalRows ? (
            <div style={{ marginTop: 6, color: C.gray, fontSize: 11 }}>
              Gesamtzeilen: {uploadSummary.totalRows} · Gültig: {uploadSummary.validRows} · Übersprungen: {uploadSummary.skippedRows}
            </div>
          ) : null}
        </div>
      ) : null}

      {uploadSummary?.warnings?.length ? (
        <div
          style={{
            marginBottom: 10,
            padding: "10px 12px",
            borderRadius: 5,
            background: C.warnDim,
            border: `1px solid ${C.warn}`,
            color: C.warn,
            fontSize: 12,
          }}
        >
          Import-Hinweise:
          <ul style={{ margin: "8px 0 0", paddingLeft: 16 }}>
            {uploadSummary.warnings.map((warning, idx) => (
              <li key={`${warning}-${idx}`} style={{ marginBottom: 4 }}>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {uploadError ? (
        <div
          style={{
            marginBottom: 10,
            padding: "10px 12px",
            borderRadius: 5,
            background: C.errorDim,
            border: `1px solid ${C.error}`,
            color: "#ff8080",
            fontSize: 12,
          }}
        >
          Importfehler: {uploadError}
        </div>
      ) : null}

      <div
        style={{
          padding: "9px 12px",
          background: "#111",
          borderRadius: 5,
          border: `1px solid ${C.border}`,
          fontSize: 12,
          color: C.grayDark,
          fontFamily: "'Barlow', sans-serif",
        }}
      >
        Keine fussball.de-API: Daten kommen aus CSV/JSON-Import, Live-Adapter oder Demo-Fallback.
      </div>
    </div>
  );
}
