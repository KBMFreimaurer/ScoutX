import { C, card } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function KreisSelector({ kreise, kreisId, onSelect, isMobile }) {
  return (
    <div style={card}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: C.green }} />
      <SectionHeader num="01">Kreis wählen</SectionHeader>
      <div className="kreis-grid">
        {kreise.map((kreis) => {
          const selected = kreisId === kreis.id;
          return (
            <button
              key={kreis.id}
              className="item-btn"
              onClick={() => onSelect(kreis.id)}
              style={{
                padding: "10px 12px",
                borderRadius: 5,
                border: `1px solid ${selected ? C.green : C.border}`,
                background: selected ? C.greenDark : "#111",
                color: selected ? C.white : C.gray,
                fontFamily: "'Barlow', sans-serif",
                fontSize: isMobile ? 12 : 13,
                fontWeight: selected ? 600 : 400,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
                minHeight: 52,
                boxShadow: selected ? `0 0 0 1px ${C.green}` : "none",
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: 9,
                  color: selected ? C.green : C.grayDark,
                  letterSpacing: "2px",
                  marginBottom: 3,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                }}
              >
                {kreis.kurz}
              </span>
              {kreis.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
