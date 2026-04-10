import { C, card } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";

export function AgeGroupSelector({
  jugendKlassen,
  jugendId,
  onSelect,
  jugend,
  availableSubLevels = [],
  selectedSubLevels = [],
  onToggleSubLevel,
  onClearSubLevels,
}) {
  const showSubLevelControls = Boolean(jugendId) && String(jugend?.id || "").toLowerCase() !== "bambini";

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

      {showSubLevelControls ? (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: C.gray,
              letterSpacing: "0.3px",
              textTransform: "uppercase",
              marginBottom: 8,
              fontWeight: 600,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >
            Unterstufen-Parameter (optional)
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {availableSubLevels.map((subLevel) => {
              const selected = selectedSubLevels.includes(subLevel);
              return (
                <button
                  type="button"
                  key={subLevel}
                  onClick={() => onToggleSubLevel?.(subLevel)}
                  aria-pressed={selected}
                  aria-label={`${subLevel} auswählen`}
                  style={{
                    border: `1px solid ${selected ? C.greenBorder : C.border}`,
                    background: selected ? C.greenDim : "rgba(255,255,255,0.03)",
                    color: selected ? C.green : C.gray,
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    minHeight: 0,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                  }}
                >
                  {subLevel}
                </button>
              );
            })}
          </div>

          {selectedSubLevels.length > 0 ? (
            <button
              type="button"
              onClick={onClearSubLevels}
              style={{
                marginTop: 8,
                border: "none",
                background: "transparent",
                color: C.gray,
                cursor: "pointer",
                padding: 0,
                fontSize: 12,
                minHeight: 0,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              }}
            >
              Unterstufen entfernen
            </button>
          ) : (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: C.grayDark,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              }}
            >
              Keine Unterstufen gewählt.
            </div>
          )}
        </div>
      ) : null}

      {Boolean(jugendId) && String(jugend?.id || "").toLowerCase() === "bambini" ? (
        <div
          style={{
            marginTop: 12,
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
          Für Bambini gibt es keine Unterstufen-Parameter.
        </div>
      ) : null}
    </div>
  );
}
