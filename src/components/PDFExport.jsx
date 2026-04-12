import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  confirmBeforeDownload = false,
  onExportSuccess = null,
  onExportError = null,
}) {
  const [exporting, setExporting] = useState(false);
  const [previewState, setPreviewState] = useState(null);
  const isPrimary = variant === "primary";
  const isDisabled = disabled || exporting || Boolean(previewState);

  useEffect(() => {
    return () => {
      previewState?.revoke?.();
    };
  }, [previewState]);

  useEffect(() => {
    if (!previewState || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [previewState]);

  const closePreview = () => {
    previewState?.revoke?.();
    setPreviewState(null);
  };

  const confirmDownload = () => {
    if (!previewState) {
      return;
    }

    previewState.download?.();
    onExportSuccess?.({ ok: true, fileName: previewState.fileName });
    const pending = previewState;
    setPreviewState(null);
    window.setTimeout(() => {
      pending?.revoke?.();
    }, 5000);
  };

  const onExport = async () => {
    if (isDisabled) {
      return;
    }

    setExporting(true);
    try {
      const result = await openScoutPdf(
        games,
        plan,
        cfg,
        null,
        syncContext,
        confirmBeforeDownload ? { mode: "preview" } : null,
      );
      if (!result?.ok) {
        onExportError?.(result?.error || "Unbekannter Fehler");
        return;
      }
      if (confirmBeforeDownload) {
        setPreviewState({
          url: result.previewUrl,
          fileName: result.fileName,
          download: result.download,
          revoke: result.revoke,
        });
        return;
      }
      onExportSuccess?.(result);
    } finally {
      setExporting(false);
    }
  };

  const previewDialog = previewState ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="PDF Vorschau"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 2000,
      }}
      onClick={closePreview}
    >
      <div
        style={{
          width: "min(1100px, 96vw)",
          height: "min(860px, 92vh)",
          borderRadius: 12,
          background: C.surfaceSolid,
          border: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "10px 12px",
            borderBottom: `1px solid ${C.border}`,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ color: C.offWhite, fontSize: 13, fontWeight: 700 }}>PDF Vorschau</div>
          <div style={{ color: C.gray, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {previewState.fileName || "ScoutX-Plan.pdf"}
          </div>
        </div>

        <iframe
          title="ScoutX PDF Vorschau"
          src={`${previewState.url}#view=FitH&page=1&zoom=page-width`}
          style={{
            border: "none",
            width: "100%",
            flex: 1,
            background: "#111",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: 12,
            borderTop: `1px solid ${C.border}`,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <button
            type="button"
            onClick={closePreview}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.03)",
              color: C.gray,
              cursor: "pointer",
              fontSize: 12,
              minHeight: 36,
            }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={confirmDownload}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "none",
              background: C.green,
              color: C.bg,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              minHeight: 36,
            }}
          >
            Download bestätigen
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
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
      {previewDialog && typeof document !== "undefined" ? createPortal(previewDialog, document.body) : null}
    </>
  );
}
