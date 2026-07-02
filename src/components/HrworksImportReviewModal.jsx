import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { C } from "../styles/theme";
import { HRWORKS_JOB_STATUS_LABELS } from "../services/hrworksImportJobsClient";

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

const JOB_STATUS_COLORS = {
  queued: "#fde68a",
  running: "#93c5fd",
  needs_action: "#fdba74",
  completed: C.green,
  failed: "#fca5a5",
  interrupted: "#fca5a5",
  cancelled: C.gray,
};

const CREDENTIAL_INPUT_STYLE = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: C.offWhite,
  fontSize: 13,
};

export function HrworksImportReviewModal({
  open,
  payload,
  payloadCount = 1,
  warnings,
  errors,
  onCancel,
  onStartJob,
  onRefreshJobStatus,
  jobState = null,
  jobStarting = false,
  wizardNotice = "",
}) {
  const [hrworksBaseUrl, setHrworksBaseUrl] = useState("");
  const [hrworksUsername, setHrworksUsername] = useState("");
  const [hrworksPassword, setHrworksPassword] = useState("");
  const games = Array.isArray(payload?.sourceGames) ? payload.sourceGames : [];
  const routeLegs = Array.isArray(payload?.routeLegs) ? payload.routeLegs : [];
  const credentialsReady = hrworksUsername.trim().length > 0 && hrworksPassword.length > 0;
  const canStartJob = credentialsReady && (errors?.length || 0) === 0 && !jobStarting && !jobState;
  const currentStep = !credentialsReady ? 2 : 3;
  const isCompactViewport = typeof window !== "undefined" ? window.innerWidth < 900 : false;
  const jobStatus = String(jobState?.status || "");
  const jobStatusLabel = HRWORKS_JOB_STATUS_LABELS[jobStatus] || jobStatus || "-";
  const jobDone = ["completed", "failed", "needs_action", "interrupted", "cancelled"].includes(jobStatus);

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

  // Passwort beim Schließen sofort aus dem State entfernen.
  useEffect(() => {
    if (!open) {
      setHrworksPassword("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleStartJob = () => {
    if (!canStartJob) {
      return;
    }
    onStartJob?.({
      baseUrl: hrworksBaseUrl.trim(),
      username: hrworksUsername.trim(),
      password: hrworksPassword,
    });
  };

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="HRworks-Import beauftragen"
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
          <h2 style={{ margin: 0, fontSize: isCompactViewport ? 16 : 18, color: C.white }}>HRworks-Import beauftragen</h2>
          <div style={{ color: C.grayLight, fontSize: 13 }}>
            ScoutX erzeugt die HRworks-Datei automatisch aus diesem Plan. Der Import läuft serverseitig — kein Datei-Upload nötig.
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

        {stepCard(
          1,
          "HRworks-Daten aus dem Plan erzeugt",
          true,
          <>
            <div>
              {payloadCount > 1
                ? `${payloadCount} Sichtungstage werden in einem Auftrag übertragen.`
                : "Ein Sichtungstag wird übertragen."}
            </div>
            {payload ? (
              <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
                {fieldRow("Datum", payload?.date)}
                {fieldRow("Beginn", payload?.startTime)}
                {fieldRow("Ende", payload?.endTime)}
                {fieldRow("Arbeitsstunden", payload?.workHours)}
                {fieldRow("Zweck", payload?.purpose)}
                {fieldRow("Abfahrtsort", payload?.departureLocation)}
                {fieldRow("Kostenstelle", payload?.costCenter)}
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
        )}

        {stepCard(
          2,
          "HRworks-Zugangsdaten für diesen Auftrag",
          credentialsReady,
          <>
            <div>
              Die Zugangsdaten werden nur für diesen Importauftrag genutzt, nicht gespeichert und nicht protokolliert.
            </div>
            <label style={{ display: "grid", gap: 4 }}>
              <span>HRworks-URL (optional, Standard: ssl4.hrworks.de)</span>
              <input
                type="url"
                value={hrworksBaseUrl}
                onChange={(event) => setHrworksBaseUrl(event.target.value)}
                placeholder="https://ssl4.hrworks.de/"
                autoComplete="off"
                style={CREDENTIAL_INPUT_STYLE}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Benutzername / E-Mail</span>
              <input
                type="text"
                value={hrworksUsername}
                onChange={(event) => setHrworksUsername(event.target.value)}
                autoComplete="off"
                style={CREDENTIAL_INPUT_STYLE}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Passwort</span>
              <input
                type="password"
                value={hrworksPassword}
                onChange={(event) => setHrworksPassword(event.target.value)}
                autoComplete="new-password"
                style={CREDENTIAL_INPUT_STYLE}
              />
            </label>
            <div>Falls HRworks eine Zwei-Faktor-Bestätigung verlangt, wird der Auftrag mit „Aktion erforderlich&ldquo; gestoppt.</div>
          </>,
        )}

        {stepCard(
          3,
          "Importauftrag starten",
          jobStatus === "completed",
          <>
            {jobState ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: C.gray }}>Status</span>
                  <span style={{ color: JOB_STATUS_COLORS[jobStatus] || C.offWhite, fontWeight: 800 }}>{jobStatusLabel}</span>
                </div>
                {fieldRow("Auftrag", jobState?.jobId)}
                {jobState?.resultSummary ? fieldRow("Ergebnis", jobState.resultSummary) : null}
                {jobState?.error ? (
                  <div style={{ color: "#fca5a5", fontSize: 12 }}>{jobState.error}</div>
                ) : null}
              </div>
            ) : (
              <div>Der Server legt den Auftrag in eine Warteschlange und führt den HRworks-Import automatisch aus.</div>
            )}
          </>,
          jobState ? (
            <button type="button" onClick={onRefreshJobStatus} disabled={jobDone}>
              {jobDone ? "Auftrag beendet" : "Status aktualisieren"}
            </button>
          ) : (
            <button type="button" onClick={handleStartJob} disabled={!canStartJob}>
              {jobStarting ? "Importauftrag wird angelegt..." : "Importauftrag starten"}
            </button>
          ),
        )}

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
