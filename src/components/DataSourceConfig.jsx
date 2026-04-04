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
      <SectionHeader num="06">Datenquelle</SectionHeader>

      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Modus</label>
        <select
          className="scout-select"
          value={dataMode}
          onChange={(event) => onDataModeChange(event.target.value)}
          style={{ ...inp, cursor: "pointer" }}
        >
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
          <label style={lbl}>Adapter Endpoint</label>
          <input
            className="scout-input"
            value={adapterEndpoint}
            onChange={(event) => onAdapterEndpointChange(event.target.value)}
            placeholder="/api/games"
              style={inp}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Token (optional)</label>
            <input
              className="scout-input"
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
            padding: "12px 14px",
            borderRadius: 10,
            background: C.greenDim,
            border: `1px solid ${C.greenBorder}`,
            color: C.green,
            fontSize: 12,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><polyline points="20 6 9 17 4 12"/></svg>
          <div>
            <strong>{uploadName}</strong> — {importedCount} Spiele
            {uploadSummary?.totalRows ? (
              <div style={{ marginTop: 4, color: C.gray, fontSize: 11 }}>
                {uploadSummary.totalRows} Zeilen, {uploadSummary.validRows} gültig, {uploadSummary.skippedRows} übersprungen
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {uploadSummary?.warnings?.length ? (
        <div
          style={{
            marginBottom: 10,
            padding: "12px 14px",
            borderRadius: 10,
            background: C.warnDim,
            border: `1px solid rgba(251,191,36,0.15)`,
            color: C.warn,
            fontSize: 12,
          }}
        >
          <ul style={{ margin: 0, paddingLeft: 16 }}>
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
            padding: "12px 14px",
            borderRadius: 10,
            background: C.errorDim,
            border: `1px solid rgba(239,68,68,0.15)`,
            color: "#fca5a5",
            fontSize: 12,
          }}
        >
          {uploadError}
        </div>
      ) : null}

      <div
        style={{
          padding: "10px 14px",
          background: "rgba(255,255,255,0.02)",
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          fontSize: 12,
          color: C.grayDark,
          fontFamily: "'Inter', sans-serif",
          lineHeight: 1.5,
        }}
      >
        Auto nutzt CSV/JSON-Import oder Live-Adapter. Demo-Daten nur explizit.
      </div>
    </div>
  );
}
