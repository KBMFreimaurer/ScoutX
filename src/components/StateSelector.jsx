import { C, card } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function StateSelector({ states, selectedStateCode, onSelect, isMobile }) {
  const safeStates = Array.isArray(states) ? states : [];

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <SectionHeader num="01">Bundesland auswählen</SectionHeader>
        <div
          style={{
            border: `1px solid ${selectedStateCode ? C.greenBorder : C.border}`,
            borderRadius: 999,
            padding: "4px 10px",
            fontSize: 11,
            color: selectedStateCode ? C.green : C.gray,
            background: selectedStateCode ? C.greenDim : "rgba(255,255,255,0.03)",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
          aria-live="polite"
        >
          {selectedStateCode ? "1 ausgewählt" : "0 ausgewählt"}
        </div>
      </div>

      <div className="kreis-grid">
        {safeStates.map((state) => {
          const selected = state.code === selectedStateCode;
          const isLongLabel = String(state.name || "").length > 18;
          const enabledRegions = Array.isArray(state.regions) ? state.regions.filter((region) => region.enabled).length : 0;

          return (
            <button
              type="button"
              key={state.code}
              className="item-btn"
              onClick={() => onSelect(state.code)}
              aria-pressed={selected}
              aria-label={`Bundesland ${state.name} auswählen`}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${selected ? C.greenBorder : C.border}`,
                background: selected ? C.greenDim : "rgba(255,255,255,0.03)",
                color: selected ? C.offWhite : C.gray,
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                fontSize: isMobile ? 12 : 13,
                fontWeight: selected ? 600 : 400,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s ease",
                minHeight: isMobile ? 92 : 98,
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: 9,
                  color: selected ? C.green : C.grayDark,
                  letterSpacing: "1px",
                  marginBottom: 4,
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                {selected ? "AKTIV" : "BUNDESLAND"}
              </span>
              <span
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: isLongLabel ? (isMobile ? 14 : 15) : 17,
                  lineHeight: 1.15,
                  color: selected ? C.white : C.offWhite,
                  maxWidth: "100%",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {state.name}
              </span>
              <span style={{ fontSize: 11, color: C.gray, marginTop: 2, display: "block" }}>
                {state.code} · {enabledRegions} Regionen
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
