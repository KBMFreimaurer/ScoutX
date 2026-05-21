import { C } from "../styles/theme";

function fieldRow(label, value) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: C.gray }}>{label}</span>
      <span style={{ color: C.offWhite, textAlign: "right" }}>{String(value || "-")}</span>
    </div>
  );
}

export function HrworksImportReviewModal({
  open,
  payload,
  warnings,
  errors,
  onCancel,
  onEdit,
  onConfirm,
  onExportOnly,
  onDryRun,
  loginConfirmed,
  onLoginConfirmedChange,
  payloads,
  payloadIndex = 0,
}) {
  if (!open) {
    return null;
  }

  const games = Array.isArray(payload?.sourceGames) ? payload.sourceGames : [];
  const routeLegs = Array.isArray(payload?.routeLegs) ? payload.routeLegs : [];
  const totalPayloads = Array.isArray(payloads) && payloads.length > 0 ? payloads.length : 1;
  const workflowFacts = [
    "XLSX-Datum und XLSX-Uhrzeiten sind bindend.",
    "Zweck/Bemerkung enthalten nur Heimmannschaften.",
    "Zielort und Zwischenorte bleiben in den Reisedaten leer.",
    "Jeder Streckenabschnitt wird als eigene Kilometerangabe angelegt.",
    "Kilometer-Bemerkung bleibt leer.",
    "Berichte werden abgeschlossen und erwartete HRworks-Warnungen mit Ja bestätigt.",
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="HRworks-Import prüfen"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
        padding: 14,
      }}
    >
      <div
        className="fu2"
        style={{
          width: "min(760px, 96vw)",
          maxHeight: "88vh",
          overflowY: "auto",
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: C.bg,
          padding: 16,
        }}
      >
        <h2 style={{ margin: 0, marginBottom: 10, fontSize: 18, color: C.white }}>HRworks-Import prüfen</h2>
        {totalPayloads > 1 ? (
          <div style={{ marginBottom: 10, fontSize: 12, color: C.grayLight }}>
            Tag {Number(payloadIndex) + 1} von {totalPayloads}: Mehrtägiger Plan wird als einzelne HRworks-Abrechnungen vorbereitet.
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
          {fieldRow("Datum", payload?.date)}
          {fieldRow("Beginn", payload?.startTime)}
          {fieldRow("Ende", payload?.endTime)}
          {fieldRow("Berechnete Stunden", payload?.workHours)}
          {fieldRow("Zweck", payload?.purpose)}
          {fieldRow("Bemerkung", payload?.note)}
          {fieldRow("Abfahrtsort", payload?.departureLocation)}
          {fieldRow("Zielort", payload?.destinationLocation)}
          {fieldRow("Zwischenorte", (payload?.intermediateStops || []).join(" | "))}
          {fieldRow("Route (Plan)", routeLegs.map((leg) => `${leg.from} -> ${leg.to}`).join(" | "))}
          {fieldRow("Kostenstelle", payload?.costCenter)}
          {fieldRow("Zugehörige Spiele", games.map((game) => `${game.home} vs ${game.away}`).join(" | "))}
        </div>

        <div
          style={{
            marginTop: 12,
            border: `1px solid ${C.greenBorder}`,
            background: C.greenDim,
            borderRadius: 10,
            padding: 10,
          }}
        >
          <div style={{ color: C.green, fontSize: 12, fontWeight: 800 }}>Kompletter HRworks-Workflow</div>
          <div style={{ marginTop: 6, display: "grid", gap: 4, color: C.grayLight, fontSize: 12 }}>
            {workflowFacts.map((item) => (
              <div key={item}>• {item}</div>
            ))}
          </div>
        </div>

        {(warnings?.length || 0) > 0 ? (
          <div style={{ marginTop: 12, color: "#fde68a", fontSize: 12 }}>
            {warnings.map((warning) => (
              <div key={warning}>• {warning}</div>
            ))}
          </div>
        ) : null}

        {(errors?.length || 0) > 0 ? (
          <div style={{ marginTop: 12, color: "#fca5a5", fontSize: 12 }}>
            {errors.map((error) => (
              <div key={error}>• {error}</div>
            ))}
          </div>
        ) : null}

        <div style={{ marginTop: 12, color: C.gray, fontSize: 12 }}>
          Hinweis: Produktivimport schreibt und schließt die Reisekostenabrechnung in HRworks ab. Testlauf speichert nichts.
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, color: C.grayLight }}>
          <input
            type="checkbox"
            checked={loginConfirmed === true}
            onChange={(event) => onLoginConfirmedChange?.(Boolean(event?.target?.checked))}
          />
          Ich bin in HRworks eingeloggt und möchte diesen Workflow jetzt vollständig ausführen
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button type="button" onClick={onCancel}>Abbrechen</button>
          <button type="button" onClick={onEdit}>Daten bearbeiten</button>
          <button type="button" onClick={onExportOnly}>Nur Exportdatei erstellen</button>
          <button type="button" onClick={onDryRun}>Testlauf (kein Speichern)</button>
          <button type="button" onClick={onConfirm} disabled={(errors?.length || 0) > 0 || loginConfirmed !== true}>Produktiv in HRworks speichern und abschließen</button>
        </div>
      </div>
    </div>
  );
}
