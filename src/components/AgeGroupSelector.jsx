import { C, card } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function AgeGroupSelector({ jugendKlassen, jugendId, onSelect, jugend }) {
  return (
    <div style={card}>
      <SectionHeader num="02">Altersklasse</SectionHeader>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {jugendKlassen.map((item) => {
          const selected = jugendId === item.id;
          return (
            <button
              key={item.id}
              className="item-btn"
              onClick={() => onSelect(item.id)}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: `1px solid ${selected ? C.green : "rgba(255,255,255,0.08)"}`,
                background: selected ? "linear-gradient(135deg, #70DD88 0%, #00873E 100%)" : "#2A2A2A",
                color: selected ? "#08110b" : C.gray,
                fontFamily: "'Barlow Condensed', sans-serif",
                cursor: "pointer",
                transition: "all 0.15s",
                minHeight: 0,
                minWidth: 70,
                boxShadow: selected ? "0 10px 18px rgba(0,135,62,0.2)" : "none",
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{item.kurz}</span>
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
            border: "1px solid rgba(232,160,0,0.35)",
            borderRadius: 7,
            fontSize: 12,
            color: C.warn,
            fontFamily: "'Barlow', sans-serif",
          }}
        >
          ⚡ {jugend.label}: Turnierformat - ein Austragungsort, gestaffelte Anstoßzeiten ab 09:00 Uhr.
        </div>
      ) : null}
    </div>
  );
}
