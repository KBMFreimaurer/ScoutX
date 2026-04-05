import { C, card } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function KreisSelector({ kreise, kreisId, onSelect, isMobile }) {
  return (
    <div style={card}>
      <SectionHeader num="01">Region & Kreis</SectionHeader>
      <div className="kreis-grid">
        {kreise.map((kreis) => {
          const selected = kreisId === kreis.id;
          return (
            <button
              type="button"
              key={kreis.id}
              className="item-btn"
              onClick={() => onSelect(kreis.id)}
              aria-pressed={selected}
              aria-label={`Kreis ${kreis.label} auswählen`}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${selected ? C.greenBorder : C.border}`,
                background: selected ? C.greenDim : "rgba(255,255,255,0.03)",
                color: selected ? C.offWhite : C.gray,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                fontSize: isMobile ? 12 : 13,
                fontWeight: selected ? 600 : 400,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s ease",
                minHeight: 64,
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
                {selected ? "AKTIV" : "KREIS"}
              </span>
              <span style={{ display: "block", fontWeight: 700, fontSize: 17, lineHeight: 1.1, color: selected ? C.white : C.offWhite }}>
                {kreis.label}
              </span>
              <span style={{ fontSize: 11, color: C.gray, marginTop: 2, display: "block" }}>{kreis.kurz}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
