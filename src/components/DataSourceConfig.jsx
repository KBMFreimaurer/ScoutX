import { C, card, inp, lbl } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function DataSourceConfig({
  adapterEndpoint,
  adapterToken,
  onAdapterEndpointChange,
  onAdapterTokenChange,
}) {
  return (
    <div style={card}>
      <SectionHeader num="07">Datenquelle</SectionHeader>

      <div style={{ marginBottom: 10 }}>
        <label htmlFor="adapter-endpoint-input" style={lbl}>Adapter Endpoint</label>
        <input
          id="adapter-endpoint-input"
          className="scout-input"
          value={adapterEndpoint}
          onChange={(event) => onAdapterEndpointChange(event.target.value)}
          placeholder="/api/games"
          style={inp}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="adapter-token-input" style={lbl}>Token (optional)</label>
        <input
          id="adapter-token-input"
          className="scout-input"
          type="password"
          value={adapterToken}
          onChange={(event) => onAdapterTokenChange(event.target.value)}
          placeholder="Bearer Token"
          style={inp}
        />
      </div>

      <div
        style={{
          padding: "10px 14px",
          background: "rgba(255,255,255,0.02)",
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          fontSize: 12,
          color: C.grayDark,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
          lineHeight: 1.5,
        }}
      >
        ScoutX nutzt immer den Live-Adapter als Datenquelle.
      </div>
    </div>
  );
}
