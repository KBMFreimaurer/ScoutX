import { C, card } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function AgeGroupSelector({ jugendKlassen, jugendId, onSelect, jugend }) {
  return (
    <div style={card}>
      <SectionHeader num="02">Altersklasse</SectionHeader>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {jugendKlassen.map((item) => {
          const selected = jugendId === item.id;
          return (
            <button
              type="button"
              key={item.id}
              className="item-btn"
              onClick={() => onSelect(item.id)}
              aria-pressed={selected}
              aria-label={`${item.label} auswählen`}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: `1px solid ${selected ? C.greenBorder : C.border}`,
                background: selected ? C.green : "rgba(255,255,255,0.03)",
                color: selected ? C.bg : C.grayLight,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                cursor: "pointer",
                transition: "all 0.2s ease",
                minHeight: 0,
                minWidth: 64,
                boxShadow: selected ? "0 0 20px rgba(0,200,83,0.2)" : "none",
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{item.kurz}</span>
            </button>
          );
        })}
      </div>

      {jugend?.turnier ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: C.warnDim,
            border: `1px solid rgba(251,191,36,0.15)`,
            borderRadius: 10,
            fontSize: 12,
            color: C.warn,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          {jugend.label}: Turnierformat - gestaffelte Zeiten ab 09:00
        </div>
      ) : null}
    </div>
  );
}
