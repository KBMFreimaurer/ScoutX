import { C } from "../styles/theme";

export function GhostButton({ onClick, children, style, disabled, ...props }) {
  return (
    <button
      type="button"
      className="ghost-btn"
      onClick={onClick}
      disabled={disabled}
      {...props}
      style={{
        padding: "9px 16px",
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        color: C.offWhite,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        minHeight: 44,
        transition: "all 0.2s ease",
        fontWeight: 500,
        opacity: disabled ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        gap: 6,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({ onClick, disabled, children, style, ...props }) {
  return (
    <button
      type="button"
      className="pri-btn"
      onClick={onClick}
      disabled={disabled}
      {...props}
      style={{
        padding: "14px 24px",
        borderRadius: 12,
        border: "none",
        background: disabled
          ? "rgba(255,255,255,0.06)"
          : C.green,
        color: disabled ? C.grayDark : C.bg,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        minHeight: 48,
        boxShadow: disabled ? "none" : `0 0 30px rgba(0,200,83,0.2), 0 4px 12px rgba(0,200,83,0.15)`,
        transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
        letterSpacing: "-0.01em",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
