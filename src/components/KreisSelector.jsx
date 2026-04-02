import { C, card } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function KreisSelector({ kreise, kreisId, onSelect, isMobile }) {
  return (
    <div style={card}>
      <SectionHeader num="01">Region & Kreis-Auswahl</SectionHeader>
      <div className="kreis-grid">
        {kreise.map((kreis) => {
          const selected = kreisId === kreis.id;
          return (
            <button
              key={kreis.id}
              className="item-btn"
              onClick={() => onSelect(kreis.id)}
              style={{
                padding: "12px 13px",
                borderRadius: 7,
                border: `1px solid ${selected ? C.green : "rgba(255,255,255,0.08)"}`,
                background: selected ? "linear-gradient(135deg, rgba(112,221,136,0.2), rgba(0,135,62,0.12))" : "#2A2A2A",
                color: selected ? C.offWhite : C.gray,
                fontFamily: "'Barlow', sans-serif",
                fontSize: isMobile ? 12 : 13,
                fontWeight: selected ? 600 : 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
                minHeight: 64,
                boxShadow: selected ? "0 0 0 1px rgba(112,221,136,0.14)" : "none",
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: 9,
                  color: selected ? "#70dd88" : C.grayDark,
                  letterSpacing: "1.3px",
                  marginBottom: 3,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                }}
              >
                {selected ? "AKTIVER KREIS" : "KREIS"}
              </span>
              <span style={{ display: "block", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 19, lineHeight: 1.05 }}>
                {kreis.label}
              </span>
              <span style={{ fontSize: 11, color: C.gray }}>{kreis.kurz}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
