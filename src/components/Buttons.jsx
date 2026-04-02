import { C } from "../styles/theme";

export function GhostButton({ onClick, children, style, disabled }) {
  return (
    <button
      className="ghost-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "9px 16px",
        background: "#2A2A2A",
        border: `1px solid ${C.greenBorder}`,
        borderRadius: 6,
        color: C.offWhite,
        fontFamily: "'Barlow', sans-serif",
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        minHeight: 44,
        transition: "all 0.15s",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.6px",
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({ onClick, disabled, children, style }) {
  return (
    <button
      className="pri-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "13px 20px",
        borderRadius: 6,
        border: "none",
        background: disabled ? "#2b2b2b" : "linear-gradient(135deg,#70DD88 0%, #00873E 100%)",
        color: disabled ? C.grayDark : "#08110b",
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 15,
        fontWeight: 800,
        letterSpacing: "0.8px",
        cursor: disabled ? "not-allowed" : "pointer",
        minHeight: 44,
        textTransform: "uppercase",
        boxShadow: disabled ? "none" : "0 12px 28px rgba(0,135,62,0.24)",
        transition: "filter 0.2s, box-shadow 0.2s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
