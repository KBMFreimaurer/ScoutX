import { C, card } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function AgeGroupSelector({ jugendKlassen, jugendId, onSelect, jugend }) {
  return (
    <div style={card}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: C.green }} />
      <SectionHeader num="02">Jugendklasse</SectionHeader>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {jugendKlassen.map((item) => {
          const selected = jugendId === item.id;
          return (
            <button
              key={item.id}
              className="item-btn"
              onClick={() => onSelect(item.id)}
              style={{
                padding: "8px 14px",
                borderRadius: 5,
                border: `1px solid ${selected ? C.green : C.border}`,
                background: selected ? C.greenDark : "#111",
                color: selected ? C.white : C.gray,
                fontFamily: "'Barlow Condensed', sans-serif",
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                minHeight: 64,
                minWidth: 54,
                boxShadow: selected ? `0 0 0 1px ${C.green}` : "none",
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{item.kurz}</span>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.5px" }}>{item.label}</span>
              <span style={{ fontSize: 9, color: selected ? "#80c880" : C.grayDark }}>{item.alter} J.</span>
              {item.turnier ? (
                <span style={{ fontSize: 8, color: selected ? C.warn : C.grayDark, letterSpacing: "0.5px" }}>TURNIER</span>
              ) : null}
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
            border: "1px solid #3a2a00",
            borderRadius: 5,
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
