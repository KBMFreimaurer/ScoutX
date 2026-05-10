import { C, card } from "../styles/theme";
import { SectionHeader } from "./SectionHeader";
import { useScrollTapGuard } from "../hooks/useScrollTapGuard";

export function KreisSelector({ kreise, kreisIds, onSelect, isMobile, stateName = "", disabled = false }) {
  const selectedIds = Array.isArray(kreisIds) ? kreisIds : [];
  const { touchProps, wrapOnClick } = useScrollTapGuard();

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <div>
          <SectionHeader num="02">Region & Kreis</SectionHeader>
          {stateName ? <div style={{ marginTop: 4, color: C.gray, fontSize: 12 }}>{stateName}</div> : null}
        </div>
        <div
          style={{
            border: `1px solid ${selectedIds.length > 0 ? C.greenBorder : C.border}`,
            borderRadius: 999,
            padding: "4px 10px",
            fontSize: 11,
            color: selectedIds.length > 0 ? C.green : C.gray,
            background: selectedIds.length > 0 ? C.greenDim : "rgba(255,255,255,0.03)",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
          aria-live="polite"
        >
          {selectedIds.length} ausgewählt
        </div>
      </div>
      {disabled ? (
        <div style={{ color: C.gray, fontSize: 13, padding: "18px 0" }}>
          Bitte zuerst ein Bundesland auswählen.
        </div>
      ) : null}
      <div className="kreis-grid">
        {kreise.map((kreis) => {
          const selected = selectedIds.includes(kreis.id);
          const label = String(kreis.displayName || kreis.label || kreis.name || "");
          const shortCode = String(kreis.shortCode || kreis.kurz || "");
          const isLongLabel = label.length > 14;
          return (
            <button
              type="button"
              key={kreis.id}
              disabled={disabled || !kreis.enabled}
              className="item-btn"
              onClick={wrapOnClick(() => onSelect(kreis.id))}
              aria-pressed={selected}
              aria-label={`Region/Kreis ${label} ${selected ? "abwählen" : "auswählen"}`}
              {...touchProps}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${selected ? C.greenBorder : C.border}`,
                background: selected ? C.greenDim : "rgba(255,255,255,0.03)",
                color: selected ? C.offWhite : C.gray,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
                fontSize: isMobile ? 12 : 13,
                fontWeight: selected ? 600 : 400,
                cursor: disabled || !kreis.enabled ? "not-allowed" : "pointer",
                opacity: disabled || !kreis.enabled ? 0.55 : 1,
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
                {selected ? "AKTIV" : String(kreis.type || "REGION").toUpperCase()}
              </span>
              <span
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: isLongLabel ? (isMobile ? 15 : 16) : 17,
                  lineHeight: 1.15,
                  color: selected ? C.white : C.offWhite,
                  maxWidth: "100%",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {label}
              </span>
              <span style={{ fontSize: 11, color: C.gray, marginTop: 2, display: "block" }}>{shortCode}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
