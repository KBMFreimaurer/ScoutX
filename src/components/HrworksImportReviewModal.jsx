import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { C } from "../styles/theme";

function fieldRow(label, value) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: C.gray }}>{label}</span>
      <span style={{ color: C.offWhite, textAlign: "right" }}>{String(value || "-")}</span>
    </div>
  );
}

function stepStatusLabel(done) {
  return done ? "Erledigt" : "Offen";
}

function stepStatusColor(done) {
  return done ? C.green : "#fde68a";
}

function stepCard(index, title, done, body, action = null) {
  return (
    <div
      style={{
        border: `1px solid ${done ? C.greenBorder : "rgba(253,230,138,0.28)"}`,
        background: done ? "rgba(0,200,83,0.06)" : "rgba(253,230,138,0.06)",
        borderRadius: 12,
        padding: 12,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ color: C.gray, fontSize: 11, fontWeight: 700 }}>STEP {index}</div>
          <div style={{ color: C.white, fontSize: 15, fontWeight: 800 }}>{title}</div>
        </div>
        <div style={{ color: stepStatusColor(done), fontSize: 11, fontWeight: 800 }}>
          {stepStatusLabel(done)}
        </div>
      </div>
      <div style={{ color: C.grayLight, fontSize: 12, display: "grid", gap: 6 }}>
        {body}
      </div>
      {action}
    </div>
  );
}

function compactStepCard(index, title, detail, action = null) {
  return (
    <div
      style={{
        border: `1px solid ${C.greenBorder}`,
        background: "rgba(0,200,83,0.06)",
        borderRadius: 12,
        padding: 12,
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ color: C.gray, fontSize: 11, fontWeight: 700 }}>STEP {index}</div>
          <div style={{ color: C.white, fontSize: 15, fontWeight: 800 }}>{title}</div>
        </div>
        <div style={{ color: C.green, fontSize: 11, fontWeight: 800 }}>Erledigt</div>
      </div>
      <div style={{ color: C.grayLight, fontSize: 12 }}>{detail}</div>
      {action}
    </div>
  );
}

export function HrworksImportReviewModal({
  open,
  payload,
  warnings,
  errors,
  onCancel,
  onConfirm,
  onPickFile,
  onDropFile,
  onOpenLogin,
  loginConfirmed,
  onLoginConfirmedChange,
  uploadedFileName = "",
  wizardNotice = "",
  automationStarting = false,
  companionStatus = "unknown",
  companionInstallTarget = null,
  onCheckCompanion,
}) {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const games = Array.isArray(payload?.sourceGames) ? payload.sourceGames : [];
  const routeLegs = Array.isArray(payload?.routeLegs) ? payload.routeLegs : [];
  const fileReady = String(payload?.importSource || "") === "timesheet";
  const canStartImport = fileReady && loginConfirmed === true && (errors?.length || 0) === 0 && !automationStarting;
  const currentStep = !fileReady ? 1 : loginConfirmed === true ? 3 : 2;
  const isCompactViewport = typeof window !== "undefined" ? window.innerWidth < 900 : false;
  const showCompanionInstall = fileReady && loginConfirmed !== true && companionStatus === "missing";
  const primaryCompanionDownload = companionInstallTarget?.primaryDownload || null;
  const companionDownloads = Array.isArray(companionInstallTarget?.downloads) ? companionInstallTarget.downloads : [];

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const handleFileDrop = (event) => {
    event.preventDefault();
    setIsDraggingFile(false);
    const file = event?.dataTransfer?.files?.[0];
    if (file) {
      onDropFile?.(file);
    }
  };

  const uploadDropZone = (
    <div
      role="button"
      tabIndex={0}
      aria-label="XLSX-Datei per Drag-and-Drop hochladen"
      onClick={onPickFile}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPickFile?.();
        }
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!isDraggingFile) {
          setIsDraggingFile(true);
        }
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        if (event.currentTarget === event.target) {
          setIsDraggingFile(false);
        }
      }}
      onDrop={handleFileDrop}
      style={{
        borderRadius: 12,
        border: `1px dashed ${isDraggingFile ? C.green : "rgba(255,255,255,0.12)"}`,
        background: isDraggingFile ? "rgba(0,200,83,0.08)" : "rgba(255,255,255,0.03)",
        padding: isCompactViewport ? 14 : 18,
        display: "grid",
        gap: 8,
        textAlign: "center",
        cursor: "pointer",
        outline: "none",
        transition: "border-color 0.18s ease, background 0.18s ease, transform 0.18s ease",
      }}
    >
      <div style={{ color: C.offWhite, fontSize: 14, fontWeight: 700 }}>
        XLSX hier hineinziehen
      </div>
      <div style={{ color: C.grayLight, fontSize: 12 }}>
        oder antippen, um den Dateidialog zu öffnen.
      </div>
      <div
        style={{
          justifySelf: "center",
          minWidth: isCompactViewport ? "100%" : 240,
          padding: "11px 14px",
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          background: "rgba(255,255,255,0.92)",
          color: C.bg,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        XLSX-Datei hochladen
      </div>
    </div>
  );

  const companionInstallPanel = showCompanionInstall ? (
    <div
      style={{
        border: "1px solid rgba(96,165,250,0.32)",
        background: "rgba(96,165,250,0.08)",
        borderRadius: 12,
        padding: 12,
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ color: C.white, fontSize: 14, fontWeight: 800 }}>ScoutX Companion installieren</div>
      <div style={{ color: C.grayLight, fontSize: 12 }}>
        Für den HRworks-Import muss der Companion einmal lokal auf diesem Gerät installiert werden.
      </div>
      {primaryCompanionDownload ? (
        <a
          href={primaryCompanionDownload.href}
          download={primaryCompanionDownload.fileName || undefined}
          style={{
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 38,
            padding: "9px 12px",
            borderRadius: 10,
            background: C.green,
            color: C.bg,
            fontSize: 13,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          {primaryCompanionDownload.label}
        </a>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {companionDownloads.map((download) => (
            <a
              key={download.platform}
              href={download.href}
              download={download.fileName || undefined}
              style={{ color: C.green, fontSize: 12, fontWeight: 800 }}
            >
              {download.label}
            </a>
          ))}
        </div>
      )}
      <div style={{ color: C.grayLight, fontSize: 12 }}>
        {primaryCompanionDownload?.installHint || "ZIP entpacken, Installer starten und danach die Verbindung erneut prüfen."}
      </div>
      <button type="button" onClick={onCheckCompanion}>Verbindung erneut prüfen</button>
    </div>
  ) : null;

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="HRworks-Import prüfen"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: isCompactViewport ? "flex-start" : "center",
        justifyContent: "center",
        zIndex: 1200,
        padding: isCompactViewport ? 12 : 24,
        overflowY: "auto",
      }}
    >
      <div
        className="fu2"
        style={{
          width: "min(680px, calc(100vw - 24px))",
          maxHeight: "min(720px, calc(100dvh - 24px))",
          overflowY: "auto",
          borderRadius: 16,
          border: `1px solid ${C.border}`,
          background: C.bg,
          padding: isCompactViewport ? 14 : 18,
          display: "grid",
          gap: 12,
          margin: isCompactViewport ? "0 auto" : 0,
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ color: C.gray, fontSize: 11, fontWeight: 700 }}>SCHRITT {currentStep} VON 3</div>
          <h2 style={{ margin: 0, fontSize: isCompactViewport ? 16 : 18, color: C.white }}>In HRworks importieren</h2>
          <div style={{ color: C.grayLight, fontSize: 13 }}>
            Führe den Import in drei Schritten durch: aktuelle Monatsdatei hochladen, in HRworks einloggen, Import starten.
          </div>
        </div>

        {wizardNotice ? (
          <div
            role="status"
            style={{
              color: C.green,
              background: "rgba(0,200,83,0.08)",
              border: `1px solid ${C.greenBorder}`,
              borderRadius: 10,
              padding: 10,
              fontSize: 12,
            }}
          >
            {wizardNotice}
          </div>
        ) : null}

        {fileReady
          ? compactStepCard(
              1,
              "XLSX-Datei des aktuellen Monats hochladen",
              `Datei: ${uploadedFileName || "-"} · Sichtungstag: ${payload?.date || "-"}`,
              <button type="button" onClick={onPickFile}>XLSX erneut hochladen</button>,
            )
          : stepCard(
              1,
              "XLSX-Datei des aktuellen Monats hochladen",
              false,
              <>
                <div>Die XLSX ist bindend für Sichtungstag sowie Beginn- und Enduhrzeit.</div>
                <div>Datei: {uploadedFileName || "Noch keine Datei hochgeladen"}</div>
                <div>Ohne XLSX bleibt der finale HRworks-Import gesperrt.</div>
              </>,
              uploadDropZone,
            )}

        {fileReady
          ? loginConfirmed === true
            ? compactStepCard(
                2,
                "In HRworks einloggen",
                "HRworks-Login wurde bestätigt.",
                <button type="button" onClick={onOpenLogin}>HRworks erneut öffnen</button>,
              )
            : stepCard(
                2,
                "In HRworks einloggen",
                false,
                <>
                  <div>Öffne HRworks, logge dich dort ein und komme dann hierher zurück.</div>
                  <div>ScoutX Companion läuft lokal auf deinem Gerät. Er versucht zuerst denselben Desktop-Browser wie ScoutX zu verwenden. Falls das technisch nicht freigegeben ist, übernimmt der Companion ein eigenes kontrolliertes HRworks-Fenster.</div>
                  {companionInstallPanel}
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.grayLight }}>
                    <input
                      type="checkbox"
                      checked={loginConfirmed === true}
                      onChange={(event) => onLoginConfirmedChange?.(Boolean(event?.target?.checked))}
                    />
                    Ich bin jetzt in HRworks eingeloggt
                  </label>
                </>,
                <button type="button" onClick={onOpenLogin}>HRworks öffnen</button>,
              )
          : null}

        {fileReady && loginConfirmed === true
          ? stepCard(
              3,
              "HRworks-Import starten",
              false,
              <>
                <div>Der Import startet jetzt mit den bindenden XLSX-Daten und der vorbereiteten Route.</div>
                {payload ? (
                  <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
                    {fieldRow("Datum", payload?.date)}
                    {fieldRow("Beginn", payload?.startTime)}
                    {fieldRow("Ende", payload?.endTime)}
                    {fieldRow("Zweck", payload?.purpose)}
                    {fieldRow("Bemerkung", payload?.note)}
                    {fieldRow("Abfahrtsort", payload?.departureLocation)}
                    {fieldRow("Route", routeLegs.map((leg) => `${leg.from} -> ${leg.to}`).join(" | "))}
                    {fieldRow("Spiele", games.map((game) => `${game.home} vs ${game.away}`).join(" | "))}
                  </div>
                ) : null}
                {(warnings?.length || 0) > 0 ? (
                  <div style={{ color: "#fde68a", fontSize: 12, display: "grid", gap: 4, marginTop: 4 }}>
                    {warnings.map((warning) => (
                      <div key={warning}>• {warning}</div>
                    ))}
                  </div>
                ) : null}
                {(errors?.length || 0) > 0 ? (
                  <div style={{ color: "#fca5a5", fontSize: 12, display: "grid", gap: 4, marginTop: 4 }}>
                    {errors.map((error) => (
                      <div key={error}>• {error}</div>
                    ))}
                  </div>
                ) : null}
              </>,
              <button type="button" onClick={onConfirm} disabled={!canStartImport}>
                {automationStarting ? "HRworks Connector wird kontaktiert..." : "HRworks importieren"}
              </button>,
            )
          : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onCancel}>Schließen</button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return dialog;
  }

  return createPortal(dialog, document.body);
}
