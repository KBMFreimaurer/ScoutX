import { C, card, inp, lbl } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function DataSourceConfig({
  adapterToken,
  onAdapterTokenChange,
}) {
  return (
    <div style={card}>
      <SectionHeader num="07">Datenquelle</SectionHeader>

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
