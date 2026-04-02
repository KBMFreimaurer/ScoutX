import { C } from "../styles/theme";

export function GhostButton({ onClick, children, style, disabled }) {
  return (
    <button
      className="ghost-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 16px",
        background: "transparent",
        border: `1px solid ${C.border}`,
        borderRadius: 5,
        color: C.gray,
        fontFamily: "'Barlow', sans-serif",
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        minHeight: 44,
        transition: "all 0.15s",
        fontWeight: 500,
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
        borderRadius: 5,
        border: "none",
        background: disabled ? "#222" : C.green,
        color: disabled ? C.grayDark : C.white,
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: "0.5px",
        cursor: disabled ? "not-allowed" : "pointer",
        minHeight: 44,
        textTransform: "uppercase",
        transition: "filter 0.2s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
