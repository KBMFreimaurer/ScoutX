import { useState } from "react";
import { C } from "../styles/theme";
import { openScoutPdf } from "../services/pdf";

export function PDFExport({
  games,
  plan = "",
  cfg,
  syncContext = null,
  label = "PDF herunterladen",
  variant = "ghost",
  style = {},
  disabled = false,
  onExportSuccess = null,
  onExportError = null,
}) {
  const [exporting, setExporting] = useState(false);
  const isPrimary = variant === "primary";
  const isDisabled = disabled || exporting;

  const onExport = async () => {
    if (isDisabled) {
      return;
    }

    setExporting(true);
    try {
      const result = await openScoutPdf(games, plan, cfg, null, syncContext);
      if (!result?.ok) {
        onExportError?.(result?.error || "Unbekannter Fehler");
        return;
      }
      onExportSuccess?.(result);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={exporting ? "true" : "false"}
      onClick={() => {
        void onExport();
      }}
      disabled={isDisabled}
      style={
        isPrimary
          ? {
              fontSize: 12,
              padding: "9px 16px",
              borderRadius: 10,
              border: "none",
              background: isDisabled ? "rgba(255,255,255,0.06)" : C.green,
              color: isDisabled ? C.grayDark : C.bg,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontWeight: 600,
              cursor: isDisabled ? "not-allowed" : "pointer",
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s ease",
              opacity: isDisabled ? 0.6 : 1,
              ...style,
            }
          : {
              padding: "8px 14px",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              color: C.gray,
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontSize: 12,
              cursor: isDisabled ? "not-allowed" : "pointer",
              minHeight: 44,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s ease",
              opacity: isDisabled ? 0.6 : 1,
              ...style,
            }
      }
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      {exporting ? "PDF wird erstellt..." : label}
    </button>
  );
}
